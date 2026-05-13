-- =============================================================================
-- THIRD SPACE — PHASE 3: Event coordinates + shared meetup helper
-- =============================================================================

-- 1) Add venue coordinates + structured address to events. The existing
--    `location` text column stays as the display name for backward compat.
alter table public.events
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_address text;

comment on column public.events.location_lat is 'Decimal degrees, set when the organizer picks a venue from autocomplete.';
comment on column public.events.location_lng is 'Decimal degrees, set when the organizer picks a venue from autocomplete.';
comment on column public.events.location_address is 'Full address string returned by the geocoder; used for maps deeplinks and richer display.';

-- 2) Recreate events_with_counts to expose the new columns.
--    (The existing view selects *, so adding columns is automatic on most setups,
--    but explicitly recreating is safer.)
drop view if exists public.events_with_counts cascade;
create view public.events_with_counts
with (security_invoker = on) as
select e.*,
       coalesce((
         select count(*)::int from public.event_attendees ea
         where ea.event_id = e.id
       ), 0) as attendees_count
from public.events e;

-- 3) Shared meetup count RPC — used by the Connection mini-card on UserProfile.
create or replace function public.shared_meetup_count(p_user_a uuid, p_user_b uuid)
returns int
language sql
security definer set search_path = public
as $$
  select count(*)::int
  from public.event_attendees ea1
  join public.event_attendees ea2 on ea1.event_id = ea2.event_id
  where ea1.user_id = p_user_a
    and ea2.user_id = p_user_b
$$;

grant execute on function public.shared_meetup_count(uuid, uuid) to authenticated;
