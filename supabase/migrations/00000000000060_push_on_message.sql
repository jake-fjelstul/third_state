-- =============================================================================
-- Per-message push notifications
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART A: stop circle_activity from pushing.
--
-- Messages now push directly, so the throttled circle_activity row must remain
-- a NOTIFICATIONS-PAGE artifact only. Without this, every circle message
-- produces two banners.
--
-- This is a targeted edit to the function from migration 59: add one guard near
-- the top. Everything else — the vault lookups, the `net` search_path, the
-- exception block — stays EXACTLY as it is.
-- ---------------------------------------------------------------------------
create or replace function public.push_on_notification()
returns trigger
language plpgsql
security definer set search_path = public, net, vault
as $$
declare
  v_url    text;
  v_secret text;
  v_body   text;
begin
  -- Messages push via trg_push_on_message. Pushing this too would double-fire.
  if new.type = 'circle_activity' then
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

-- ---------------------------------------------------------------------------
-- PART B: add a `messages` notification preference. Defaults TRUE, and the
-- coalesce below means profiles whose jsonb lacks the key behave as before.
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column notification_prefs
  set default '{"connections": true, "events": true, "reconnect_nudges": true, "chat_activity": true, "messages": true}'::jsonb;

-- ---------------------------------------------------------------------------
-- PART C: the message trigger.
--
-- SUPPRESSION RULES, all required:
--   1. Never push to the sender.
--   2. Never push across a block.
--   3. Never push to someone who was reading that chat in the last 60 seconds.
--   4. Never push if the recipient disabled `messages` in notification_prefs.
--   5. Only push PLAIN TEXT messages. kind='poll', 'game' and the question
--      kinds all generate their own notifications already — pushing them here
--      would double-fire a second time.
--
-- Note is_blocked_with() reads auth.uid() internally, which inside this trigger
-- is the SENDER. So is_blocked_with(recipient) correctly tests the pair.
-- ---------------------------------------------------------------------------
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
  -- Rule 5: only plain text messages.
  if coalesce(new.kind, 'text') <> 'text' then
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

  -- DM  -> "Jake"                body: the message
  -- Group/circle -> "Jake · Run Club"
  v_title := coalesce(v_sender, 'New message');
  if v_chat_type <> 'dm' and coalesce(v_circle, '') <> '' then
    v_title := v_title || ' · ' || v_circle;
  end if;

  v_body := left(btrim(coalesce(new.text, '')), 140);
  if v_body = '' then
    return new;
  end if;

  for v_member in
    select cm.user_id
      from public.chat_members cm
      join public.profiles p on p.id = cm.user_id
     where cm.chat_id = new.chat_id
       and cm.user_id <> new.sender_id                                    -- rule 1
       and coalesce((p.notification_prefs->>'messages')::boolean, true)    -- rule 4
       and coalesce(cm.last_read_at, 'epoch'::timestamptz)
             < now() - interval '60 seconds'                              -- rule 3
  loop
    if public.is_blocked_with(v_member.user_id) then                       -- rule 2
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
      -- A push failure must NEVER roll back the message insert.
      raise warning '[push_on_message] failed for % -> %: %', new.id, v_member.user_id, sqlerrm;
    end;
  end loop;

  return new;
end; $$;

drop trigger if exists trg_push_on_message on public.messages;

create trigger trg_push_on_message
  after insert on public.messages
  for each row execute procedure public.push_on_message();
