-- 070: Honest availability (item 2, audit M14 is client-side)

-- Real end times. Null means "unknown"; the app then assumes 90 minutes.
alter table public.events add column if not exists ends_at timestamptz;
alter table public.events drop constraint if exists events_ends_after_starts;
alter table public.events add constraint events_ends_after_starts
  check (ends_at is null or starts_at is null or ends_at > starts_at);

-- Coffee chats are an hour.
update public.events set ends_at = starts_at + interval '60 minutes'
 where source = 'coffee' and ends_at is null and starts_at is not null;

-- Opt-in: let connections see busy blocks (never titles) from Google Calendar.
alter table public.profiles add column if not exists share_calendar_busy boolean not null default false;

-- Keep events_with_counts in step with the new column (appended last, so
-- create or replace is allowed).
create or replace view public.events_with_counts
with (security_invoker = on) as
 SELECT e.id,
    e.circle_id,
    e.title,
    e.starts_at,
    e.location,
    e.notes,
    e.created_by,
    e.created_at,
    e.location_lat,
    e.location_lng,
    e.location_address,
    e.cover_image_url,
    e.recurrence_rule,
    e.recurrence_end_date,
    e.recurrence_parent_id,
    e.updated_at,
    COALESCE(a.cnt, 0) AS attendees_count,
    COALESCE(a.attended_cnt, 0) AS attended_count,
    e.ends_at
   FROM events e
     LEFT JOIN ( SELECT event_attendees.event_id,
            count(*)::integer AS cnt,
            count(*) FILTER (WHERE event_attendees.attended = true)::integer AS attended_cnt
           FROM event_attendees
          GROUP BY event_attendees.event_id) a ON a.event_id = e.id;

-- Coffee invites accepted from now on get a 60-minute end time.
create or replace function public.set_coffee_end_time()
returns trigger
language plpgsql
as $$
begin
  if new.source = 'coffee' and new.ends_at is null and new.starts_at is not null then
    new.ends_at := new.starts_at + interval '60 minutes';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_set_coffee_end_time on public.events;
create trigger trg_set_coffee_end_time
  before insert on public.events
  for each row execute function public.set_coffee_end_time();
