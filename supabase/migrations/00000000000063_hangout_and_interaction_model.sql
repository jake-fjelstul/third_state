-- =============================================================================
-- Migration: Hangout and Interaction Model with Trigger & Backfill
-- =============================================================================

-- 1. Add last_interaction_at to public.connections
alter table public.connections
  add column if not exists last_interaction_at timestamptz;

create index if not exists idx_connections_user_last_interaction
  on public.connections (user_id, last_interaction_at desc nulls last);

-- 2. Add source to public.events
alter table public.events
  add column if not exists source text not null default 'circle' check (source in ('circle', 'coffee'));

-- 3. Replace accept_coffee_invite setting source = 'coffee'
create or replace function public.accept_coffee_invite(
  p_message_id uuid,
  p_title text,
  p_date text,
  p_time text,
  p_location text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_location_address text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg public.messages;
  v_inviter_id uuid;
  v_iso timestamptz;
  v_t text;
  v_event_id uuid;
  v_payload jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_msg from public.messages where id = p_message_id;
  if not found then raise exception 'Invite message not found'; end if;

  if not exists (
    select 1 from public.chat_members
    where chat_id = v_msg.chat_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this chat';
  end if;

  v_inviter_id := v_msg.sender_id;
  if v_inviter_id is null and v_msg.payload is not null then
    v_inviter_id := (v_msg.payload->>'inviterId')::uuid;
  end if;

  v_t := coalesce(nullif(p_time, ''), '10:00');
  v_iso := (p_date || 'T' || v_t || ':00')::timestamptz;

  insert into public.events (
    title, starts_at, location, location_lat, location_lng, location_address, notes, created_by, source
  ) values (
    p_title, v_iso, nullif(p_location, ''), p_location_lat, p_location_lng, nullif(p_location_address, ''), nullif(p_notes, ''), v_uid, 'coffee'
  ) returning id into v_event_id;

  -- RSVP accepting user
  insert into public.event_attendees (event_id, user_id)
  values (v_event_id, v_uid)
  on conflict do nothing;

  -- RSVP inviter
  if v_inviter_id is not null and v_inviter_id <> v_uid then
    insert into public.event_attendees (event_id, user_id)
    values (v_event_id, v_inviter_id)
    on conflict do nothing;
  end if;

  -- Update message payload
  v_payload := coalesce(v_msg.payload, '{}'::jsonb) || jsonb_build_object(
    'status', 'accepted',
    'eventId', v_event_id,
    'acceptedAt', now(),
    'acceptedBy', v_uid
  );

  update public.messages set payload = v_payload where id = p_message_id;

  return v_event_id;
end; $$;

grant execute on function public.accept_coffee_invite(uuid, text, text, text, text, double precision, double precision, text, text) to authenticated;

-- 4. Trigger to update connections last_hangout and last_interaction_at on attendance
create or replace function public.write_hangout_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_when timestamptz;
begin
  select coalesce(starts_at, now()) into v_when
  from public.events
  where id = NEW.event_id;

  if v_when is null then
    v_when := now();
  end if;

  update public.connections c
  set last_hangout = greatest(coalesce(c.last_hangout, '-infinity'::timestamptz), v_when),
      last_interaction_at = greatest(coalesce(c.last_interaction_at, '-infinity'::timestamptz), v_when)
  where (
    (c.user_id = NEW.user_id and c.connected_user_id in (
      select ea.user_id
      from public.event_attendees ea
      where ea.event_id = NEW.event_id
        and ea.user_id <> NEW.user_id
        and ea.attended = true
    ))
    or
    (c.connected_user_id = NEW.user_id and c.user_id in (
      select ea.user_id
      from public.event_attendees ea
      where ea.event_id = NEW.event_id
        and ea.user_id <> NEW.user_id
        and ea.attended = true
    ))
  );

  return NEW;
end;
$$;

drop trigger if exists trg_write_hangout_from_attendance on public.event_attendees;
create trigger trg_write_hangout_from_attendance
  after update of attended on public.event_attendees
  for each row
  when (new.attended is true and old.attended is distinct from true)
  execute procedure public.write_hangout_from_attendance();

-- 5. RPC to promote elapsed coffee chat attendance
create or replace function public.promote_elapsed_coffee_attendance()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_attendees ea
  set attended = true
  from public.events e
  where ea.event_id = e.id
    and e.source = 'coffee'
    and e.starts_at < now() - interval '2 hours'
    and ea.attended is null;
end;
$$;

grant execute on function public.promote_elapsed_coffee_attendance() to authenticated;

-- 6. Trigger to update connections last_interaction_at on DM message insert
create or replace function public.write_interaction_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_type text;
  v_other_user_id uuid;
  v_msg_time timestamptz;
begin
  if NEW.sender_id is null then
    return NEW;
  end if;

  select type into v_chat_type
  from public.chats
  where id = NEW.chat_id;

  if v_chat_type <> 'dm' or v_chat_type is null then
    return NEW;
  end if;

  select user_id into v_other_user_id
  from public.chat_members
  where chat_id = NEW.chat_id
    and user_id <> NEW.sender_id
  limit 1;

  if v_other_user_id is null then
    return NEW;
  end if;

  v_msg_time := coalesce(NEW.created_at, now());

  update public.connections c
  set last_interaction_at = greatest(coalesce(c.last_interaction_at, '-infinity'::timestamptz), v_msg_time)
  where (c.user_id = NEW.sender_id and c.connected_user_id = v_other_user_id)
     or (c.user_id = v_other_user_id and c.connected_user_id = NEW.sender_id);

  return NEW;
end;
$$;

drop trigger if exists trg_write_interaction_from_message on public.messages;
create trigger trg_write_interaction_from_message
  after insert on public.messages
  for each row
  execute procedure public.write_interaction_from_message();

-- 7. Backfill existing data
-- Part A: Backfill last_hangout and last_interaction_at from attended event pairs
with event_hangouts as (
  select
    ea1.user_id as user1_id,
    ea2.user_id as user2_id,
    max(coalesce(e.starts_at, now())) as latest_hangout
  from public.event_attendees ea1
  join public.event_attendees ea2 on ea1.event_id = ea2.event_id and ea1.user_id <> ea2.user_id
  join public.events e on e.id = ea1.event_id
  where ea1.attended = true
    and ea2.attended = true
  group by ea1.user_id, ea2.user_id
)
update public.connections c
set last_hangout = greatest(coalesce(c.last_hangout, '-infinity'::timestamptz), h.latest_hangout),
    last_interaction_at = greatest(coalesce(c.last_interaction_at, '-infinity'::timestamptz), h.latest_hangout)
from event_hangouts h
where c.user_id = h.user1_id
  and c.connected_user_id = h.user2_id;

-- Part B: Backfill last_interaction_at from DM messages
with dm_interactions as (
  select
    cm1.user_id as user1_id,
    cm2.user_id as user2_id,
    max(coalesce(m.created_at, now())) as latest_msg_time
  from public.messages m
  join public.chats ch on ch.id = m.chat_id and ch.type = 'dm'
  join public.chat_members cm1 on cm1.chat_id = m.chat_id
  join public.chat_members cm2 on cm2.chat_id = m.chat_id and cm2.user_id <> cm1.user_id
  group by cm1.user_id, cm2.user_id
)
update public.connections c
set last_interaction_at = greatest(coalesce(c.last_interaction_at, '-infinity'::timestamptz), dm.latest_msg_time)
from dm_interactions dm
where c.user_id = dm.user1_id
  and c.connected_user_id = dm.user2_id;
