-- 067: Security hardening (audit C1–C6, C8, C9) + server-side battery (M4, M5)
--
-- Every exploit in bug-audit-2026-10-14 that is fixable in SQL is closed here.
-- C7 (Google OAuth state) is fixed in the google-calendar edge function.
-- C8 game validation moves to the game-move edge function; this migration
-- removes every client-side write path to public.games except resign.

-- ============================================================================
-- C1. Chat membership can only be created by SECURITY DEFINER code
-- ============================================================================

drop policy if exists "user adds self to chat" on public.chat_members;
drop policy if exists "user updates own chat membership" on public.chat_members;
create policy "user updates own chat membership"
  on public.chat_members for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Only read-state columns are client-writable (markRead, hide/unhide).
revoke update on public.chat_members from authenticated, anon;
grant update (last_read_at, hidden_at) on public.chat_members to authenticated;

-- Chats are only ever created by definer code (start_dm, circle triggers).
drop policy if exists "auth user creates chat" on public.chats;

-- ensure_dm_chat takes two arbitrary user ids: internal only.
revoke execute on function public.ensure_dm_chat(uuid, uuid) from public, anon, authenticated;

-- start_dm: only between people who are connected or share a circle, and
-- never across a block.
create or replace function public.start_dm(p_peer_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_peer_id is null or v_uid = p_peer_id then
    raise exception 'Cannot DM yourself';
  end if;
  if public.is_blocked_with(p_peer_id) then
    raise exception 'You can''t message this person';
  end if;

  -- An existing DM can always be reopened.
  if not exists (
    select 1
      from public.chat_members a
      join public.chat_members b on b.chat_id = a.chat_id
      join public.chats c on c.id = a.chat_id
     where a.user_id = v_uid and b.user_id = p_peer_id and c.type = 'dm'
  ) and not public.are_connected(v_uid, p_peer_id)
    and not exists (
      select 1
        from public.circle_members m1
        join public.circle_members m2 on m2.circle_id = m1.circle_id
       where m1.user_id = v_uid and m2.user_id = p_peer_id
    ) then
    raise exception 'You can only message connections or people in your circles';
  end if;

  return public.ensure_dm_chat(v_uid, p_peer_id);
end;
$$;

revoke execute on function public.start_dm(uuid) from public, anon;
grant execute on function public.start_dm(uuid) to authenticated;

-- ============================================================================
-- C2. circle_members insert policy compared the subquery row to itself
-- ============================================================================

drop policy if exists "join open or via approved app or organizer" on public.circle_members;
create policy "join open or via approved app or organizer"
  on public.circle_members for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.circles c
               where c.id = circle_members.circle_id and c.type = 'open')
      or exists (select 1 from public.applications a
                  where a.circle_id = circle_members.circle_id
                    and a.applicant_id = auth.uid()
                    and a.status = 'approved')
      or exists (select 1 from public.circles c
                  where c.id = circle_members.circle_id and c.organizer_id = auth.uid())
    )
  );

-- ============================================================================
-- C3. Invite codes: no listing, no client minting
-- ============================================================================

drop policy if exists "invites: public reads by code" on public.invites;
drop policy if exists "invites: inviter creates own" on public.invites;

-- Preview exactly one code, returning only what the join page displays.
create or replace function public.preview_invite(p_code text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
           'kind', i.kind,
           'circle_name', c.name,
           'inviter_name', p.name
         )
    from public.invites i
    left join public.circles c on c.id = i.circle_id
    left join public.profiles p on p.id = i.inviter_id
   where i.code = p_code
     and i.expires_at > now()
   limit 1;
$$;

revoke execute on function public.preview_invite(text) from public;
grant execute on function public.preview_invite(text) to anon, authenticated;

-- ============================================================================
-- C4. Connection requests: inserts are pending only, never across a block;
--     recipients can only accept/decline.
-- ============================================================================

drop policy if exists "users send their own requests" on public.connection_requests;
create policy "users send their own requests"
  on public.connection_requests for insert to authenticated
  with check (
    auth.uid() = requester_id
    and requester_id <> recipient_id
    and status = 'pending'
    and not public.is_blocked_with(recipient_id)
  );

drop policy if exists "recipient updates request status" on public.connection_requests;
create policy "recipient updates request status"
  on public.connection_requests for update to authenticated
  using (auth.uid() = recipient_id)
  with check (
    auth.uid() = recipient_id
    and status in ('accepted', 'declined')
    and not public.is_blocked_with(requester_id)
  );

