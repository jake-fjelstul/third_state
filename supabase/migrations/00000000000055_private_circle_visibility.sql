-- =============================================================================
-- Part A: an OPEN circle may also require an application.
--
-- Migration 54 restricted the applications INSERT policy to type='private'.
-- That was wrong: open/private is a VISIBILITY axis, applications_enabled is a
-- JOIN axis, and they are independent. Gate on the flag alone.
-- =============================================================================

drop policy if exists "applicant creates own app" on public.applications;

create policy "applicant creates own app"
  on public.applications for insert to authenticated
  with check (
    auth.uid() = applicant_id
    and exists (
      select 1 from public.circles c
      where c.id = circle_id
        and c.applications_enabled = true
    )
  );

-- NOTE: migration 54 also ran a one-time
--   update public.circles set applications_enabled = false where type = 'open';
-- That was a historical normalisation of pre-existing rows. DO NOT repeat it
-- and DO NOT re-run it — open circles may now legitimately hold true.

-- =============================================================================
-- Part B: membership helper.
--
-- Security definer so that policies which call it do not recurse through
-- circle_members' own RLS. Mirrors the is_chat_member pattern from migration 6
-- and is_circle_admin from migration 45.
--
-- Organizers count as members even if their circle_members row drifted — see
-- the organizer_id backfill in migration 45.
-- =============================================================================

create or replace function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id
      and m.user_id = auth.uid()
  ) or exists (
    select 1 from public.circles c
    where c.id = p_circle_id
      and c.organizer_id = auth.uid()
  );
$$;

grant execute on function public.is_circle_member(uuid) to authenticated;

-- =============================================================================
-- Part C: hide the member roster of private circles from non-members.
--
-- circles.member_count is a denormalised column on `circles` and is NOT
-- affected — a non-member still sees HOW MANY members there are, just not WHO.
-- That is deliberate.
--
-- The unconditional `user_id = auth.uid()` arm is load-bearing: several other
-- policies (events INSERT, the storage cover policies) test membership by
-- selecting the CALLER'S OWN circle_members row. Removing that arm would break
-- them.
-- =============================================================================

drop policy if exists "circle_members readable by authenticated" on public.circle_members;

create policy "circle_members readable when permitted"
  on public.circle_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.circles c
      where c.id = circle_id and c.type = 'open'
    )
    or public.is_circle_member(circle_id)
  );

-- =============================================================================
-- Part D: hide the events of private circles from non-members.
--
-- Events with circle_id IS NULL are community / coffee-chat events and must
-- stay visible to everyone — see migration 41, which added that case.
-- =============================================================================

drop policy if exists "events readable by authenticated" on public.events;

create policy "events readable when permitted"
  on public.events for select to authenticated
  using (
    circle_id is null
    or exists (
      select 1 from public.circles c
      where c.id = events.circle_id and c.type = 'open'
    )
    or public.is_circle_member(events.circle_id)
  );

-- =============================================================================
-- Part E: attendee lists follow their event.
--
-- The nested subquery on `events` is itself subject to the policy in Part D, so
-- a non-member's lookup returns no row and the attendee rows are denied. Own
-- RSVPs stay visible so cancel-RSVP keeps working.
-- =============================================================================

drop policy if exists "event_attendees readable by authenticated" on public.event_attendees;

create policy "event_attendees readable when permitted"
  on public.event_attendees for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_attendees.event_id
    )
  );
