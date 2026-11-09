-- 068: Phase 1 core fixes (audit H7–H10, M6, H8 push for coffee invites)

-- ============================================================================
-- M6. Per-user time zone for reminder text
-- ============================================================================

alter table public.profiles add column if not exists timezone text not null default 'America/Chicago';

create or replace function public.set_my_timezone(p_tz text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_tz is null or not exists (select 1 from pg_timezone_names where name = p_tz) then
    return; -- ignore unknown zones rather than failing sign-in
  end if;
  update public.profiles set timezone = p_tz where id = auth.uid() and timezone is distinct from p_tz;
end;
$$;
revoke execute on function public.set_my_timezone(text) from public, anon;
grant execute on function public.set_my_timezone(text) to authenticated;

create or replace function public.emit_event_reminders()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select ea.user_id, e.id as event_id, e.title, e.starts_at, e.location, e.circle_id,
           c.name as circle_name,
           coalesce(p.timezone, 'America/Chicago') as tz
    from public.event_attendees ea
    join public.events e on e.id = ea.event_id
    join public.profiles p on p.id = ea.user_id
    left join public.circles c on c.id = e.circle_id
    where e.starts_at between now() + interval '20 hours' and now() + interval '28 hours'
  loop
    if exists (
      select 1 from public.notifications n
      where n.user_id = rec.user_id
        and n.type = 'event_approaching'
        and (n.payload->'event'->>'id')::uuid = rec.event_id
    ) then
      continue;
    end if;
    perform public.enqueue_notification(
      rec.user_id,
      'event_approaching',
      jsonb_build_object(
        'event', jsonb_build_object(
          'id', rec.event_id,
          'title', rec.title,
          'startsAt', rec.starts_at,
          'location', coalesce(rec.location, ''),
          'circleId', rec.circle_id,
          'circleName', coalesce(rec.circle_name, '')
        ),
        'message', format(
          'is happening tomorrow at %s.',
          to_char(rec.starts_at at time zone rec.tz, 'FMHH12:MI AM')
        )
      )
    );
  end loop;
end; $$;
revoke execute on function public.emit_event_reminders() from public, anon, authenticated;

-- ============================================================================
-- H7. Member counts: the trigger must bypass the admins-only circles policy
-- ============================================================================

alter function public.sync_circle_member_count() security definer set search_path = public;

update public.circles c
   set member_count = coalesce(m.cnt, 0)
  from (select c2.id, count(cm.user_id) as cnt
          from public.circles c2
          left join public.circle_members cm on cm.circle_id = c2.id
         group by c2.id) m
 where m.id = c.id and c.member_count is distinct from coalesce(m.cnt, 0);

-- ============================================================================
-- H8. Coffee invites push like a text message
-- ============================================================================

create or replace function public.push_on_message()
returns trigger
language plpgsql
security definer set search_path = public, net, vault
as $$
declare
  v_url        text;
  v_secret     text;
  v_sender     text;
  v_chat_type  text;
  v_circle     text;
  v_title      text;
  v_body       text;
  v_member     record;
begin
  -- Rule 5: plain text and coffee invites. Polls, games and questions send
  -- their own notifications.
  if coalesce(new.kind, 'text') not in ('text', 'coffee_invite') then
    return new;
  end if;
  if new.sender_id is null then
    return new;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  select p.name into v_sender from public.profiles p where p.id = new.sender_id;
  select c.type, coalesce(ci.name, c.name)
    into v_chat_type, v_circle
    from public.chats c
    left join public.circles ci on ci.id = c.circle_id
   where c.id = new.chat_id;

  v_title := coalesce(v_sender, 'New message');
  if v_chat_type <> 'dm' and coalesce(v_circle, '') <> '' then
    v_title := v_title || ' · ' || v_circle;
  end if;

  if new.kind = 'coffee_invite' then
    v_body := split_part(coalesce(v_sender, 'Someone'), ' ', 1) || ' invited you for coffee'
      || coalesce(' · ' || nullif(new.payload->>'whenFormatted', ''), '');
  else
    v_body := left(btrim(coalesce(new.text, '')), 140);
  end if;
  if v_body = '' then
    return new;
  end if;

  for v_member in
    select cm.user_id
      from public.chat_members cm
      join public.profiles p on p.id = cm.user_id
     where cm.chat_id = new.chat_id
       and cm.user_id <> new.sender_id
       and coalesce((p.notification_prefs->>'messages')::boolean, true)
       and coalesce(cm.last_read_at, 'epoch'::timestamptz)
             < now() - interval '60 seconds'
  loop
    if public.is_blocked_with(v_member.user_id) then
      continue;
    end if;

    begin
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'content-type',  'application/json',
          'x-push-secret', v_secret
        ),
        body    := jsonb_build_object(
          'userId',   v_member.user_id,
          'title',    v_title,
          'body',     v_body,
          'threadId', new.chat_id,
          'data',     jsonb_build_object(
            'type',      'message',
            'chatId',    new.chat_id,
            'channelId', new.channel_id,
            'messageId', new.id
          )
        )
      );
    exception when others then
      raise warning '[push_on_message] failed for % -> %: %', new.id, v_member.user_id, sqlerrm;
    end;
  end loop;

  return new;