revoke update on public.connection_requests from authenticated, anon;
grant update (status, responded_at) on public.connection_requests to authenticated;

-- ============================================================================
-- C5. Spontaneous questions require chat membership
-- ============================================================================

create or replace function public.ask_spontaneous_question(p_chat_id uuid, p_question text, p_my_answer text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_recipient_id uuid;
  v_q_clean text;
  v_a_clean text;
  v_chat_type text;
  v_sq_id uuid;
  v_asker_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_chat_member(p_chat_id) then
    raise exception 'Not a member of this chat';
  end if;

  v_q_clean := trim(coalesce(p_question, ''));
  v_a_clean := trim(coalesce(p_my_answer, ''));
  if v_q_clean = '' or v_a_clean = '' then
    raise exception 'Question and answer are both required';
  end if;

  select type into v_chat_type from public.chats where id = p_chat_id;
  if v_chat_type is null or v_chat_type <> 'dm' then
    raise exception 'Spontaneous questions can only be sent in 1-on-1 chats';
  end if;

  select user_id into v_recipient_id from public.chat_members
    where chat_id = p_chat_id and user_id <> v_uid limit 1;
  if v_recipient_id is null then
    raise exception 'Recipient not found in chat';
  end if;

  if public.is_blocked_with(v_recipient_id) then
    raise exception 'You can''t message this person';
  end if;

  if exists (
    select 1 from public.spontaneous_questions
    where chat_id = p_chat_id and status = 'pending' and expires_at > now()
  ) then
    raise exception 'A pending question already exists in this chat';
  end if;

  insert into public.spontaneous_questions (
    chat_id, asker_id, recipient_id, question_text, asker_answer
  ) values (
    p_chat_id, v_uid, v_recipient_id, v_q_clean, v_a_clean
  ) returning id into v_sq_id;

  select name into v_asker_name from public.profiles where id = v_uid;

  perform public.enqueue_notification(
    v_recipient_id,
    'spontaneous_question',
    jsonb_build_object(
      'chatId', p_chat_id,
      'name', v_asker_name,
      'message', 'asked you a question.'
    )
  );

  return v_sq_id;
end; $$;

-- ============================================================================
-- C6. Background jobs, admin helper and battery are server-only
-- ============================================================================

revoke execute on function public.drain_battery_for_stale_connections() from public, anon, authenticated;
revoke execute on function public.emit_reconnect_nudges() from public, anon, authenticated;
revoke execute on function public.emit_event_reminders() from public, anon, authenticated;
revoke execute on function public.promote_elapsed_coffee_attendance() from public, anon, authenticated;
revoke execute on function public._admin_activity(date) from public, anon, authenticated;
revoke execute on function public.adjust_battery(int, text) from public, anon, authenticated;

-- Profiles: clients cannot write server-owned columns. Definer functions run
-- as the table owner, so they are unaffected.
alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();

create or replace function public.guard_profile_server_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.battery_points := 40;
    new.last_active_date := current_date;
    new.last_seen_at := now();
    new.created_at := now();
    return new;
  end if;

  new.id := old.id;
  new.battery_points := old.battery_points;
  new.last_active_date := old.last_active_date;
  new.last_seen_at := old.last_seen_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_server_columns on public.profiles;
create trigger trg_guard_profile_server_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_server_columns();

-- ---------- Server-side battery (M4, M5) ----------

-- One row per award that may only be granted once (per circle, per event).
create table if not exists public.battery_awards (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  ref_id     uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);
alter table public.battery_awards enable row level security;
-- No policies: only definer code reads or writes it.

create or replace function public._battery_apply(p_user_id uuid, p_points int, p_reason text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_next int;
begin
  update public.profiles
     set battery_points = greatest(0, least(100, coalesce(battery_points, 0) + p_points)),
         updated_at = now()
   where id = p_user_id
  returning battery_points into v_next;

  if v_next is not null then
    insert into public.battery_history (user_id, points, reason, result)
    values (p_user_id, p_points, p_reason, v_next);
  end if;
  return v_next;
end;
$$;
revoke execute on function public._battery_apply(uuid, int, text) from public, anon, authenticated;

-- +15 the first time you join a given circle (rejoining earns nothing).
create or replace function public.award_battery_for_circle_join()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.battery_awards (user_id, kind, ref_id)
  values (new.user_id, 'circle_join', new.circle_id)
  on conflict do nothing;
  if found then
    perform public._battery_apply(new.user_id, 15, 'Joined a new circle');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_battery_on_circle_join on public.circle_members;
create trigger trg_battery_on_circle_join
  after insert on public.circle_members
  for each row execute function public.award_battery_for_circle_join();

-- +5 per text message, at most 3 times per app day.
create or replace function public.award_battery_for_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_today_count int;
begin
  if new.sender_id is null or coalesce(new.kind, 'text') <> 'text' then
    return new;
  end if;

  select count(*) into v_today_count
    from public.battery_history
   where user_id = new.sender_id
     and reason = 'Sent a message'
     and created_at >= (public.app_day()::timestamp at time zone 'America/New_York');

  if v_today_count < 3 then
    perform public._battery_apply(new.sender_id, 5, 'Sent a message');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_battery_on_message on public.messages;
create trigger trg_battery_on_message
  after insert on public.messages
  for each row execute function public.award_battery_for_message();

-- +20 the first time you're marked as attending a given event.
create or replace function public.award_battery_for_attendance()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.attended = true and (old.attended is null or old.attended = false) then
    insert into public.battery_awards (user_id, kind, ref_id)
    values (new.user_id, 'event_attended', new.event_id)
    on conflict do nothing;
    if found then
      perform public._battery_apply(new.user_id, 20, 'Attended an event');
    end if;
  end if;
  return new;
end;
$$;

-- Inactivity drain, driven by a server timestamp instead of per-device
-- localStorage. Call once per app launch; returns the current battery.
create or replace function public.apply_inactivity_drain()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_days int;
  v_drain int;
  v_points int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select last_seen_at, battery_points into v_last, v_points
    from public.profiles where id = v_uid for update;
  if not found then return null; end if;

  v_days := floor(extract(epoch from (now() - coalesce(v_last, now()))) / 86400)::int;

  update public.profiles
     set last_seen_at = now(), last_active_date = current_date
   where id = v_uid;

  if v_days >= 1 then
    v_drain := least(v_days * 8, 40);
    v_points := public._battery_apply(
      v_uid, -v_drain,
      v_days || ' day' || case when v_days = 1 then '' else 's' end || ' inactive'
    );
  end if;

  return v_points;
end;
$$;

revoke execute on function public.apply_inactivity_drain() from public, anon;
grant execute on function public.apply_inactivity_drain() to authenticated;

-- ============================================================================
-- C8. No direct writes to games; moves go through the game-move edge function
-- ============================================================================

drop policy if exists "games: players update" on public.games;
revoke update, insert, delete on public.games from authenticated, anon;
revoke execute on function public.commit_game_move(uuid, jsonb, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'commit_game_move'
                and pg_get_function_identity_arguments(p.oid) = 'p_game_id uuid, p_new_state jsonb') then
    execute 'revoke execute on function public.commit_game_move(uuid, jsonb) from public, anon, authenticated';
  end if;
end $$;

-- ============================================================================
-- C9. Message payloads and event storage
-- ============================================================================

-- Coffee invites are accepted/declined only through these RPCs; the generic
-- payload overwrite is removed.
revoke execute on function public.update_message_payload(uuid, jsonb) from public, anon, authenticated;

-- Accept a coffee invite. p_starts_at is computed on the client in the user's
-- own time zone (fixes H2), and the message row is locked so double taps and
-- two devices can't book twice.
drop function if exists public.accept_coffee_invite(uuid, text, text, text, text, double precision, double precision, text, text);

create or replace function public.accept_coffee_invite(
  p_message_id uuid,
  p_starts_at timestamptz,
  p_title text,
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
  v_event_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_starts_at is null then raise exception 'Missing start time'; end if;

  select * into v_msg from public.messages where id = p_message_id for update;
  if not found then raise exception 'Invite message not found'; end if;
  if v_msg.kind <> 'coffee_invite' then raise exception 'Not a coffee invite'; end if;

  if not public.is_chat_member(v_msg.chat_id) then
    raise exception 'Not a member of this chat';
  end if;

  v_inviter_id := coalesce(v_msg.sender_id, (v_msg.payload->>'inviterId')::uuid);
  if v_inviter_id = v_uid then
    raise exception 'You can''t accept your own invite';
  end if;

  if coalesce(v_msg.payload->>'status', 'pending') <> 'pending' then
    -- Idempotent for the accepter; an error for anything else.
    if v_msg.payload->>'status' = 'accepted' and (v_msg.payload->>'acceptedBy')::uuid = v_uid then
      return (v_msg.payload->>'eventId')::uuid;
    end if;
    raise exception 'This invite is no longer pending';
  end if;

  insert into public.events (
    title, starts_at, location, location_lat, location_lng, location_address, notes, created_by, source
  ) values (
    p_title, p_starts_at, nullif(p_location, ''), p_location_lat, p_location_lng,
    nullif(p_location_address, ''), nullif(p_notes, ''), v_uid, 'coffee'
  ) returning id into v_event_id;

  insert into public.event_attendees (event_id, user_id)
  values (v_event_id, v_uid)
  on conflict do nothing;

  if v_inviter_id is not null then
    insert into public.event_attendees (event_id, user_id)
    values (v_event_id, v_inviter_id)
    on conflict do nothing;
  end if;

  update public.messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'status', 'accepted',
           'eventId', v_event_id,
           'startsAt', p_starts_at,
           'acceptedAt', now(),
           'acceptedBy', v_uid
         )
   where id = p_message_id;

  return v_event_id;
end; $$;

revoke execute on function public.accept_coffee_invite(uuid, timestamptz, text, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.accept_coffee_invite(uuid, timestamptz, text, text, double precision, double precision, text, text) to authenticated;

create or replace function public.decline_coffee_invite(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg public.messages;
  v_inviter_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_msg from public.messages where id = p_message_id for update;
  if not found then raise exception 'Invite message not found'; end if;
  if v_msg.kind <> 'coffee_invite' then raise exception 'Not a coffee invite'; end if;
  if not public.is_chat_member(v_msg.chat_id) then
    raise exception 'Not a member of this chat';
  end if;

  v_inviter_id := coalesce(v_msg.sender_id, (v_msg.payload->>'inviterId')::uuid);
  if coalesce(v_msg.payload->>'status', 'pending') <> 'pending' then
    raise exception 'This invite is no longer pending';
  end if;

  update public.messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'status', case when v_inviter_id = v_uid then 'cancelled' else 'declined' end,
           'declinedAt', now(),
           'declinedBy', v_uid
         )
   where id = p_message_id;
end; $$;

revoke execute on function public.decline_coffee_invite(uuid) from public, anon;
grant execute on function public.decline_coffee_invite(uuid) to authenticated;

-- Event covers: only the event's creator writes <eventId>/...
drop policy if exists "event-covers: authenticated insert" on storage.objects;
drop policy if exists "event-covers: authenticated update" on storage.objects;
drop policy if exists "event-covers: authenticated delete" on storage.objects;

create or replace function public.is_event_creator(p_event_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.created_by = auth.uid());
$$;

create or replace function public.is_event_attendee(p_event_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.created_by = auth.uid())
      or exists (select 1 from public.event_attendees a where a.event_id = p_event_id and a.user_id = auth.uid());
$$;

revoke execute on function public.is_event_creator(uuid) from public, anon;
revoke execute on function public.is_event_attendee(uuid) from public, anon;
grant execute on function public.is_event_creator(uuid) to authenticated;
grant execute on function public.is_event_attendee(uuid) to authenticated;

-- Folder names that aren't uuids must not throw inside a policy.
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create policy "event-covers: creator insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers'
              and public.is_event_creator(public.try_uuid((storage.foldername(name))[1])));
create policy "event-covers: creator update"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-covers'
         and public.is_event_creator(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'event-covers'
              and public.is_event_creator(public.try_uuid((storage.foldername(name))[1])));
create policy "event-covers: creator delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers'
         and public.is_event_creator(public.try_uuid((storage.foldername(name))[1])));

-- Event photos: attendees write into <eventId>/<their uid>/...; the uploader
-- or the event creator can delete.
drop policy if exists "event-photos: authenticated insert" on storage.objects;
drop policy if exists "event-photos: authenticated update" on storage.objects;
drop policy if exists "event-photos: authenticated delete" on storage.objects;

create policy "event-photos: attendee insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos'
              and (storage.foldername(name))[2] = auth.uid()::text
              and public.is_event_attendee(public.try_uuid((storage.foldername(name))[1])));
create policy "event-photos: uploader or host delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos'
         and ((storage.foldername(name))[2] = auth.uid()::text
              or public.is_event_creator(public.try_uuid((storage.foldername(name))[1]))));
