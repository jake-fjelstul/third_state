-- 078: "I'll be there" from the day-before event reminder (plan 1E-28).
-- The reminder's Check In button used to do nothing. It now records that the
-- attendee confirmed; "Can't make it" cancels the RSVP in the app.
alter table public.event_attendees
  add column if not exists confirmed_at timestamptz;

create or replace function public.confirm_event_attendance(p_event_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  update public.event_attendees
     set confirmed_at = coalesce(confirmed_at, now())
   where event_id = p_event_id and user_id = v_uid
  returning confirmed_at into v_at;
  if v_at is null then raise exception 'You are not going to this event'; end if;
  return v_at;
end;
$$;

revoke execute on function public.confirm_event_attendance(uuid) from public, anon;
grant execute on function public.confirm_event_attendance(uuid) to authenticated;
