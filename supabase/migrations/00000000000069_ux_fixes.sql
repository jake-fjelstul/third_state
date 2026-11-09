-- 069: Phase 2 UX fixes

-- 2.3 Saved order of "Ranked Activity" circles on the Circles tab.
alter table public.profiles add column if not exists circle_order uuid[] not null default '{}';

-- ============================================================================
-- 2.6 Real circle invites for connections (item 15)
-- ============================================================================

create table if not exists public.circle_invites (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.circles(id) on delete cascade,
  inviter_id   uuid not null references public.profiles(id) on delete cascade,
  invitee_id   uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  message_id   uuid references public.messages(id) on delete set null,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (circle_id, invitee_id)
);
create index if not exists idx_circle_invites_invitee on public.circle_invites(invitee_id, status);

alter table public.circle_invites enable row level security;
drop policy if exists "circle invites: parties read" on public.circle_invites;
create policy "circle invites: parties read"
  on public.circle_invites for select to authenticated
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);
-- No write policies: invite_to_circle / respond_circle_invite only.

create or replace function public.invite_to_circle(p_circle_id uuid, p_user_ids uuid[])
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_circle record;
  v_me record;
  v_target uuid;
  v_invite_id uuid;
  v_chat_id uuid;
  v_msg_id uuid;
  v_sent int := 0;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select id, name, type into v_circle from public.circles where id = p_circle_id;
  if not found then raise exception 'Circle not found'; end if;
  if not exists (select 1 from public.circle_members where circle_id = p_circle_id and user_id = v_uid) then
    raise exception 'Only members can invite people to this circle';
  end if;

  select id, name, avatar_url into v_me from public.profiles where id = v_uid;

  foreach v_target in array coalesce(p_user_ids, '{}'::uuid[])
  loop
    continue when v_target is null or v_target = v_uid;
    continue when not public.are_connected(v_uid, v_target);
    continue when public.is_blocked_with(v_target);
    continue when exists (select 1 from public.circle_members where circle_id = p_circle_id and user_id = v_target);

    insert into public.circle_invites (circle_id, inviter_id, invitee_id, status)
    values (p_circle_id, v_uid, v_target, 'pending')
    on conflict (circle_id, invitee_id) do update
      set inviter_id = excluded.inviter_id, status = 'pending', created_at = now(), responded_at = null
      where public.circle_invites.status <> 'pending'
    returning id into v_invite_id;

    continue when v_invite_id is null; -- already pending

    -- A rich card in the DM, with Join / Decline.
    v_chat_id := public.ensure_dm_chat(v_uid, v_target);
    insert into public.messages (chat_id, sender_id, text, kind, payload)
    values (
      v_chat_id, v_uid,
      'Invited you to join ' || v_circle.name,
      'circle_invite',
      jsonb_build_object(
        'inviteId', v_invite_id,
        'circleId', p_circle_id,
        'circleName', v_circle.name,
        'circleType', v_circle.type,
        'inviterId', v_uid,
        'inviterName', v_me.name,
        'inviteeId', v_target,
        'status', 'pending'
      )
    ) returning id into v_msg_id;
    update public.circle_invites set message_id = v_msg_id where id = v_invite_id;

    -- Notification (also pushes via push_on_notification).
    perform public.enqueue_notification(
      v_target,
      'circle_invite',
      jsonb_build_object(
        'inviteId', v_invite_id,
        'chatId', v_chat_id,
        'circle', jsonb_build_object('id', p_circle_id, 'name', v_circle.name),
        'user', jsonb_build_object('id', v_me.id, 'name', v_me.name, 'avatar', coalesce(v_me.avatar_url, '')),
        'message', 'invited you to join ' || v_circle.name || '.'
      )
    );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;
revoke execute on function public.invite_to_circle(uuid, uuid[]) from public, anon;
grant execute on function public.invite_to_circle(uuid, uuid[]) to authenticated;

