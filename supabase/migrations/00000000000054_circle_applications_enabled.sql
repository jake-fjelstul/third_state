-- =============================================================================
-- Circles: distinguish "apply to join" from "invite only"
--
-- type='open'                            -> join instantly
-- type='private' + applications_enabled  -> apply, organizer reviews
-- type='private' + NOT applications_enabled -> invite link / QR only, and must
--                                              never surface in discovery
--
-- A circle may accept applications with ZERO hoops — that is a valid
-- "confirm and send" application, not the same as having no application flow.
-- =============================================================================

alter table public.circles
  add column if not exists applications_enabled boolean not null default false;

comment on column public.circles.applications_enabled is
  'Private circles only. When true the circle accepts applications and is '
  'discoverable. When false the circle is invite-only and must be excluded '
  'from all discovery surfaces. Meaningless for type=''open''.';

-- Backfill. Any private circle that already has hoop rows was, by the old
-- implicit rule, accepting applications.
update public.circles c
   set applications_enabled = true
 where c.type = 'private'
   and exists (select 1 from public.hoops h where h.circle_id = c.id);

-- Open circles never use the application flow. Normalise them to false so the
-- column has exactly one meaning.
update public.circles
   set applications_enabled = false
 where type = 'open';

create index if not exists idx_circles_discoverable
  on public.circles (type, applications_enabled);

-- ---------------------------------------------------------------------------
-- Tighten the applications INSERT policy.
--
-- The existing policy is only `auth.uid() = applicant_id`, so anyone can apply
-- to any circle — including invite-only ones, and open ones that have no
-- application flow at all. Gate it server-side.
--
-- This is INSERT-only, so existing application rows are unaffected.
-- ---------------------------------------------------------------------------

drop policy if exists "applicant creates own app" on public.applications;

create policy "applicant creates own app"
  on public.applications for insert to authenticated
  with check (
    auth.uid() = applicant_id
    and exists (
      select 1 from public.circles c
      where c.id = circle_id
        and c.type = 'private'
        and c.applications_enabled = true
    )
  );