end; $$;

-- Realtime must deliver message UPDATEs (coffee invite status) to clients.
alter table public.messages replica identity full;

-- ============================================================================
-- H9. Applying (and re-applying after a decline) goes through one RPC
-- ============================================================================

create or replace function public.apply_to_circle(p_circle_id uuid, p_answers jsonb default '[]'::jsonb)
returns public.applications
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications;
  v_ans jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (select 1 from public.circles where id = p_circle_id and applications_enabled = true) then
    raise exception 'This circle isn''t accepting applications';
  end if;
  if exists (select 1 from public.circle_members where circle_id = p_circle_id and user_id = v_uid) then
    raise exception 'You''re already a member';
  end if;

  select * into v_app from public.applications
   where circle_id = p_circle_id and applicant_id = v_uid
   for update;

  if found then
    if v_app.status = 'pending' then
      return v_app;
    end if;
    if v_app.status = 'declined' and v_app.reviewed_at > now() - interval '24 hours' then
      raise exception 'You can re-apply 24 hours after a decline';
    end if;
    delete from public.application_answers where application_id = v_app.id;
    update public.applications
       set status = 'pending', submitted_at = now(), reviewed_at = null
     where id = v_app.id
    returning * into v_app;
  else
    insert into public.applications (circle_id, applicant_id, status)
    values (p_circle_id, v_uid, 'pending')
    returning * into v_app;
  end if;

  for v_ans in select * from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  loop
    insert into public.application_answers (application_id, hoop_id, answer)
    values (v_app.id, (v_ans->>'hoopId')::uuid, v_ans->>'answer');
  end loop;

  return v_app;
end;
$$;
revoke execute on function public.apply_to_circle(uuid, jsonb) from public, anon;
grant execute on function public.apply_to_circle(uuid, jsonb) to authenticated;

-- ============================================================================
-- H10. Sending a connection request handles every existing-row case
-- ============================================================================

create or replace function public.send_connection_request(p_recipient uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reverse public.connection_requests;
  v_mine public.connection_requests;
  v_me record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_recipient is null or p_recipient = v_uid then raise exception 'Invalid recipient'; end if;
  if public.is_blocked_with(p_recipient) then raise exception 'You can''t connect with this person'; end if;

  if public.are_connected(v_uid, p_recipient) then
    return jsonb_build_object('status', 'connected');
  end if;

  -- They already asked me: accepting is what the user means.
  select * into v_reverse from public.connection_requests
   where requester_id = p_recipient and recipient_id = v_uid and status = 'pending'
   for update;
  if found then
    update public.connection_requests
       set status = 'accepted', responded_at = now()
     where id = v_reverse.id;
    return jsonb_build_object('status', 'connected', 'request_id', v_reverse.id);
  end if;

  select * into v_mine from public.connection_requests
   where requester_id = v_uid and recipient_id = p_recipient
   for update;

  if found then
    if v_mine.status = 'pending' then
      return jsonb_build_object('status', 'pending', 'request_id', v_mine.id);
    end if;
    -- declined, or accepted-then-disconnected: ask again
    update public.connection_requests
       set status = 'pending', responded_at = null, created_at = now()
     where id = v_mine.id;

    select id, name, avatar_url into v_me from public.profiles where id = v_uid;
    perform public.enqueue_notification(
      p_recipient,
      'connection_request',
      jsonb_build_object(
        'requestId', v_mine.id,
        'user', jsonb_build_object('id', v_me.id, 'name', v_me.name, 'avatar', coalesce(v_me.avatar_url, '')),
        'message', 'wants to connect with you.'
      )
    );
    return jsonb_build_object('status', 'pending', 'request_id', v_mine.id);
  end if;

  insert into public.connection_requests (requester_id, recipient_id, status)
  values (v_uid, p_recipient, 'pending')
  returning * into v_mine;
  return jsonb_build_object('status', 'pending', 'request_id', v_mine.id);
end;
$$;
revoke execute on function public.send_connection_request(uuid) from public, anon;
grant execute on function public.send_connection_request(uuid) to authenticated;
