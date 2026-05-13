-- Up migration for Phase 2 (Intents and Notifications)

-- Add new columns for intents and notifications
alter table public.profiles
  add column if not exists intent_captured_at timestamptz,
  add column if not exists intent_note text,
  add column if not exists notification_prefs jsonb default '{"connections": true, "events": true, "reconnect_nudges": true}'::jsonb;

-- Update enqueue_notification to respect notification_prefs
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
  -- Fetch notification preferences
  select notification_prefs into v_prefs from public.profiles where id = p_user_id;
  
  -- If prefs are present, check the appropriate toggle based on p_type
  if v_prefs is not null then
    if p_type in ('connection_request', 'connection_accepted') then
      v_should_enqueue := coalesce((v_prefs->>'connections')::boolean, true);
    elsif p_type = 'event_approaching' then
      v_should_enqueue := coalesce((v_prefs->>'events')::boolean, true);
    elsif p_type = 'reconnect_nudge' then
      v_should_enqueue := coalesce((v_prefs->>'reconnect_nudges')::boolean, true);
    end if;
  end if;

  if not v_should_enqueue then
    return null; -- Skip notification
  end if;

  insert into public.notifications (user_id, type, payload, is_read)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb), false)
  returning id into v_id;
  
  return v_id;
end;
$$;

-- Update emit_reconnect_nudges to fall back to created_at if last_hangout is null
create or replace function public.emit_reconnect_nudges()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_target record;
begin
  for rec in
    select c.user_id, c.connected_user_id, 
           coalesce(c.last_hangout, c.created_at) as effective_last_hangout, 
           p.reconnect_threshold_days
    from public.connections c
    join public.profiles p on p.id = c.user_id
    where (now() - coalesce(c.last_hangout, c.created_at)) >= make_interval(days => coalesce(p.reconnect_threshold_days, 21))
  loop
    -- skip if recent nudge exists
    if exists (
      select 1 from public.notifications n
      where n.user_id = rec.user_id
        and n.type = 'reconnect_nudge'
        and (n.payload->'user'->>'id')::uuid = rec.connected_user_id
        and n.created_at > now() - interval '7 days'
    ) then
      continue;
    end if;

    select id, name, avatar_url into v_target
      from public.profiles where id = rec.connected_user_id;

    perform public.enqueue_notification(
      rec.user_id,
      'reconnect_nudge',
      jsonb_build_object(
        'targetId', v_target.id,
        'user', jsonb_build_object('id', v_target.id, 'name', v_target.name, 'avatar', coalesce(v_target.avatar_url,'')),
        'message', format(
          'You haven''t hung out with %s in a while. Reach out to reconnect!',
          split_part(v_target.name, ' ', 1)
        ),
        'suggestions', jsonb_build_array(
          'Hey! Long time no see!',
          'Are you free for coffee sometime next week?',
          'It''s been a minute! How have you been?'
        )
      )
    );
  end loop;
end; $$;
