-- =============================================================================
-- Reconnect nudges: for each connection where last_hangout is older than the
-- user's reconnect_threshold_days, emit one nudge — but skip if a nudge for
-- this (user, target) pair has been emitted in the last 7 days.
-- =============================================================================
create or replace function public.emit_reconnect_nudges()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_target record;
begin
  for rec in
    select c.user_id, c.connected_user_id, c.last_hangout, p.reconnect_threshold_days
    from public.connections c
    join public.profiles p on p.id = c.user_id
    where c.last_hangout is not null
      and (now() - c.last_hangout) >= make_interval(days => coalesce(p.reconnect_threshold_days, 21))
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

-- =============================================================================
-- Event reminders: for events starting in the next 24-48 hours, emit one
-- reminder per attendee — but skip if a reminder for this (user, event)
-- has been emitted already.
-- =============================================================================
create or replace function public.emit_event_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  for rec in
    select ea.user_id, e.id as event_id, e.title, e.starts_at, e.location, e.circle_id,
           c.name as circle_name
    from public.event_attendees ea
    join public.events e on e.id = ea.event_id
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
          to_char(rec.starts_at at time zone 'America/Chicago', 'HH24:MI')
        )
      )
    );
  end loop;
end; $$;

-- =============================================================================
-- Schedule both functions daily via pg_cron, if the extension is available.
-- If pg_cron isn't available, the user will need to enable it in the Supabase
-- Dashboard under Database -> Extensions, then run the schedule blocks manually.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'emit-reconnect-nudges-daily',
      '0 14 * * *',  -- 14:00 UTC daily ~= 9am Central
      $cron$ select public.emit_reconnect_nudges(); $cron$
    );
    perform cron.schedule(
      'emit-event-reminders-hourly',
      '15 * * * *',  -- every hour at :15
      $cron$ select public.emit_event_reminders(); $cron$
    );
  end if;
end $$;

-- =============================================================================
-- Realtime: add notifications to the Realtime publication so the client can
-- subscribe to INSERT/UPDATE/DELETE events.
-- =============================================================================
alter publication supabase_realtime add table public.notifications;
