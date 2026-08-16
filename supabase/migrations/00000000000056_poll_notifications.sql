-- =============================================================================
-- Polls: notify the other members of the chat.
--
-- Supersedes create_chat_poll from migration 38. Identical validation and
-- insert behaviour; the only addition is the notification fan-out at the end.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend notification preferences with a chat-activity toggle.
--
-- enqueue_notification currently recognises only 'connections', 'events' and
-- 'reconnect_nudges'. Poll and question notifications are chat-scoped and
-- deserve their own switch. Defaults to TRUE, and coalesce() means existing
-- profiles whose jsonb lacks the key behave exactly as before.
-- ---------------------------------------------------------------------------

alter table public.profiles
  alter column notification_prefs
  set default '{"connections": true, "events": true, "reconnect_nudges": true, "chat_activity": true}'::jsonb;

create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_type text,
  p_payload jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_prefs jsonb;
  v_should_enqueue boolean := true;
begin
  select notification_prefs into v_prefs from public.profiles where id = p_user_id;

  if v_prefs is not null then
    if p_type in ('connection_request', 'connection_accepted') then
      v_should_enqueue := coalesce((v_prefs->>'connections')::boolean, true);
    elsif p_type = 'event_approaching' then
      v_should_enqueue := coalesce((v_prefs->>'events')::boolean, true);
    elsif p_type = 'reconnect_nudge' then
      v_should_enqueue := coalesce((v_prefs->>'reconnect_nudges')::boolean, true);
    elsif p_type in ('poll_created', 'spontaneous_question',
                     'spontaneous_question_answered', 'question_revealed') then
      v_should_enqueue := coalesce((v_prefs->>'chat_activity')::boolean, true);
    end if;
  end if;

  if not v_should_enqueue then
    return null;
  end if;

  insert into public.notifications (user_id, type, payload, is_read)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb), false)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. create_chat_poll, with notification fan-out.
--
-- Everything above the fan-out is byte-identical to migration 38. Copy it from
-- the live function rather than retyping it, so no validation is lost.
-- ---------------------------------------------------------------------------

create or replace function public.create_chat_poll(
  p_chat_id uuid,
  p_question text,
  p_options jsonb,
  p_allow_multiple boolean default false,
  p_channel_id uuid default null
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll_id uuid;
  v_q text := btrim(p_question);
  v_name text;
  v_member uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this chat';
  end if;

  if v_q = '' then raise exception 'A poll needs a question'; end if;

  if jsonb_typeof(p_options) <> 'array'
     or jsonb_array_length(p_options) < 2
     or jsonb_array_length(p_options) > 10 then
    raise exception 'A poll needs between two and ten options';
  end if;

  insert into public.polls (chat_id, channel_id, created_by, question, options, allow_multiple)
  values (p_chat_id, p_channel_id, v_uid, v_q, p_options, coalesce(p_allow_multiple, false))
  returning id into v_poll_id;

  insert into public.messages (chat_id, channel_id, sender_id, text, kind, payload)
  values (
    p_chat_id, p_channel_id, v_uid,
    '📊 ' || v_q,
    'poll',
    jsonb_build_object('pollId', v_poll_id)
  );

  -- Fan out to the other members of the chat. Mirrors create_lfg_post.
  select name into v_name from public.profiles where id = v_uid;

  for v_member in
    select user_id from public.chat_members
     where chat_id = p_chat_id and user_id <> v_uid
  loop
    if not public.is_blocked_with(v_member) then
      perform public.enqueue_notification(
        v_member,
        'poll_created',
        jsonb_build_object(
          'user', jsonb_build_object('id', v_uid, 'name', coalesce(v_name, 'Someone')),
          'message', coalesce(v_name, 'Someone') || ' started a poll: ' || v_q,
          'chatId', p_chat_id,
          'pollId', v_poll_id
        )
      );
    end if;
  end loop;

  return v_poll_id;
end; $$;

grant execute on function public.create_chat_poll(uuid, text, jsonb, boolean, uuid) to authenticated;
