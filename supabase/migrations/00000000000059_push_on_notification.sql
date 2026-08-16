create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Push title per notification type.
-- ---------------------------------------------------------------------------
create or replace function public.push_title_for(p_type text)
returns text language sql immutable as $$
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
    else 'Third Space'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Push body. TWO payload conventions exist in this codebase and both must be
-- handled — getting it wrong yields either a nameless push or a doubled name:
--
--   lfg_post / lfg_join / poll_created -> `message` is a COMPLETE sentence that
--     already contains the actor's name. Use verbatim.
--   everything else -> `message` is a FRAGMENT ("asked you a question.") and the
--     name must be prefixed. Question types carry a bare `name` string; all
--     others nest it under `user`.
-- ---------------------------------------------------------------------------
create or replace function public.push_body_for(p_type text, p_payload jsonb)
returns text language sql immutable as $$
  select case
    when p_type in ('lfg_post', 'lfg_join', 'poll_created')
      then coalesce(p_payload->>'message', 'Tap to open')
    else btrim(
      coalesce(p_payload->>'name', p_payload->'user'->>'name', '')
      || ' ' || coalesce(p_payload->>'message', '')
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- The trigger. Fire-and-forget: it must NEVER raise and NEVER block the insert.
-- pg_net's http_post queues the request and returns immediately.
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
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_secret';

  -- Not configured (e.g. a branch database) -> silently do nothing.
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
    -- A push failure must NEVER roll back the notification insert.
    raise warning '[push_on_notification] failed for %: %', new.id, sqlerrm;
  end;

  return new;
end; $$;

drop trigger if exists trg_push_on_notification on public.notifications;

create trigger trg_push_on_notification
  after insert on public.notifications
  for each row execute procedure public.push_on_notification();
