-- =============================================================================
-- Server-side battery reward for attending an event.
-- Awards +20 points and writes a battery_history entry on every new
-- event_attendees row. Cannot be spoofed from the client.
-- =============================================================================

create or replace function public.award_battery_for_rsvp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_points int;
begin
  -- bump points (cap at 100)
  update public.profiles
    set battery_points = least(coalesce(battery_points, 0) + 20, 100)
    where id = new.user_id
  returning battery_points into v_new_points;

  -- log it
  insert into public.battery_history (user_id, points, reason, result)
  values (new.user_id, 20, 'Attending an event', coalesce(v_new_points, 20));

  return new;
end;
$$;

create trigger trg_battery_on_rsvp
  after insert on public.event_attendees
  for each row execute procedure public.award_battery_for_rsvp();

-- =============================================================================
-- View that returns each event with its RSVP count.
-- Lets us read attendees_count without a separate query per event.
-- =============================================================================
create or replace view public.events_with_counts as
select
  e.*,
  coalesce(a.cnt, 0)::int as attendees_count
from public.events e
left join (
  select event_id, count(*)::int as cnt
  from public.event_attendees
  group by event_id
) a on a.event_id = e.id;

-- The view inherits RLS from the underlying tables when accessed by
-- authenticated users (Postgres applies the SELECT policies on `events`
-- and `event_attendees`). No additional policy needed.