create or replace function public.respond_circle_invite(p_invite_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.circle_invites;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_inv from public.circle_invites where id = p_invite_id for update;
  if not found or v_inv.invitee_id <> v_uid then raise exception 'Invite not found'; end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('status', v_inv.status, 'circle_id', v_inv.circle_id);
  end if;

  if p_accept then
    -- An invite from a member skips the application, even for private circles.
    insert into public.circle_members (circle_id, user_id, role)
    values (v_inv.circle_id, v_uid, 'member')
    on conflict do nothing;
    -- Any pending application is now moot.
    update public.applications set status = 'approved', reviewed_at = now()
     where circle_id = v_inv.circle_id and applicant_id = v_uid and status = 'pending';
  end if;

  update public.circle_invites
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = v_inv.id;

  if v_inv.message_id is not null then
    update public.messages
       set payload = coalesce(payload, '{}'::jsonb)
                     || jsonb_build_object('status', case when p_accept then 'accepted' else 'declined' end)
     where id = v_inv.message_id;
  end if;

  delete from public.notifications
   where user_id = v_uid and type = 'circle_invite' and payload->>'inviteId' = p_invite_id::text;

  return jsonb_build_object('status', case when p_accept then 'accepted' else 'declined' end,
                            'circle_id', v_inv.circle_id);
end;
$$;
revoke execute on function public.respond_circle_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_circle_invite(uuid, boolean) to authenticated;

-- ============================================================================
-- M2. Event reactions get their own notification type with a real sender
-- ============================================================================

create or replace function public.notify_on_event_reaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_sender record;
  v_title text;
begin
  if new.target_user_id is null or new.target_user_id = new.user_id then
    return new;
  end if;

  select id, name, avatar_url into v_sender from public.profiles where id = new.user_id;
  select title into v_title from public.events where id = new.event_id;

  begin
    perform public.enqueue_notification(
      new.target_user_id,
      'event_reaction',
      jsonb_build_object(
        'user', jsonb_build_object('id', v_sender.id, 'name', coalesce(nullif(btrim(v_sender.name), ''), 'Someone'), 'avatar', coalesce(v_sender.avatar_url, '')),
        'message', 'reacted ' || new.emoji || ' to you at ' || coalesce(v_title, 'an event') || '.',
        'eventId', new.event_id,
        'emoji', new.emoji
      )
    );
  exception when others then
    raise warning '[notify_on_event_reaction] failed for reaction %: %', new.id, sqlerrm;
  end;

  return new;
end; $$;

create or replace function public.push_title_for(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'connection_request'            then 'New connection request'
    when 'connection_accepted'           then 'Connection accepted'
    when 'event_approaching'             then 'Event tomorrow'
    when 'reconnect_nudge'               then 'Reconnect'
    when 'circle_activity'               then 'New message'
    when 'application_approved'          then 'Application approved'
    when 'application_declined'          then 'Application update'
    when 'lfg_post'                      then 'Free right now'
    when 'lfg_join'                      then 'Someone joined'
    when 'poll_created'                  then 'New poll'
    when 'question_revealed'             then 'Answers revealed'
    when 'spontaneous_question'          then 'New question'
    when 'spontaneous_question_answered' then 'Question answered'
    when 'circle_invite'                 then 'Circle invite'
    when 'event_reaction'                then 'New reaction'
    else 'Third Space'
  end;
$$;

-- ============================================================================
-- M1. Never push a notification that came from someone the recipient blocked
-- ============================================================================

create or replace function public.push_on_notification()
returns trigger
language plpgsql
security definer set search_path = public, net, vault
as $$
declare
  v_url    text;
  v_secret text;
  v_body   text;
  v_actor  uuid;
begin
  if new.type = 'circle_activity' then
    return new;
  end if;

  v_actor := public.try_uuid(coalesce(new.payload->'user'->>'id', new.payload->>'senderId'));
  if v_actor is not null and exists (
    select 1 from public.blocks
     where (blocker_id = new.user_id and blocked_id = v_actor)
        or (blocker_id = v_actor and blocked_id = new.user_id)
  ) then
    return new;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_secret';

  if v_url is null or v_secret is null then
    return new;
  end if;

  v_body := public.push_body_for(new.type, new.payload);
  if btrim(coalesce(v_body, '')) = '' then
    return new;
  end if;

  begin
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'content-type',  'application/json',
        'x-push-secret', v_secret
      ),
      body    := jsonb_build_object(
        'userId',   new.user_id,
        'title',    public.push_title_for(new.type),
        'body',     v_body,
        'threadId', coalesce(new.payload->>'chatId', new.type),
        'data',     jsonb_build_object(
          'notificationId', new.id,
          'type',           new.type,
          'chatId',         new.payload->>'chatId',
          'postId',         new.payload->>'postId'
        )
      )
    );
  exception when others then
    raise warning '[push_on_notification] failed for %: %', new.id, sqlerrm;
  end;

  return new;
end; $$;

-- Connection requests from blocked users never notify at all.
create or replace function public.notify_on_connection_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_requester record;
begin
  if exists (select 1 from public.blocks
              where (blocker_id = new.recipient_id and blocked_id = new.requester_id)
                 or (blocker_id = new.requester_id and blocked_id = new.recipient_id)) then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'pending' then
    select id, name, avatar_url into v_requester
      from public.profiles where id = new.requester_id;
    perform public.enqueue_notification(
      new.recipient_id,
      'connection_request',
      jsonb_build_object(
        'requestId', new.id,
        'user', jsonb_build_object(
          'id', v_requester.id,
          'name', v_requester.name,
          'avatar', coalesce(v_requester.avatar_url, '')
        ),
        'message', 'wants to connect with you.'
      )
    );
  elsif tg_op = 'UPDATE' and new.status <> old.status and new.status = 'accepted' then
    select id, name, avatar_url into v_requester
      from public.profiles where id = new.recipient_id;
    perform public.enqueue_notification(
      new.requester_id,
      'connection_accepted',
      jsonb_build_object(
        'user', jsonb_build_object(
          'id', v_requester.id,
          'name', v_requester.name,
          'avatar', coalesce(v_requester.avatar_url, '')
        ),
        'message', 'accepted your connection request.'
      )
    );
  end if;
  return new;
end; $$;
