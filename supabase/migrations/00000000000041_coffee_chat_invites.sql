-- =============================================================================
-- Migration: Coffee chat invite helper functions & RLS fix
-- =============================================================================

-- 1. Fix events RLS policy to allow creating community/coffee events where circle_id IS NULL
drop policy if exists "circle members create events" on public.events;
create policy "circle members create events"
  on public.events for insert to authenticated with check (
    auth.uid() = created_by
    and (
      circle_id is null
      or exists (select 1 from public.circle_members m where m.circle_id = events.circle_id and m.user_id = auth.uid())
    )
  );

-- 2. Message payload update helper
create or replace function public.update_message_payload(p_message_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chat_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select chat_id into v_chat_id from public.messages where id = p_message_id;
  if not found then raise exception 'Message not found'; end if;

  if not exists (
    select 1 from public.chat_members where chat_id = v_chat_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this chat';
  end if;

  update public.messages set payload = p_payload where id = p_message_id;
end; $$;

grant execute on function public.update_message_payload(uuid, jsonb) to authenticated;

-- 3. Atomic RPC to accept a coffee invite, create event, RSVP both participants, and update payload
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
    title, starts_at, location, location_lat, location_lng, location_address, notes, created_by
  ) values (
    p_title, v_iso, nullif(p_location, ''), p_location_lat, p_location_lng, nullif(p_location_address, ''), nullif(p_notes, ''), v_uid
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
