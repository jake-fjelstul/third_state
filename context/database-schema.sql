# Generated: 2026-08-18T02:08:20Z
# Commit:    fdfa49b
# Branch:    main
# Source:    live pg_dump

--
-- PostgreSQL database dump
--

\restrict m0XrNPjrygGGNVqBg785X7ckr6Hg7UIqcpUNUSCqSCCdZvszYNWv7wHq7VAS8AO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: _admin_activity(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._admin_activity(p_from date) RETURNS TABLE(day date, user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select created_at::date as day, sender_id as user_id
  from public.messages
  where sender_id is not null and created_at::date >= p_from

  union

  select joined_at::date as day, user_id
  from public.event_attendees
  where joined_at::date >= p_from

  union

  select joined_at::date as day, user_id
  from public.circle_members
  where joined_at::date >= p_from

  union

  select created_at::date as day, user_id
  from public.connections
  where created_at::date >= p_from

  union

  select created_at::date as day, user_id
  from public.battery_history
  where created_at::date >= p_from;
$$;


--
-- Name: accept_coffee_invite(uuid, text, text, text, text, double precision, double precision, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_coffee_invite(p_message_id uuid, p_title text, p_date text, p_time text, p_location text DEFAULT NULL::text, p_location_lat double precision DEFAULT NULL::double precision, p_location_lng double precision DEFAULT NULL::double precision, p_location_address text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: adjust_battery(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_battery(p_points integer, p_reason text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_next int;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set battery_points = greatest(0, least(100, coalesce(battery_points, 0) + coalesce(p_points, 0))),
      updated_at = now()
  where id = v_uid
  returning battery_points into v_next;

  if v_next is null then
    raise exception 'Profile not found';
  end if;

  insert into public.battery_history (user_id, points, reason, result)
  values (v_uid, coalesce(p_points, 0), p_reason, v_next);

  return v_next;
end;
$$;


--
-- Name: admin_circle_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_circle_stats(p_limit integer DEFAULT 100) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_limit int := coalesce(p_limit, 100);
  v_summary jsonb;
  v_rows jsonb;
  v_by_city jsonb;
  v_by_category jsonb;
  v_total bigint;
  v_open bigint;
  v_private bigint;
  v_avg_members numeric;
  v_median_members numeric;
  v_zero_events bigint;
  v_one_member bigint;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_total from public.circles;
  select count(*) into v_open from public.circles where type = 'open';
  select count(*) into v_private from public.circles where type = 'private';

  with circle_details as (
    select
      c.id,
      c.name,
      c.emoji,
      c.type,
      c.city,
      c.category,
      c.member_count,
      coalesce(cm.cnt, 0) as actual_members,
      coalesce(ev.cnt, 0) as events_count,
      coalesce(msg.cnt, 0) as messages_30d,
      coalesce(app.cnt, 0) as pending_applications,
      p.name as organizer_name,
      c.created_at
    from public.circles c
    left join (
      select circle_id, count(*) as cnt
      from public.circle_members
      group by circle_id
    ) cm on c.id = cm.circle_id
    left join (
      select circle_id, count(*) as cnt
      from public.events
      group by circle_id
    ) ev on c.id = ev.circle_id
    left join (
      select ch.circle_id, count(m.id) as cnt
      from public.chats ch
      join public.messages m on m.chat_id = ch.id
      where ch.circle_id is not null
        and m.created_at >= now() - interval '30 days'
      group by ch.circle_id
    ) msg on c.id = msg.circle_id
    left join (
      select circle_id, count(*) as cnt
      from public.applications
      where status = 'pending'
      group by circle_id
    ) app on c.id = app.circle_id
    left join public.profiles p on c.organizer_id = p.id
  )
  select
    round(coalesce(avg(actual_members), 0), 2),
    round(coalesce((percentile_cont(0.5) within group (order by actual_members))::numeric, 0), 2),
    count(*) filter (where events_count = 0),
    count(*) filter (where actual_members = 1)
  into v_avg_members, v_median_members, v_zero_events, v_one_member
  from circle_details;

  with circle_details as (
    select
      c.city,
      c.category,
      coalesce(cm.cnt, 0) as actual_members
    from public.circles c
    left join (
      select circle_id, count(*) as cnt
      from public.circle_members
      group by circle_id
    ) cm on c.id = cm.circle_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'city', coalesce(city, 'Unknown'),
      'circles', cnt,
      'members', total_m
    ) order by cnt desc
  ), '[]'::jsonb)
  into v_by_city
  from (
    select city, count(*) as cnt, sum(actual_members) as total_m
    from circle_details
    group by city
  ) t;

  with circle_details as (
    select
      c.city,
      c.category,
      coalesce(cm.cnt, 0) as actual_members
    from public.circles c
    left join (
      select circle_id, count(*) as cnt
      from public.circle_members
      group by circle_id
    ) cm on c.id = cm.circle_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'category', coalesce(category, 'Uncategorized'),
      'circles', cnt,
      'members', total_m
    ) order by cnt desc
  ), '[]'::jsonb)
  into v_by_category
  from (
    select category, count(*) as cnt, sum(actual_members) as total_m
    from circle_details
    group by category
  ) t;

  v_summary := jsonb_build_object(
    'total', coalesce(v_total, 0),
    'open', coalesce(v_open, 0),
    'private', coalesce(v_private, 0),
    'avg_members', coalesce(v_avg_members, 0.00),
    'median_members', coalesce(v_median_members, 0.00),
    'circles_with_zero_events', coalesce(v_zero_events, 0),
    'circles_with_one_member', coalesce(v_one_member, 0),
    'by_city', v_by_city,
    'by_category', v_by_category
  );

  with c_rows as (
    select
      c.id,
      c.name,
      c.emoji,
      c.type,
      c.city,
      c.category,
      c.member_count,
      coalesce(cm.cnt, 0) as actual_members,
      coalesce(ev.cnt, 0) as events_count,
      coalesce(msg.cnt, 0) as messages_30d,
      coalesce(app.cnt, 0) as pending_applications,
      p.name as organizer_name,
      c.created_at
    from public.circles c
    left join (
      select circle_id, count(*) as cnt
      from public.circle_members
      group by circle_id
    ) cm on c.id = cm.circle_id
    left join (
      select circle_id, count(*) as cnt
      from public.events
      group by circle_id
    ) ev on c.id = ev.circle_id
    left join (
      select ch.circle_id, count(m.id) as cnt
      from public.chats ch
      join public.messages m on m.chat_id = ch.id
      where ch.circle_id is not null
        and m.created_at >= now() - interval '30 days'
      group by ch.circle_id
    ) msg on c.id = msg.circle_id
    left join (
      select circle_id, count(*) as cnt
      from public.applications
      where status = 'pending'
      group by circle_id
    ) app on c.id = app.circle_id
    left join public.profiles p on c.organizer_id = p.id
    order by actual_members desc
    limit v_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'emoji', emoji,
      'type', type,
      'city', city,
      'category', category,
      'member_count', member_count,
      'actual_members', actual_members,
      'events_count', events_count,
      'messages_30d', messages_30d,
      'pending_applications', pending_applications,
      'organizer_name', organizer_name,
      'created_at', created_at
    )
  ), '[]'::jsonb)
  into v_rows
  from c_rows;

  return jsonb_build_object(
    'summary', v_summary,
    'rows', v_rows
  );
end;
$$;


--
-- Name: admin_connection_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_connection_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_sent bigint;
  v_pending bigint;
  v_accepted bigint;
  v_declined bigint;
  v_acceptance_rate numeric;
  v_avg_hours_to_respond numeric;
  
  v_total_rows bigint;
  v_unique_pairs bigint;
  v_avg_per_user numeric;
  v_median_per_user numeric;
  v_users_with_zero bigint;
  
  v_requests jsonb;
  v_connections jsonb;
  v_distribution jsonb;
  v_top_connectors jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Requests
  select
    count(*),
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'accepted'),
    count(*) filter (where status = 'declined'),
    round(coalesce(avg(extract(epoch from (responded_at - created_at)) / 3600.0) filter (where responded_at is not null), 0)::numeric, 2)
  into v_sent, v_pending, v_accepted, v_declined, v_avg_hours_to_respond
  from public.connection_requests;

  if v_sent > 0 then
    v_acceptance_rate := round((v_accepted::numeric / v_sent::numeric) * 100.0, 2);
  else
    v_acceptance_rate := 0.00;
  end if;

  v_requests := jsonb_build_object(
    'sent', coalesce(v_sent, 0),
    'pending', coalesce(v_pending, 0),
    'accepted', coalesce(v_accepted, 0),
    'declined', coalesce(v_declined, 0),
    'acceptance_rate', coalesce(v_acceptance_rate, 0.00),
    'avg_hours_to_respond', coalesce(v_avg_hours_to_respond, 0.00)
  );

  -- Connections graph stats across auth.users
  select count(*) into v_total_rows from public.connections;
  v_unique_pairs := round(v_total_rows::numeric / 2.0);

  with user_conn as (
    select u.id, coalesce(c.cnt, 0) as cnt
    from auth.users u
    left join (
      select user_id, count(*) as cnt
      from public.connections
      group by user_id
    ) c on u.id = c.user_id
  )
  select
    round(coalesce(avg(cnt), 0), 2),
    round(coalesce((percentile_cont(0.5) within group (order by cnt))::numeric, 0), 2),
    count(*) filter (where cnt = 0)
  into v_avg_per_user, v_median_per_user, v_users_with_zero
  from user_conn;

  v_connections := jsonb_build_object(
    'total_rows', coalesce(v_total_rows, 0),
    'unique_pairs', coalesce(v_unique_pairs, 0),
    'avg_per_user', coalesce(v_avg_per_user, 0.00),
    'median_per_user', coalesce(v_median_per_user, 0.00),
    'users_with_zero', coalesce(v_users_with_zero, 0)
  );

  -- Distribution
  with user_conn as (
    select u.id, coalesce(c.cnt, 0) as cnt
    from auth.users u
    left join (
      select user_id, count(*) as cnt
      from public.connections
      group by user_id
    ) c on u.id = c.user_id
  )
  select jsonb_build_array(
    jsonb_build_object('bucket', '0', 'users', count(*) filter (where cnt = 0)),
    jsonb_build_object('bucket', '1-2', 'users', count(*) filter (where cnt between 1 and 2)),
    jsonb_build_object('bucket', '3-5', 'users', count(*) filter (where cnt between 3 and 5)),
    jsonb_build_object('bucket', '6-10', 'users', count(*) filter (where cnt between 6 and 10)),
    jsonb_build_object('bucket', '11+', 'users', count(*) filter (where cnt >= 11))
  )
  into v_distribution
  from user_conn;

  -- Top connectors limit 10
  with top_conn as (
    select
      p.id,
      p.name,
      p.city,
      count(c.connected_user_id) as connection_count
    from public.connections c
    join public.profiles p on c.user_id = p.id
    group by p.id, p.name, p.city
    order by connection_count desc
    limit 10
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'city', city,
      'connection_count', connection_count
    )
  ), '[]'::jsonb)
  into v_top_connectors
  from top_conn;

  return jsonb_build_object(
    'requests', v_requests,
    'connections', v_connections,
    'distribution', v_distribution,
    'top_connectors', v_top_connectors
  );
end;
$$;


--
-- Name: admin_content_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_content_stats(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_p_days int := coalesce(p_days, 30);
  v_cutoff timestamptz := now() - (v_p_days || ' days')::interval;
  
  v_msg_total bigint;
  v_msg_in_period bigint;
  v_msg_dm bigint;
  v_msg_circle bigint;
  v_active_users_period bigint;
  v_avg_per_active_user numeric;
  v_messages_obj jsonb;
  
  v_by_kind jsonb := '[]'::jsonb;
  
  v_games_total bigint;
  v_games_in_progress bigint;
  v_games_completed bigint;
  v_games_abandoned bigint;
  v_games_by_type jsonb;
  v_games_obj jsonb;
  
  v_reports_pending bigint;
  v_reports_total bigint;
  v_blocks_total bigint;
  v_reports_by_reason jsonb;
  v_recent_reports jsonb;
  v_moderation_obj jsonb;
  
  v_notifications_rows bigint;
  v_storage_estimate_obj jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Messages
  select count(*) into v_msg_total from public.messages;
  select count(*) into v_msg_in_period from public.messages where created_at >= v_cutoff;
  
  select
    count(*) filter (where c.type = 'dm'),
    count(*) filter (where c.type = 'group')
  into v_msg_dm, v_msg_circle
  from public.messages m
  join public.chats c on m.chat_id = c.id;

  select count(distinct user_id) into v_active_users_period
  from public._admin_activity(current_date - (v_p_days - 1));

  if v_active_users_period > 0 then
    v_avg_per_active_user := round(v_msg_in_period::numeric / v_active_users_period::numeric, 2);
  else
    v_avg_per_active_user := 0.00;
  end if;

  v_messages_obj := jsonb_build_object(
    'total', coalesce(v_msg_total, 0),
    'in_period', coalesce(v_msg_in_period, 0),
    'dm', coalesce(v_msg_dm, 0),
    'circle', coalesce(v_msg_circle, 0),
    'avg_per_active_user', coalesce(v_avg_per_active_user, 0.00)
  );

  -- by_kind
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'kind'
  ) then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''kind'', kind, ''count'', cnt)), ''[]''::jsonb) from (select kind, count(*) as cnt from public.messages group by kind order by cnt desc) t'
    into v_by_kind;
  else
    v_by_kind := '[]'::jsonb;
  end if;

  -- Games
  select
    count(*),
    count(*) filter (where status = 'in_progress'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'abandoned')
  into v_games_total, v_games_in_progress, v_games_completed, v_games_abandoned
  from public.games;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type', type,
      'count', cnt
    ) order by cnt desc
  ), '[]'::jsonb)
  into v_games_by_type
  from (
    select type, count(*) as cnt
    from public.games
    group by type
  ) g_t;

  v_games_obj := jsonb_build_object(
    'total', coalesce(v_games_total, 0),
    'in_progress', coalesce(v_games_in_progress, 0),
    'completed', coalesce(v_games_completed, 0),
    'abandoned', coalesce(v_games_abandoned, 0),
    'by_type', v_games_by_type
  );

  -- Moderation
  select
    count(*),
    count(*) filter (where status = 'pending')
  into v_reports_total, v_reports_pending
  from public.reports;

  select count(*) into v_blocks_total from public.blocks;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'reason', reason,
      'count', cnt
    ) order by cnt desc
  ), '[]'::jsonb)
  into v_reports_by_reason
  from (
    select reason, count(*) as cnt
    from public.reports
    group by reason
  ) r_r;

  with rec_rep as (
    select
      r.id,
      r.reason,
      r.status,
      r.created_at,
      p_rep.name as reporter_name,
      p_target.name as reported_user_name
    from public.reports r
    left join public.profiles p_rep on r.reporter_id = p_rep.id
    left join public.profiles p_target on r.reported_user_id = p_target.id
    order by r.created_at desc
    limit 20
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'reason', reason,
      'status', status,
      'created_at', created_at,
      'reporter_name', reporter_name,
      'reported_user_name', reported_user_name
    )
  ), '[]'::jsonb)
  into v_recent_reports
  from rec_rep;

  v_moderation_obj := jsonb_build_object(
    'reports_pending', coalesce(v_reports_pending, 0),
    'reports_total', coalesce(v_reports_total, 0),
    'blocks_total', coalesce(v_blocks_total, 0),
    'reports_by_reason', v_reports_by_reason,
    'recent_reports', v_recent_reports
  );

  -- Storage Estimate
  select count(*) into v_notifications_rows from public.notifications;

  v_storage_estimate_obj := jsonb_build_object(
    'messages_rows', coalesce(v_msg_total, 0),
    'notifications_rows', coalesce(v_notifications_rows, 0)
  );

  return jsonb_build_object(
    'messages', v_messages_obj,
    'by_kind', v_by_kind,
    'games', v_games_obj,
    'moderation', v_moderation_obj,
    'storage_estimate', v_storage_estimate_obj
  );
end;
$$;


--
-- Name: admin_event_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_event_stats(p_days integer DEFAULT 90) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_p_days int := coalesce(p_days, 90);
  v_cutoff timestamptz := now() - (v_p_days || ' days')::interval;
  v_summary jsonb;
  v_by_dow jsonb;
  v_top_events jsonb;
  v_recent jsonb;
  v_total bigint;
  v_upcoming bigint;
  v_past bigint;
  v_avg_attendees numeric;
  v_median_attendees numeric;
  v_zero_attendees bigint;
  v_attendance_rate numeric;
  v_sum_attendees bigint;
  v_sum_host_members bigint;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with event_data as (
    select
      e.id,
      e.title,
      e.starts_at,
      e.location,
      e.circle_id,
      c.name as circle_name,
      p.name as creator_name,
      coalesce(ea.cnt, 0) as attendee_count,
      coalesce(c.member_count, 0) as host_members
    from public.events e
    left join public.circles c on e.circle_id = c.id
    left join public.profiles p on e.created_by = p.id
    left join (
      select event_id, count(*) as cnt
      from public.event_attendees
      group by event_id
    ) ea on e.id = ea.event_id
    where e.starts_at >= v_cutoff
  )
  select
    count(*),
    count(*) filter (where starts_at > now()),
    count(*) filter (where starts_at <= now()),
    round(coalesce(avg(attendee_count), 0), 2),
    round(coalesce((percentile_cont(0.5) within group (order by attendee_count))::numeric, 0), 2),
    count(*) filter (where attendee_count = 0),
    coalesce(sum(attendee_count), 0),
    coalesce(sum(host_members), 0)
  into v_total, v_upcoming, v_past, v_avg_attendees, v_median_attendees,
       v_zero_attendees, v_sum_attendees, v_sum_host_members
  from event_data;

  if v_sum_host_members > 0 then
    v_attendance_rate := round(v_sum_attendees::numeric / v_sum_host_members::numeric, 2);
  else
    v_attendance_rate := 0.00;
  end if;

  v_summary := jsonb_build_object(
    'total', coalesce(v_total, 0),
    'upcoming', coalesce(v_upcoming, 0),
    'past', coalesce(v_past, 0),
    'avg_attendees', coalesce(v_avg_attendees, 0.00),
    'median_attendees', coalesce(v_median_attendees, 0.00),
    'events_with_zero_attendees', coalesce(v_zero_attendees, 0),
    'attendance_rate', coalesce(v_attendance_rate, 0.00)
  );

  -- Day of week summary
  with days_spine as (
    select 0 as dow, 'Sunday' as label union all
    select 1, 'Monday' union all
    select 2, 'Tuesday' union all
    select 3, 'Wednesday' union all
    select 4, 'Thursday' union all
    select 5, 'Friday' union all
    select 6, 'Saturday'
  ),
  event_dow as (
    select
      extract(dow from e.starts_at)::int as dow,
      count(e.id) as events,
      coalesce(sum(ea.cnt), 0) as attendees
    from public.events e
    left join (
      select event_id, count(*) as cnt
      from public.event_attendees
      group by event_id
    ) ea on e.id = ea.event_id
    where e.starts_at >= v_cutoff
    group by extract(dow from e.starts_at)::int
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'dow', s.dow,
      'label', s.label,
      'events', coalesce(ed.events, 0),
      'attendees', coalesce(ed.attendees, 0)
    ) order by s.dow asc
  ), '[]'::jsonb)
  into v_by_dow
  from days_spine s
  left join event_dow ed on s.dow = ed.dow;

  -- Top events
  with top_ev as (
    select
      e.id,
      e.title,
      e.starts_at,
      c.name as circle_name,
      coalesce(ea.cnt, 0) as attendee_count
    from public.events e
    left join public.circles c on e.circle_id = c.id
    left join (
      select event_id, count(*) as cnt
      from public.event_attendees
      group by event_id
    ) ea on e.id = ea.event_id
    where e.starts_at >= v_cutoff
    order by attendee_count desc
    limit 10
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'starts_at', starts_at,
      'circle_name', circle_name,
      'attendee_count', attendee_count
    )
  ), '[]'::jsonb)
  into v_top_events
  from top_ev;

  -- Recent events
  with recent_ev as (
    select
      e.id,
      e.title,
      e.starts_at,
      e.location,
      c.name as circle_name,
      p.name as creator_name,
      coalesce(ea.cnt, 0) as attendee_count,
      (e.starts_at > now()) as is_upcoming
    from public.events e
    left join public.circles c on e.circle_id = c.id
    left join public.profiles p on e.created_by = p.id
    left join (
      select event_id, count(*) as cnt
      from public.event_attendees
      group by event_id
    ) ea on e.id = ea.event_id
    where e.starts_at >= v_cutoff
    order by e.starts_at desc
    limit 25
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'starts_at', starts_at,
      'location', location,
      'circle_name', circle_name,
      'creator_name', creator_name,
      'attendee_count', attendee_count,
      'is_upcoming', is_upcoming
    )
  ), '[]'::jsonb)
  into v_recent
  from recent_ev;

  return jsonb_build_object(
    'summary', v_summary,
    'by_day_of_week', v_by_dow,
    'top_events', v_top_events,
    'recent', v_recent
  );
end;
$$;


--
-- Name: admin_growth_series(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_growth_series(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_p_days int := coalesce(p_days, 30);
  v_series jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'day', d.day_date,
      'signups', coalesce(su.cnt, 0),
      'active_users', coalesce(act.cnt, 0),
      'messages', coalesce(msg.cnt, 0),
      'events_created', coalesce(ev.cnt, 0),
      'connections', coalesce(conn.cnt, 0),
      'circle_joins', coalesce(cj.cnt, 0)
    ) order by d.day_date asc
  ), '[]'::jsonb)
  into v_series
  from (
    select generate_series(
      current_date - (v_p_days - 1),
      current_date,
      '1 day'::interval
    )::date as day_date
  ) d
  left join (
    select created_at::date as day, count(*) as cnt
    from auth.users
    where created_at::date >= current_date - (v_p_days - 1)
    group by created_at::date
  ) su on d.day_date = su.day
  left join (
    select day, count(distinct user_id) as cnt
    from public._admin_activity(current_date - (v_p_days - 1))
    group by day
  ) act on d.day_date = act.day
  left join (
    select created_at::date as day, count(*) as cnt
    from public.messages
    where created_at::date >= current_date - (v_p_days - 1)
    group by created_at::date
  ) msg on d.day_date = msg.day
  left join (
    select created_at::date as day, count(*) as cnt
    from public.events
    where created_at::date >= current_date - (v_p_days - 1)
    group by created_at::date
  ) ev on d.day_date = ev.day
  left join (
    select created_at::date as day, count(*) as cnt
    from public.connections
    where created_at::date >= current_date - (v_p_days - 1)
    group by created_at::date
  ) conn on d.day_date = conn.day
  left join (
    select joined_at::date as day, count(*) as cnt
    from public.circle_members
    where joined_at::date >= current_date - (v_p_days - 1)
    group by joined_at::date
  ) cj on d.day_date = cj.day;

  return jsonb_build_object('series', v_series);
end;
$$;


--
-- Name: admin_onboarding_funnel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_onboarding_funnel() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_total_users bigint;
  v_s1 bigint;
  v_s2 bigint;
  v_s3 bigint;
  v_s4 bigint;
  v_s5 bigint;
  v_s6 bigint;
  v_s7 bigint;
  v_s8 bigint;
  v_s9 bigint;

  v_steps jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_s1 from auth.users;
  v_total_users := v_s1;

  select count(*) into v_s2 from public.profiles where name is not null and city is not null;
  select count(*) into v_s3 from public.profiles where avatar_url is not null;
  select count(*) into v_s4 from public.profiles where bio is not null and length(trim(bio)) > 0;
  select count(*) into v_s5 from public.profiles where array_length(interests, 1) >= 1;
  select count(*) into v_s6 from public.profiles where array_length(intents, 1) >= 1;
  select count(distinct user_id) into v_s7 from public.circle_members;
  select count(distinct user_id) into v_s8 from public.event_attendees;
  select count(distinct user_id) into v_s9 from public.connections;

  v_steps := jsonb_build_array(
    jsonb_build_object(
      'step', 1,
      'label', 'Account created',
      'users', coalesce(v_s1, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s1::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', 100.0
    ),
    jsonb_build_object(
      'step', 2,
      'label', 'Profile basics',
      'users', coalesce(v_s2, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s2::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s1 > 0 then round((v_s2::numeric / v_s1::numeric) * 100.0, 1) else 0.0 end
    ),
    jsonb_build_object(
      'step', 3,
      'label', 'Added avatar',
      'users', coalesce(v_s3, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s3::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s2 > 0 then round((v_s3::numeric / v_s2::numeric) * 100.0, 1) else 0.0 end
    ),
    jsonb_build_object(
      'step', 4,
      'label', 'Added bio',
      'users', coalesce(v_s4, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s4::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s3 > 0 then round((v_s4::numeric / v_s3::numeric) * 100.0, 1) else 0.0 end
    ),
    jsonb_build_object(
      'step', 5,
      'label', 'Picked interests',
      'users', coalesce(v_s5, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s5::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s4 > 0 then round((v_s5::numeric / v_s4::numeric) * 100.0, 1) else 0.0 end
    ),
    jsonb_build_object(
      'step', 6,
      'label', 'Set intents',
      'users', coalesce(v_s6, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s6::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s5 > 0 then round((v_s6::numeric / v_s5::numeric) * 100.0, 1) else 0.0 end
    ),
    jsonb_build_object(
      'step', 7,
      'label', 'Joined a circle',
      'users', coalesce(v_s7, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s7::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s6 > 0 then round((v_s7::numeric / v_s6::numeric) * 100.0, 1) else 0.0 end
    ),
    jsonb_build_object(
      'step', 8,
      'label', 'RSVP''d to an event',
      'users', coalesce(v_s8, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s8::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s7 > 0 then round((v_s8::numeric / v_s7::numeric) * 100.0, 1) else 0.0 end
    ),
    jsonb_build_object(
      'step', 9,
      'label', 'Made a connection',
      'users', coalesce(v_s9, 0),
      'pct_of_total', case when v_total_users > 0 then round((v_s9::numeric / v_total_users::numeric) * 100.0, 1) else 0.0 end,
      'pct_of_previous', case when v_s8 > 0 then round((v_s9::numeric / v_s8::numeric) * 100.0, 1) else 0.0 end
    )
  );

  return jsonb_build_object(
    'total_users', coalesce(v_total_users, 0),
    'steps', v_steps
  );
end;
$$;


--
-- Name: admin_overview(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_overview(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_p_days int := coalesce(p_days, 30);
  v_cutoff timestamptz := now() - (v_p_days || ' days')::interval;
  v_prev_cutoff timestamptz := now() - ((v_p_days * 2) || ' days')::interval;
  
  -- Totals
  v_total_users bigint;
  v_total_circles bigint;
  v_total_events bigint;
  v_total_connections bigint;
  v_total_connections_unique bigint;
  v_total_messages bigint;
  v_total_chats_dm bigint;
  v_total_chats_group bigint;
  v_total_reports_pending bigint;
  
  -- New in period
  v_new_users bigint;
  v_new_circles bigint;
  v_new_events bigint;
  v_new_connections bigint;
  v_new_messages bigint;
  v_new_circle_joins bigint;
  
  -- Prev period
  v_prev_users bigint;
  v_prev_circles bigint;
  v_prev_events bigint;
  v_prev_connections bigint;
  v_prev_messages bigint;
  v_prev_circle_joins bigint;
  
  -- Active
  v_dau bigint;
  v_wau bigint;
  v_mau bigint;
  v_stickiness numeric;
  
  -- Averages
  v_circles_per_user numeric;
  v_connections_per_user numeric;
  v_members_per_circle numeric;
  v_attendees_per_event numeric;
  v_total_circle_members bigint;
  v_total_event_attendees bigint;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Totals
  select count(*) into v_total_users from auth.users;
  select count(*) into v_total_circles from public.circles;
  select count(*) into v_total_events from public.events;
  select count(*) into v_total_connections from public.connections;
  v_total_connections_unique := round(v_total_connections::numeric / 2.0);
  select count(*) into v_total_messages from public.messages;
  select count(*) into v_total_chats_dm from public.chats where type = 'dm';
  select count(*) into v_total_chats_group from public.chats where type = 'group';
  select count(*) into v_total_reports_pending from public.reports where status = 'pending';

  -- New in period
  select count(*) into v_new_users from auth.users where created_at >= v_cutoff;
  select count(*) into v_new_circles from public.circles where created_at >= v_cutoff;
  select count(*) into v_new_events from public.events where created_at >= v_cutoff;
  select count(*) into v_new_connections from public.connections where created_at >= v_cutoff;
  select count(*) into v_new_messages from public.messages where created_at >= v_cutoff;
  select count(*) into v_new_circle_joins from public.circle_members where joined_at >= v_cutoff;

  -- Prev period
  select count(*) into v_prev_users from auth.users where created_at >= v_prev_cutoff and created_at < v_cutoff;
  select count(*) into v_prev_circles from public.circles where created_at >= v_prev_cutoff and created_at < v_cutoff;
  select count(*) into v_prev_events from public.events where created_at >= v_prev_cutoff and created_at < v_cutoff;
  select count(*) into v_prev_connections from public.connections where created_at >= v_prev_cutoff and created_at < v_cutoff;
  select count(*) into v_prev_messages from public.messages where created_at >= v_prev_cutoff and created_at < v_cutoff;
  select count(*) into v_prev_circle_joins from public.circle_members where joined_at >= v_prev_cutoff and joined_at < v_cutoff;

  -- Active users
  select count(distinct user_id) into v_dau from public._admin_activity(current_date - 30) where day >= current_date;
  select count(distinct user_id) into v_wau from public._admin_activity(current_date - 30) where day >= current_date - 6;
  select count(distinct user_id) into v_mau from public._admin_activity(current_date - 30) where day >= current_date - 29;
  
  if v_mau > 0 then
    v_stickiness := round(v_dau::numeric / v_mau::numeric, 2);
  else
    v_stickiness := 0.00;
  end if;

  -- Averages
  select count(*) into v_total_circle_members from public.circle_members;
  select count(*) into v_total_event_attendees from public.event_attendees;

  if v_total_users > 0 then
    v_circles_per_user := round(v_total_circles::numeric / v_total_users::numeric, 2);
    v_connections_per_user := round(v_total_connections_unique::numeric / v_total_users::numeric, 2);
  else
    v_circles_per_user := 0.00;
    v_connections_per_user := 0.00;
  end if;

  if v_total_circles > 0 then
    v_members_per_circle := round(v_total_circle_members::numeric / v_total_circles::numeric, 2);
  else
    v_members_per_circle := 0.00;
  end if;

  if v_total_events > 0 then
    v_attendees_per_event := round(v_total_event_attendees::numeric / v_total_events::numeric, 2);
  else
    v_attendees_per_event := 0.00;
  end if;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'users', coalesce(v_total_users, 0),
      'circles', coalesce(v_total_circles, 0),
      'events', coalesce(v_total_events, 0),
      'connections', coalesce(v_total_connections, 0),
      'connections_unique', coalesce(v_total_connections_unique, 0),
      'messages', coalesce(v_total_messages, 0),
      'chats_dm', coalesce(v_total_chats_dm, 0),
      'chats_group', coalesce(v_total_chats_group, 0),
      'reports_pending', coalesce(v_total_reports_pending, 0)
    ),
    'new_in_period', jsonb_build_object(
      'users', coalesce(v_new_users, 0),
      'circles', coalesce(v_new_circles, 0),
      'events', coalesce(v_new_events, 0),
      'connections', coalesce(v_new_connections, 0),
      'messages', coalesce(v_new_messages, 0),
      'circle_joins', coalesce(v_new_circle_joins, 0)
    ),
    'prev_period', jsonb_build_object(
      'users', coalesce(v_prev_users, 0),
      'circles', coalesce(v_prev_circles, 0),
      'events', coalesce(v_prev_events, 0),
      'connections', coalesce(v_prev_connections, 0),
      'messages', coalesce(v_prev_messages, 0),
      'circle_joins', coalesce(v_prev_circle_joins, 0)
    ),
    'active', jsonb_build_object(
      'dau', coalesce(v_dau, 0),
      'wau', coalesce(v_wau, 0),
      'mau', coalesce(v_mau, 0),
      'stickiness', coalesce(v_stickiness, 0.00)
    ),
    'averages', jsonb_build_object(
      'circles_per_user', coalesce(v_circles_per_user, 0.00),
      'connections_per_user', coalesce(v_connections_per_user, 0.00),
      'members_per_circle', coalesce(v_members_per_circle, 0.00),
      'attendees_per_event', coalesce(v_attendees_per_event, 0.00)
    )
  );
end;
$$;


--
-- Name: admin_recent_users(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_recent_users(p_limit integer DEFAULT 50) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_limit int := coalesce(p_limit, 50);
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with recent_u as (
    select
      u.id,
      p.name,
      p.city,
      p.age,
      p.avatar_url,
      u.created_at,
      u.last_sign_in_at,
      coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
      (u.email_confirmed_at is not null) as email_confirmed,
      coalesce(cm.cnt, 0) as circles,
      coalesce(conn.cnt, 0) as connections,
      coalesce(ea.cnt, 0) as events_attended,
      coalesce(msg.cnt, 0) as messages_sent,
      round((
        (case when p.name is not null and length(trim(p.name)) > 0 then 1 else 0 end) +
        (case when p.city is not null and length(trim(p.city)) > 0 then 1 else 0 end) +
        (case when p.bio is not null and length(trim(p.bio)) > 0 then 1 else 0 end) +
        (case when p.avatar_url is not null and length(trim(p.avatar_url)) > 0 then 1 else 0 end) +
        (case when array_length(p.interests, 1) >= 1 then 1 else 0 end) +
        (case when array_length(p.intents, 1) >= 1 then 1 else 0 end)
      )::numeric / 6.0 * 100.0, 1) as completeness_pct,
      p.last_active_date
    from auth.users u
    left join public.profiles p on u.id = p.id
    left join (
      select user_id, count(*) as cnt from public.circle_members group by user_id
    ) cm on u.id = cm.user_id
    left join (
      select user_id, count(*) as cnt from public.connections group by user_id
    ) conn on u.id = conn.user_id
    left join (
      select user_id, count(*) as cnt from public.event_attendees group by user_id
    ) ea on u.id = ea.user_id
    left join (
      select sender_id, count(*) as cnt from public.messages where sender_id is not null group by sender_id
    ) msg on u.id = msg.sender_id
    order by u.created_at desc
    limit v_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'city', city,
      'age', age,
      'avatar_url', avatar_url,
      'created_at', created_at,
      'last_sign_in_at', last_sign_in_at,
      'provider', provider,
      'email_confirmed', email_confirmed,
      'circles', circles,
      'connections', connections,
      'events_attended', events_attended,
      'messages_sent', messages_sent,
      'completeness_pct', completeness_pct,
      'last_active_date', last_active_date
    )
  ), '[]'::jsonb)
  into v_rows
  from recent_u;

  return jsonb_build_object('rows', v_rows);
end;
$$;


--
-- Name: admin_retention_cohorts(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_retention_cohorts(p_weeks integer DEFAULT 8) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_p_weeks int := coalesce(p_weeks, 8);
  v_cohorts jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with cohort_base as (
    select
      id as user_id,
      date_trunc('week', created_at)::date as cohort_week
    from auth.users
    where created_at >= date_trunc('week', now() - (v_p_weeks || ' weeks')::interval)
  ),
  cohort_sizes as (
    select
      cohort_week,
      count(*) as cohort_size
    from cohort_base
    group by cohort_week
  ),
  weeks_spine as (
    select gs as week_index
    from generate_series(0, v_p_weeks) gs
  ),
  cohort_weeks as (
    select
      cs.cohort_week,
      cs.cohort_size,
      ws.week_index,
      (cs.cohort_week + (ws.week_index * 7)) as week_start,
      (cs.cohort_week + ((ws.week_index + 1) * 7) - 1) as week_end
    from cohort_sizes cs
    cross join weeks_spine ws
    where (cs.cohort_week + ((ws.week_index + 1) * 7) - 1) <= current_date
  ),
  retained as (
    select
      cw.cohort_week,
      cw.week_index,
      count(distinct cb.user_id) as retained_users
    from cohort_weeks cw
    join cohort_base cb on cb.cohort_week = cw.cohort_week
    join public._admin_activity(cw.cohort_week) act on act.user_id = cb.user_id
    where act.day >= cw.week_start and act.day <= cw.week_end
    group by cw.cohort_week, cw.week_index
  ),
  cohort_weeks_agg as (
    select
      cw.cohort_week,
      cw.cohort_size,
      jsonb_agg(
        jsonb_build_object(
          'week_index', cw.week_index,
          'users', coalesce(r.retained_users, 0),
          'pct', case when cw.cohort_size > 0 then round((coalesce(r.retained_users, 0)::numeric / cw.cohort_size::numeric) * 100.0, 1) else 0.0 end
        ) order by cw.week_index asc
      ) as weeks_json
    from cohort_weeks cw
    left join retained r on r.cohort_week = cw.cohort_week and r.week_index = cw.week_index
    group by cw.cohort_week, cw.cohort_size
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cohort_week', cwa.cohort_week,
      'size', cwa.cohort_size,
      'weeks', cwa.weeks_json
    ) order by cwa.cohort_week asc
  ), '[]'::jsonb)
  into v_cohorts
  from cohort_weeks_agg cwa;

  return jsonb_build_object('cohorts', v_cohorts);
end;
$$;


--
-- Name: answer_daily_question(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.answer_daily_question(p_text text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
  v_q public.questions%rowtype;
  v_clean text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_clean := trim(coalesce(p_text, ''));
  if v_clean = '' then
    raise exception 'Answer cannot be empty';
  end if;

  v_q := public.question_of_the_day();
  if v_q.id is null then
    raise exception 'No active question found';
  end if;

  if exists (select 1 from public.daily_question_answers where user_id = v_uid and answer_day = v_today) then
    raise exception 'Already answered today';
  end if;

  insert into public.daily_question_answers (user_id, question_id, answer_day, text)
    values (v_uid, v_q.id, v_today, v_clean);

  -- Perform reveal sweep for caller
  perform public.sync_question_reveals();
end; $$;


--
-- Name: answer_spontaneous_question(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.answer_spontaneous_question(p_id uuid, p_text text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_sq public.spontaneous_questions%rowtype;
  v_clean text;
  v_asker_name text;
  v_recipient_name text;
  v_payload jsonb;
  v_msg_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_clean := trim(coalesce(p_text, ''));
  if v_clean = '' then
    raise exception 'Answer cannot be empty';
  end if;

  select * into v_sq from public.spontaneous_questions
    where id = p_id for update;
  if not found then
    raise exception 'Question not found';
  end if;

  if v_sq.recipient_id <> v_uid then
    raise exception 'Only the recipient can answer this question';
  end if;

  if v_sq.status <> 'pending' then
    raise exception 'Question is no longer pending';
  end if;

  if v_sq.expires_at <= now() then
    raise exception 'Question has expired';
  end if;

  update public.spontaneous_questions
     set recipient_answer = v_clean,
         status = 'revealed'
   where id = p_id;

  select name into v_asker_name from public.profiles where id = v_sq.asker_id;
  select name into v_recipient_name from public.profiles where id = v_uid;

  v_payload := jsonb_build_object(
    'variant', 'spontaneous',
    'questionText', v_sq.question_text,
    'answers', jsonb_build_array(
      jsonb_build_object('userId', v_sq.asker_id, 'name', v_asker_name, 'text', v_sq.asker_answer),
      jsonb_build_object('userId', v_uid, 'name', v_recipient_name, 'text', v_clean)
    )
  );

  insert into public.messages (chat_id, sender_id, text, kind, payload)
    values (v_sq.chat_id, v_uid, v_sq.question_text, 'question', v_payload)
    returning id into v_msg_id;

  perform public.enqueue_notification(
    v_sq.asker_id,
    'spontaneous_question_answered',
    jsonb_build_object(
      'chatId', v_sq.chat_id,
      'name', v_recipient_name,
      'message', 'answered your question.'
    )
  );
end; $$;


--
-- Name: app_day(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_day() RETURNS date
    LANGUAGE sql STABLE
    AS $$
  select (now() at time zone 'America/New_York')::date;
$$;


--
-- Name: approve_application(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_application(p_application_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_circle_id uuid;
  v_applicant_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  select a.circle_id, a.applicant_id
    into v_circle_id, v_applicant_id
  from public.applications a
  where a.id = p_application_id;

  if v_circle_id is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1
    from public.circles c
    where c.id = v_circle_id
      and c.organizer_id = v_uid
  ) then
    raise exception 'Not authorized';
  end if;

  update public.applications
  set status = 'approved', reviewed_at = now()
  where id = p_application_id;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle_id, v_applicant_id, 'member')
  on conflict (circle_id, user_id) do nothing;
end;
$$;


--
-- Name: are_connected(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.are_connected(p_a uuid, p_b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.connections
    where (user_id = p_a and connected_user_id = p_b)
       or (user_id = p_b and connected_user_id = p_a)
  );
$$;


--
-- Name: ask_spontaneous_question(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ask_spontaneous_question(p_chat_id uuid, p_question text, p_my_answer text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  v_q_clean := trim(coalesce(p_question, ''));
  v_a_clean := trim(coalesce(p_my_answer, ''));
  if v_q_clean = '' or v_a_clean = '' then
    raise exception 'Question and answer are both required';
  end if;

  select type into v_chat_type from public.chats where id = p_chat_id;
  if v_chat_type <> 'dm' or v_chat_type is null then
    raise exception 'Spontaneous questions can only be sent in 1-on-1 chats';
  end if;

  select user_id into v_recipient_id from public.chat_members
    where chat_id = p_chat_id and user_id <> v_uid limit 1;
  if v_recipient_id is null then
    raise exception 'Recipient not found in chat';
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


--
-- Name: award_battery_for_attendance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_battery_for_attendance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_new_points int;
begin
  if new.attended = true and (old.attended is null or old.attended = false) then
    update public.profiles
      set battery_points = least(coalesce(battery_points, 0) + 20, 100)
      where id = new.user_id
    returning battery_points into v_new_points;

    insert into public.battery_history (user_id, points, reason, result)
    values (new.user_id, 20, 'Attended an event', coalesce(v_new_points, 20));
  end if;

  return new;
end;
$$;


--
-- Name: award_battery_for_rsvp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_battery_for_rsvp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_new_points int;
begin
  -- bump points (cap at 100)
  update public.profiles
    set battery_points = least(coalesce(battery_points, 0) + 20, 100)
    where id = new.user_id
  returning battery_points into v_new_points;

  -- log it
  insert into public.battery_history (user_id, points, reason, result)
  values (new.user_id, 20, 'Attending an event', coalesce(v_new_points, 20));

  return new;
end;
$$;


--
-- Name: block_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_user(p_target_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_uid = p_target_id then raise exception 'Cannot block yourself'; end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_target_id)
  on conflict do nothing;

  -- Sever the connection in both directions.
  delete from public.connections
  where (user_id = v_uid and connected_user_id = p_target_id)
     or (user_id = p_target_id and connected_user_id = v_uid);

  -- Remove any pending or historical connection requests.
  delete from public.connection_requests
  where (requester_id = v_uid and recipient_id = p_target_id)
     or (requester_id = p_target_id and recipient_id = v_uid);

  -- Clear notifications referencing the blocked user so they stop surfacing.
  delete from public.notifications
  where user_id = v_uid
    and payload->'user'->>'id' = p_target_id::text;
end; $$;


--
-- Name: cancel_spontaneous_question(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_spontaneous_question(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_sq public.spontaneous_questions%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sq from public.spontaneous_questions where id = p_id;
  if not found then
    raise exception 'Question not found';
  end if;

  if v_sq.asker_id <> v_uid then
    raise exception 'Only the asker can cancel this question';
  end if;

  if v_sq.status <> 'pending' then
    raise exception 'Only pending questions can be cancelled';
  end if;

  update public.spontaneous_questions
     set status = 'expired'
   where id = p_id;
end; $$;


--
-- Name: checkers_winner_basic(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkers_winner_basic(p_cells jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  has_x boolean;
  has_o boolean;
begin
  select
    exists(select 1 from jsonb_array_elements_text(p_cells) v where v in ('x','X')),
    exists(select 1 from jsonb_array_elements_text(p_cells) v where v in ('o','O'))
  into has_x, has_o;
  if not has_x then return 'o'; end if;
  if not has_o then return 'x'; end if;
  return null;
end; $$;


--
-- Name: close_poll(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_poll(p_poll_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  update public.polls
  set closed_at = now()
  where id = p_poll_id and created_by = v_uid and closed_at is null;
  if not found then raise exception 'Only the poll creator can close it'; end if;
end; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    chat_id uuid NOT NULL,
    player_x uuid NOT NULL,
    player_o uuid NOT NULL,
    current_turn text DEFAULT 'x'::text NOT NULL,
    state jsonb NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    winner text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT games_check CHECK ((player_x <> player_o)),
    CONSTRAINT games_current_turn_check CHECK ((current_turn = ANY (ARRAY['x'::text, 'o'::text]))),
    CONSTRAINT games_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'abandoned'::text]))),
    CONSTRAINT games_type_check CHECK ((type = ANY (ARRAY['tic_tac_toe'::text, 'connect_four'::text, 'chess'::text, 'checkers'::text]))),
    CONSTRAINT games_winner_check CHECK ((winner = ANY (ARRAY['x'::text, 'o'::text, 'draw'::text])))
);


--
-- Name: commit_game_move(uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commit_game_move(p_game_id uuid, p_new_state jsonb, p_declared_winner text DEFAULT NULL::text) RETURNS public.games
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_my_token text;
  v_winner text;
  v_basic_winner text;
  v_new_status text;
  v_new_turn text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if v_game.status <> 'in_progress' then raise exception 'Game already ended'; end if;

  if v_game.player_x = v_uid then v_my_token := 'x';
  elsif v_game.player_o = v_uid then v_my_token := 'o';
  else raise exception 'You are not a player in this game';
  end if;

  if v_game.current_turn <> v_my_token then
    raise exception 'Not your turn';
  end if;

  -- Sanitize declared winner so clients can't supply garbage
  if p_declared_winner is not null
     and p_declared_winner not in ('x','o','draw') then
    raise exception 'Invalid declared winner %', p_declared_winner;
  end if;

  case v_game.type
    when 'tic_tac_toe' then
      v_winner := public.tic_tac_toe_winner(p_new_state->'cells');
    when 'connect_four' then
      v_winner := public.connect_four_winner(p_new_state->'cells');
    when 'checkers' then
      v_basic_winner := public.checkers_winner_basic(p_new_state->'cells');
      v_winner := coalesce(v_basic_winner, p_declared_winner);
    when 'chess' then
      v_winner := p_declared_winner;
    else
      raise exception 'Unknown game type %', v_game.type;
  end case;

  if v_winner is not null then
    v_new_status := 'completed';
    v_new_turn := v_game.current_turn;
  else
    v_new_status := 'in_progress';
    v_new_turn := case when v_my_token = 'x' then 'o' else 'x' end;
  end if;

  update public.games
     set state = p_new_state,
         current_turn = v_new_turn,
         status = v_new_status,
         winner = v_winner,
         updated_at = now()
   where id = p_game_id
   returning * into v_game;

  return v_game;
end; $$;


--
-- Name: connect_four_winner(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.connect_four_winner(p_cells jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  b text[];
  r int; c int; v text; idx int;
begin
  b := array(select coalesce(value, '') from jsonb_array_elements_text(p_cells) value);
  -- Horizontal
  for r in 0..5 loop
    for c in 0..3 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+1] and v = b[idx+2] and v = b[idx+3] then return v; end if;
    end loop;
  end loop;
  -- Vertical
  for c in 0..6 loop
    for r in 0..2 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+7] and v = b[idx+14] and v = b[idx+21] then return v; end if;
    end loop;
  end loop;
  -- Diagonal down-right
  for r in 0..2 loop
    for c in 0..3 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+8] and v = b[idx+16] and v = b[idx+24] then return v; end if;
    end loop;
  end loop;
  -- Diagonal down-left
  for r in 0..2 loop
    for c in 3..6 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+6] and v = b[idx+12] and v = b[idx+18] then return v; end if;
    end loop;
  end loop;
  if not exists (select 1 from unnest(b) cell where cell = '') then
    return 'draw';
  end if;
  return null;
end; $$;


--
-- Name: create_chat_for_new_circle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_chat_for_new_circle() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_chat_id uuid;
  v_channel_name text;
begin
  insert into public.chats (type, circle_id, name)
  values ('group', new.id, new.name)
  returning id into v_chat_id;

  foreach v_channel_name in array array['general','planning','photos','meetups'] loop
    insert into public.chat_channels (chat_id, name) values (v_chat_id, v_channel_name);
  end loop;

  -- organizer (if any) joins immediately
  if new.organizer_id is not null then
    insert into public.chat_members (chat_id, user_id) values (v_chat_id, new.organizer_id)
      on conflict do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: create_chat_game(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_chat_game(p_chat_id uuid, p_game_type text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_game_id uuid;
  v_other uuid;
  v_initial jsonb;
  v_label text;
  v_member_count int;
  v_chat_type text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (select 1 from public.chat_members where chat_id = p_chat_id and user_id = v_uid) then
    raise exception 'Not a member of this chat';
  end if;
  select type into v_chat_type from public.chats where id = p_chat_id;
  if v_chat_type <> 'dm' then
    raise exception 'Games are only supported in 1-on-1 chats';
  end if;
  select count(*) into v_member_count from public.chat_members where chat_id = p_chat_id;
  if v_member_count <> 2 then
    raise exception 'Games are only supported in 1-on-1 chats';
  end if;
  select user_id into v_other from public.chat_members
    where chat_id = p_chat_id and user_id <> v_uid limit 1;

  case p_game_type
    when 'tic_tac_toe' then
      v_initial := jsonb_build_object('cells', jsonb_build_array('','','','','','','','',''));
      v_label := 'Tic-Tac-Toe';
    when 'connect_four' then
      v_initial := jsonb_build_object(
        'cells', (select jsonb_agg(''::text) from generate_series(1, 42))
      );
      v_label := 'Connect Four';
    when 'checkers' then
      v_initial := jsonb_build_object(
        'cells', jsonb_build_array(
          '','o','','o','','o','','o',
          'o','','o','','o','','o','',
          '','o','','o','','o','','o',
          '','','','','','','','',
          '','','','','','','','',
          'x','','x','','x','','x','',
          '','x','','x','','x','','x',
          'x','','x','','x','','x',''
        )
      );
      v_label := 'Checkers';
    when 'chess' then
      v_initial := jsonb_build_object(
        'fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      );
      v_label := 'Chess';
    else
      raise exception 'Unknown game type %', p_game_type;
  end case;

  insert into public.games (type, chat_id, player_x, player_o, current_turn, state, status)
  values (p_game_type, p_chat_id, v_uid, v_other, 'x', v_initial, 'in_progress')
  returning id into v_game_id;

  insert into public.messages (chat_id, sender_id, text, kind, payload)
  values (
    p_chat_id, v_uid,
    '🎮 Started ' || v_label,
    'game',
    jsonb_build_object('gameId', v_game_id, 'gameType', p_game_type)
  );

  return v_game_id;
end; $$;


--
-- Name: create_chat_poll(uuid, text, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_chat_poll(p_chat_id uuid, p_question text, p_options jsonb, p_allow_multiple boolean DEFAULT false, p_channel_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    inviter_id uuid NOT NULL,
    recipient_contact text,
    consumed_by uuid,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '90 days'::interval) NOT NULL,
    code text,
    circle_id uuid,
    kind text DEFAULT 'personal'::text NOT NULL,
    is_reusable boolean DEFAULT false NOT NULL,
    max_uses integer,
    use_count integer DEFAULT 0 NOT NULL,
    label text,
    CONSTRAINT invites_kind_check CHECK ((kind = ANY (ARRAY['personal'::text, 'circle'::text])))
);


--
-- Name: create_circle_invite_link(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_circle_invite_link(p_circle_id uuid, p_label text DEFAULT NULL::text) RETURNS public.invites
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_is_organizer boolean;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1 from public.circles c
    where c.id = p_circle_id and c.organizer_id = v_uid
    union
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = v_uid and cm.role in ('organizer', 'host')
  ) into v_is_organizer;

  if not v_is_organizer then
    raise exception 'Only the organizer can create invite links';
  end if;

  select * into v_invite
  from public.invites
  where circle_id = p_circle_id
    and inviter_id = v_uid
    and kind = 'circle'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    return v_invite;
  end if;

  v_code := generate_invite_code();

  insert into public.invites (
    token, code, inviter_id, circle_id, kind, is_reusable, max_uses, expires_at, label
  ) values (
    gen_random_uuid()::text, v_code, v_uid, p_circle_id, 'circle', true, null, now() + interval '365 days', p_label
  )
  returning * into v_invite;

  return v_invite;
end;
$$;


--
-- Name: create_lfg_post(text, timestamp with time zone, text, boolean, text, text, double precision, double precision, timestamp with time zone, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_lfg_post(p_activity text, p_expires_at timestamp with time zone, p_visibility text DEFAULT 'everyone'::text, p_notify_connections boolean DEFAULT false, p_place_name text DEFAULT NULL::text, p_place_address text DEFAULT NULL::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_invitee_ids uuid[] DEFAULT NULL::uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_conn uuid;
  v_targeted boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_activity is null or length(trim(p_activity)) = 0 then
    raise exception 'Activity is required';
  end if;
  if p_visibility not in ('everyone', 'friends') then
    raise exception 'Invalid visibility';
  end if;
  if p_expires_at <= now() then
    raise exception 'Expiry must be in the future';
  end if;

  insert into public.lfg_posts (
    user_id, activity, place_name, place_address, latitude, longitude,
    starts_at, expires_at, visibility, notify_connections
  ) values (
    v_uid, trim(p_activity), p_place_name, p_place_address,
    p_latitude, p_longitude, coalesce(p_starts_at, now()),
    p_expires_at, p_visibility, p_notify_connections
  )
  returning id into v_id;

  select name into v_name from public.profiles where id = v_uid;

  -- Targeted: friends-only post with an explicit recipient list.
  if p_visibility = 'friends'
     and p_invitee_ids is not null
     and array_length(p_invitee_ids, 1) > 0 then
    v_targeted := true;

    foreach v_conn in array p_invitee_ids loop
      if v_conn <> v_uid
         and public.are_connected(v_uid, v_conn)
         and not public.is_blocked_with(v_conn) then
        insert into public.lfg_post_invites (post_id, user_id)
        values (v_id, v_conn)
        on conflict do nothing;

        perform public.enqueue_notification(
          v_conn,
          'lfg_post',
          jsonb_build_object(
            'user', jsonb_build_object('id', v_uid, 'name', coalesce(v_name, 'Someone')),
            'message', coalesce(v_name, 'Someone') || ' is free right now: ' || trim(p_activity),
            'postId', v_id
          )
        );
      end if;
    end loop;
  end if;

  -- Untargeted: the original broadcast to every connection.
  if not v_targeted and p_notify_connections then
    for v_conn in
      select connected_user_id from public.connections where user_id = v_uid
      union
      select user_id from public.connections where connected_user_id = v_uid
    loop
      if not public.is_blocked_with(v_conn) then
        perform public.enqueue_notification(
          v_conn,
          'lfg_post',
          jsonb_build_object(
            'user', jsonb_build_object('id', v_uid, 'name', coalesce(v_name, 'Someone')),
            'message', coalesce(v_name, 'Someone') || ' is free right now: ' || trim(p_activity),
            'postId', v_id
          )
        );
      end if;
    end loop;
  end if;

  return v_id;
end; $$;


--
-- Name: create_personal_invite_link(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_personal_invite_link() RETURNS public.invites
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invites
  where inviter_id = v_uid
    and kind = 'personal'
    and circle_id is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    return v_invite;
  end if;

  v_code := generate_invite_code();

  insert into public.invites (
    token, code, inviter_id, circle_id, kind, is_reusable, max_uses, expires_at
  ) values (
    gen_random_uuid()::text, v_code, v_uid, null, 'personal', true, null, now() + interval '365 days'
  )
  returning * into v_invite;

  return v_invite;
end;
$$;


--
-- Name: decline_application(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decline_application(p_application_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_circle_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  select a.circle_id into v_circle_id
  from public.applications a
  where a.id = p_application_id;

  if v_circle_id is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1
    from public.circles c
    where c.id = v_circle_id
      and c.organizer_id = v_uid
  ) then
    raise exception 'Not authorized';
  end if;

  update public.applications
  set status = 'declined', reviewed_at = now()
  where id = p_application_id;
end;
$$;


--
-- Name: delete_my_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_my_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Remove rows that do NOT cascade from auth.users deletion.
  delete from public.blocks where blocker_id = v_uid or blocked_id = v_uid;

  -- Preserve reports filed AGAINST this user for safety review, but detach
  -- reports this user filed so no personal data remains linked to them.
  update public.reports set reporter_id = null where reporter_id = v_uid;

  -- Delete the auth user. Cascades remove the profile and all owned data.
  delete from auth.users where id = v_uid;
end; $$;


--
-- Name: disconnect_calendar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.disconnect_calendar() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.google_calendar_tokens where user_id = auth.uid();
end;
$$;


--
-- Name: disconnect_from(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.disconnect_from(p_target_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_uid = p_target_id then raise exception 'Cannot disconnect from yourself'; end if;

  -- Remove both directional rows
  delete from public.connections
  where (user_id = v_uid and connected_user_id = p_target_id)
     or (user_id = p_target_id and connected_user_id = v_uid);

  -- Remove old connection_requests so reconnecting works clean.
  delete from public.connection_requests
  where (requester_id = v_uid and recipient_id = p_target_id)
     or (requester_id = p_target_id and recipient_id = v_uid);
end; $$;


--
-- Name: dismiss_daily_question(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dismiss_daily_question(p_permanent boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(p_permanent, false) then
    insert into public.question_prefs (user_id, daily_enabled)
      values (v_uid, false)
      on conflict (user_id) do update set daily_enabled = false;
  else
    insert into public.question_prefs (user_id, last_dismissed_day)
      values (v_uid, v_today)
      on conflict (user_id) do update set last_dismissed_day = v_today;
  end if;
end; $$;


--
-- Name: drain_battery_for_stale_connections(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.drain_battery_for_stale_connections() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  rec record;
  v_stale_count int;
  v_drain int;
  v_new_points int;
begin
  for rec in
    select p.id as user_id, coalesce(p.reconnect_threshold_days, 21) as threshold
    from public.profiles p
  loop
    select count(*) into v_stale_count
    from public.connections c
    where c.user_id = rec.user_id
      and (now() - coalesce(c.last_hangout, c.created_at))
          >= make_interval(days => rec.threshold);

    if v_stale_count > 0 then
      v_drain := least(v_stale_count * 2, 10);
      update public.profiles
         set battery_points = greatest(0, coalesce(battery_points, 0) - v_drain)
       where id = rec.user_id
      returning battery_points into v_new_points;

      insert into public.battery_history (user_id, points, reason, result)
      values (
        rec.user_id,
        -v_drain,
        v_stale_count || ' stale connection' || case when v_stale_count = 1 then '' else 's' end,
        v_new_points
      );
    end if;
  end loop;
end; $$;


--
-- Name: emit_event_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_event_reminders() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: emit_reconnect_nudges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_reconnect_nudges() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: enqueue_notification(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_notification(p_user_id uuid, p_type text, p_payload jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: ensure_dm_chat(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_dm_chat(p_user_1 uuid, p_user_2 uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_chat_id uuid;
begin
  if p_user_1 is null or p_user_2 is null or p_user_1 = p_user_2 then
    return null;
  end if;

  select cm1.chat_id into v_chat_id
    from public.chat_members cm1
    join public.chat_members cm2 on cm2.chat_id = cm1.chat_id
    join public.chats c on c.id = cm1.chat_id
    where cm1.user_id = p_user_1
      and cm2.user_id = p_user_2
      and c.type = 'dm'
    limit 1;

  if v_chat_id is not null then
    return v_chat_id;
  end if;

  insert into public.chats (type, name)
    values ('dm', null)
    returning id into v_chat_id;

  insert into public.chat_members (chat_id, user_id)
    values (v_chat_id, p_user_1), (v_chat_id, p_user_2);

  return v_chat_id;
end;
$$;


--
-- Name: file_report(uuid, uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.file_report(p_reported_user_id uuid DEFAULT NULL::uuid, p_reported_message_id uuid DEFAULT NULL::uuid, p_reported_circle_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT 'other'::text, p_details text DEFAULT NULL::text, p_context jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_reported_user_id is null
     and p_reported_message_id is null
     and p_reported_circle_id is null then
    raise exception 'A report must reference a user, message, or circle';
  end if;

  insert into public.reports (
    reporter_id, reported_user_id, reported_message_id, reported_circle_id,
    reason, details, context_snapshot
  ) values (
    v_uid, p_reported_user_id, p_reported_message_id, p_reported_circle_id,
    p_reason, p_details, p_context
  )
  returning id into v_id;

  return v_id;
end; $$;


--
-- Name: generate_invite_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_chars text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_len int := char_length(v_chars);
  v_code text;
  v_exists boolean;
  i int;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_chars, floor(random() * v_len + 1)::int, 1);
    end loop;

    select exists(select 1 from public.invites where code = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end;
$$;


--
-- Name: get_daily_question(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_daily_question() RETURNS TABLE(question_id uuid, question_text text, already_answered boolean, dismissed_today boolean, enabled boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
  v_q public.questions%rowtype;
  v_pref public.question_prefs%rowtype;
  v_answered boolean;
  v_dismissed boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_pref from public.question_prefs where user_id = v_uid;
  if not found then
    insert into public.question_prefs (user_id, daily_enabled, last_dismissed_day)
      values (v_uid, true, null)
      on conflict (user_id) do nothing;
    select * into v_pref from public.question_prefs where user_id = v_uid;
  end if;

  v_q := public.question_of_the_day();
  if v_q.id is null then
    return;
  end if;

  select exists (
    select 1 from public.daily_question_answers
    where user_id = v_uid and answer_day = v_today
  ) into v_answered;

  v_dismissed := (v_pref.last_dismissed_day is not null and v_pref.last_dismissed_day = v_today);

  return query select
    v_q.id,
    v_q.text,
    v_answered,
    v_dismissed,
    v_pref.daily_enabled;
end; $$;


--
-- Name: get_my_chat_summaries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_chat_summaries() RETURNS TABLE(chat_id uuid, chat_type text, circle_id uuid, name text, avatar text, last_message text, last_message_at timestamp with time zone, unread_count integer, member_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with my_memberships as (
    select cm.chat_id, cm.last_read_at, cm.hidden_at
    from public.chat_members cm
    where cm.user_id = auth.uid()
  ),
  last_msgs as (
    select distinct on (m.chat_id)
      m.chat_id, m.text as last_message, m.created_at as last_message_at
    from public.messages m
    where m.chat_id in (select chat_id from my_memberships)
    order by m.chat_id, m.created_at desc
  ),
  unreads as (
    select m.chat_id, count(*)::int as unread_count
    from public.messages m
    join my_memberships mm on mm.chat_id = m.chat_id
    where m.created_at > coalesce(mm.last_read_at, 'epoch'::timestamptz)
      and m.sender_id is distinct from auth.uid()
    group by m.chat_id
  ),
  member_counts as (
    select chat_id, count(*)::int as member_count
    from public.chat_members
    group by chat_id
  )
  select
    c.id as chat_id,
    c.type as chat_type,
    c.circle_id,
    case
      when c.type = 'dm' then coalesce((
        select p.name
        from public.chat_members cm
        join public.profiles p on p.id = cm.user_id
        where cm.chat_id = c.id
          and cm.user_id <> auth.uid()
        limit 1
      ), '')
      else coalesce(c.name, '')
    end as name,
    case
      when c.type = 'dm' then coalesce((
        select p.avatar_url
        from public.chat_members cm
        join public.profiles p on p.id = cm.user_id
        where cm.chat_id = c.id
          and cm.user_id <> auth.uid()
        limit 1
      ), '')
      else ''
    end as avatar,
    coalesce(lm.last_message, ''),
    lm.last_message_at,
    coalesce(u.unread_count, 0),
    coalesce(mc.member_count, 0)
  from public.chats c
  join my_memberships mm on mm.chat_id = c.id
  left join last_msgs lm on lm.chat_id = c.id
  left join unreads u on u.chat_id = c.id
  left join member_counts mc on mc.chat_id = c.id
  where mm.hidden_at is null
     or (lm.last_message_at is not null and lm.last_message_at > mm.hidden_at)
  order by lm.last_message_at desc nulls last;
$$;


--
-- Name: get_pending_question_for_chat(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_question_for_chat(p_chat_id uuid) RETURNS TABLE(id uuid, chat_id uuid, asker_id uuid, asker_name text, asker_avatar text, recipient_id uuid, recipient_name text, recipient_avatar text, question_text text, status text, expires_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    sq.id,
    sq.chat_id,
    sq.asker_id,
    p_asker.name as asker_name,
    coalesce(p_asker.avatar_url, '') as asker_avatar,
    sq.recipient_id,
    p_rec.name as recipient_name,
    coalesce(p_rec.avatar_url, '') as recipient_avatar,
    sq.question_text,
    sq.status,
    sq.expires_at,
    sq.created_at
  from public.spontaneous_questions sq
  join public.profiles p_asker on p_asker.id = sq.asker_id
  join public.profiles p_rec on p_rec.id = sq.recipient_id
  where sq.chat_id = p_chat_id
    and (sq.recipient_id = v_uid or sq.asker_id = v_uid)
    and sq.status = 'pending'
    and sq.expires_at > now()
  order by sq.created_at desc
  limit 1;
end; $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, name, age, city, avatar_url, latitude, longitude)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    (new.raw_user_meta_data->>'age')::int,
    new.raw_user_meta_data->>'city',
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    (new.raw_user_meta_data->>'latitude')::double precision,
    (new.raw_user_meta_data->>'longitude')::double precision
  );
  return new;
end;
$$;


--
-- Name: has_calendar_connection(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_calendar_connection() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.google_calendar_tokens where user_id = auth.uid()
  );
$$;


--
-- Name: has_demo_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_demo_users() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where lower(name) in (
      'maya patel',
      'jordan lee',
      'sofia martinez',
      'marcus chen',
      'emma johnson',
      'alex rivera'
    )
  );
$$;


--
-- Name: hide_chat(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hide_chat(p_chat_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.chat_members
  set hidden_at = now()
  where chat_id = p_chat_id
    and user_id = auth.uid();
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;


--
-- Name: is_blocked_with(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_blocked_with(p_other_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_id)
       or (blocker_id = p_other_id and blocked_id = auth.uid())
  );
$$;


--
-- Name: is_chat_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_chat_member(c_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(
    select 1 from public.chat_members
    where chat_id = c_id and user_id = auth.uid()
  );
$$;


--
-- Name: is_circle_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_circle_admin(p_circle_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.circles c
    where c.id = p_circle_id and c.organizer_id = auth.uid()
  ) or exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id and m.user_id = auth.uid() and m.role in ('organizer','host')
  );
$$;


--
-- Name: is_circle_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_circle_member(p_circle_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id
      and m.user_id = auth.uid()
  ) or exists (
    select 1 from public.circles c
    where c.id = p_circle_id
      and c.organizer_id = auth.uid()
  );
$$;


--
-- Name: is_question_eligible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_question_eligible(p_chat_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_chat_type text;
  v_member_ids uuid[];
begin
  select type into v_chat_type from public.chats where id = p_chat_id;
  if v_chat_type <> 'dm' or v_chat_type is null then
    return false;
  end if;

  select array_agg(user_id) into v_member_ids
  from public.chat_members
  where chat_id = p_chat_id;

  if array_length(v_member_ids, 1) <> 2 then
    return false;
  end if;

  if not exists (select 1 from public.messages where chat_id = p_chat_id and sender_id = v_member_ids[1]) then
    return false;
  end if;

  if not exists (select 1 from public.messages where chat_id = p_chat_id and sender_id = v_member_ids[2]) then
    return false;
  end if;

  if not exists (select 1 from public.messages where chat_id = p_chat_id and created_at >= (now() - interval '21 days')) then
    return false;
  end if;

  return true;
end; $$;


--
-- Name: join_lfg_post(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_lfg_post(p_post_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_post public.lfg_posts%rowtype;
  v_name text;
  v_inserted boolean := false;
begin
  select * into v_post from public.lfg_posts where id = p_post_id;
  if v_post.id is null then
    raise exception 'Post not found';
  end if;
  if v_post.user_id = auth.uid() then
    raise exception 'Cannot join your own post';
  end if;
  if v_post.expires_at <= now() then
    raise exception 'This post has expired';
  end if;
  if public.is_blocked_with(v_post.user_id) then
    raise exception 'Post not available';
  end if;
  if v_post.visibility = 'friends'
     and not public.are_connected(auth.uid(), v_post.user_id) then
    raise exception 'Post not available';
  end if;

  insert into public.lfg_joins (post_id, user_id)
  values (p_post_id, auth.uid())
  on conflict (post_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Only notify on a genuinely new join, so repeat taps do not spam the author.
  if v_inserted then
    select name into v_name from public.profiles where id = auth.uid();
    perform public.enqueue_notification(
      v_post.user_id,
      'lfg_join',
      jsonb_build_object(
        'user', jsonb_build_object(
          'id', auth.uid(),
          'name', coalesce(v_name, 'Someone')
        ),
        'message', coalesce(v_name, 'Someone') || ' is in for ' || v_post.activity,
        'postId', p_post_id
      )
    );
  end if;

  return true;
end;
$$;


--
-- Name: leave_lfg_post(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_lfg_post(p_post_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.lfg_joins
   where post_id = p_post_id and user_id = auth.uid();
  return true;
end;
$$;


--
-- Name: lfg_post_joiners(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lfg_post_joiners(p_post_id uuid) RETURNS TABLE(user_id uuid, name text, avatar_url text, joined_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select j.user_id, p.name, p.avatar_url, j.created_at
    from public.lfg_joins j
    join public.profiles p on p.id = j.user_id
   where j.post_id = p_post_id
     and (
       exists (select 1 from public.lfg_posts lp
                where lp.id = p_post_id and lp.user_id = auth.uid())
       or j.user_id = auth.uid()
     )
     and not public.is_blocked_with(j.user_id)
   order by j.created_at asc;
$$;


--
-- Name: list_friend_groups(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_friend_groups() RETURNS TABLE(group_id uuid, name text, created_at timestamp with time zone, member_id uuid, member_name text, member_avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select g.id, g.name, g.created_at, p.id, p.name, p.avatar_url
    from public.friend_groups g
    left join public.friend_group_members m on m.group_id = g.id
    left join public.profiles p
      on p.id = m.user_id
     and public.are_connected(auth.uid(), p.id)
     and not public.is_blocked_with(p.id)
   where g.owner_id = auth.uid()
   order by g.created_at desc, p.name asc;
$$;


--
-- Name: mark_event_attendance(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_event_attendance(p_event_id uuid, p_user_id uuid, p_attended boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_host_id uuid;
  v_rows_affected int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select created_by into v_host_id from public.events where id = p_event_id;
  if not found or v_host_id <> v_uid then
    raise exception 'Only the event host can mark attendance';
  end if;

  update public.event_attendees
    set attended = p_attended,
        checked_in_at = case when p_attended then now() else null end,
        checked_in_by = v_uid
    where event_id = p_event_id and user_id = p_user_id;

  get diagnostics v_rows_affected = row_count;
  if v_rows_affected = 0 then
    raise exception 'That person has not RSVPd to this event';
  end if;
end;
$$;


--
-- Name: materialize_connection_on_accept(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.materialize_connection_on_accept() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (tg_op = 'INSERT' and new.status = 'accepted') or (tg_op = 'UPDATE' and new.status = 'accepted' and (old.status is null or old.status <> 'accepted')) then
    insert into public.connections (user_id, connected_user_id)
      values (new.requester_id, new.recipient_id)
      on conflict do nothing;
    insert into public.connections (user_id, connected_user_id)
      values (new.recipient_id, new.requester_id)
      on conflict do nothing;

    perform public.ensure_dm_chat(new.requester_id, new.recipient_id);
  end if;
  return new;
end; $$;


--
-- Name: my_blocked_user_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_blocked_user_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;


--
-- Name: notify_on_application_review(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_application_review() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_circle record;
begin
  if tg_op = 'UPDATE' and new.status <> old.status
     and new.status in ('approved','declined') then
    select id, name, emoji into v_circle
      from public.circles where id = new.circle_id;
    perform public.enqueue_notification(
      new.applicant_id,
      case when new.status = 'approved' then 'application_approved' else 'application_declined' end,
      jsonb_build_object(
        'circle', jsonb_build_object(
          'id', v_circle.id,
          'name', v_circle.name,
          'emoji', coalesce(v_circle.emoji, '')
        ),
        'message', case
          when new.status = 'approved' then format('Your application to %s was approved.', v_circle.name)
          else format('Your application to %s was declined.', v_circle.name)
        end
      )
    );
  end if;
  return new;
end; $$;


--
-- Name: notify_on_circle_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_circle_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_chat record;
  v_circle record;
  v_sender record;
begin
  -- only group (circle) chats
  select c.* into v_chat from public.chats c where c.id = new.chat_id;
  if v_chat.type <> 'group' or v_chat.circle_id is null then
    return new;
  end if;

  select id, name, emoji into v_circle from public.circles where id = v_chat.circle_id;
  select id, name, avatar_url into v_sender from public.profiles where id = new.sender_id;

  -- rate limit: skip if we already inserted a circle_activity for this chat
  -- and recipient within the last hour
  insert into public.notifications (user_id, type, payload, is_read)
  select cm.user_id,
         'circle_activity',
         jsonb_build_object(
           'circle', jsonb_build_object('id', v_circle.id, 'name', v_circle.name, 'emoji', coalesce(v_circle.emoji,'')),
           'user',   jsonb_build_object('id', v_sender.id, 'name', v_sender.name, 'avatar', coalesce(v_sender.avatar_url,'')),
           'chatId', new.chat_id,
           'message', 'posted a new message.'
         ),
         false
    from public.chat_members cm
    where cm.chat_id = new.chat_id
      and cm.user_id <> new.sender_id
      and not exists (
        select 1 from public.notifications n
         where n.user_id = cm.user_id
           and n.type = 'circle_activity'
           and (n.payload->>'chatId')::uuid = new.chat_id
           and n.created_at > now() - interval '1 hour'
      );
  return new;
end; $$;


--
-- Name: notify_on_connection_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_connection_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_requester record;
begin
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
    -- notify the requester that their request was accepted
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


--
-- Name: push_body_for(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_body_for(p_type text, p_payload jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when p_type in ('lfg_post', 'lfg_join', 'poll_created')
      then coalesce(p_payload->>'message', 'Tap to open')
    else btrim(
      coalesce(p_payload->>'name', p_payload->'user'->>'name', '')
      || ' ' || coalesce(p_payload->>'message', '')
    )
  end;
$$;


--
-- Name: push_on_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_on_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'net', 'vault'
    AS $$
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


--
-- Name: push_on_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_on_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'net', 'vault'
    AS $$
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


--
-- Name: push_title_for(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_title_for(p_type text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
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


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    text text NOT NULL,
    sort_order integer NOT NULL,
    tier integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: question_of_the_day(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.question_of_the_day() RETURNS public.questions
    LANGUAGE sql STABLE
    AS $$
  select q.* from public.questions q
  where q.active
  order by q.sort_order
  offset (
    (public.app_day() - date '2026-01-01')::int
    % greatest((select count(*) from public.questions where active), 1)
  )
  limit 1;
$$;


--
-- Name: redeem_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_invite(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_invite public.invites%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from public.invites where token = p_token for update;
  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.consumed_at is not null then
    if v_invite.consumed_by = v_uid then
      return v_invite.inviter_id;
    end if;
    raise exception 'Invite already used';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_invite.inviter_id = v_uid then
    raise exception 'Cannot redeem your own invite';
  end if;

  update public.invites
    set consumed_by = v_uid, consumed_at = now()
    where id = v_invite.id;

  insert into public.connection_requests (requester_id, recipient_id, status, responded_at)
    values (v_invite.inviter_id, v_uid, 'accepted', now())
    on conflict (requester_id, recipient_id)
    do update
      set status = 'accepted',
          responded_at = coalesce(public.connection_requests.responded_at, now());

  update public.connection_requests
    set status = 'accepted',
        responded_at = coalesce(responded_at, now())
    where requester_id = v_invite.inviter_id
      and recipient_id = v_uid
      and status <> 'accepted';

  insert into public.connections (user_id, connected_user_id)
    values (v_invite.inviter_id, v_uid)
    on conflict do nothing;

  insert into public.connections (user_id, connected_user_id)
    values (v_uid, v_invite.inviter_id)
    on conflict do nothing;

  return v_invite.inviter_id;
end;
$$;


--
-- Name: redeem_invite_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_invite_code(p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_circle_name text := null;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from public.invites where code = p_code for update;
  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'Invite limit reached';
  end if;

  if v_invite.inviter_id = v_uid then
    return jsonb_build_object('ok', true, 'self', true, 'circle_id', v_invite.circle_id);
  end if;

  update public.invites
    set use_count = use_count + 1
    where id = v_invite.id;

  insert into public.connection_requests (requester_id, recipient_id, status, responded_at)
    values (v_invite.inviter_id, v_uid, 'accepted', now())
    on conflict (requester_id, recipient_id)
    do update
      set status = 'accepted',
          responded_at = coalesce(public.connection_requests.responded_at, now());

  update public.connection_requests
    set status = 'accepted',
        responded_at = coalesce(responded_at, now())
    where requester_id = v_invite.inviter_id
      and recipient_id = v_uid
      and status <> 'accepted';

  insert into public.connections (user_id, connected_user_id)
    values (v_invite.inviter_id, v_uid)
    on conflict do nothing;

  insert into public.connections (user_id, connected_user_id)
    values (v_uid, v_invite.inviter_id)
    on conflict do nothing;

  if v_invite.circle_id is not null then
    insert into public.circle_members (circle_id, user_id, role)
      values (v_invite.circle_id, v_uid, 'member')
      on conflict do nothing;

    select name into v_circle_name from public.circles where id = v_invite.circle_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'self', false,
    'inviter_id', v_invite.inviter_id,
    'circle_id', v_invite.circle_id,
    'circle_name', v_circle_name
  );
end;
$$;


--
-- Name: register_device_token(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_device_token(p_token text, p_platform text DEFAULT 'ios'::text, p_environment text DEFAULT 'sandbox'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_token text := btrim(coalesce(p_token, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_token = '' then raise exception 'A device token is required'; end if;
  if p_platform not in ('ios','android') then raise exception 'Invalid platform'; end if;
  if p_environment not in ('sandbox','production') then raise exception 'Invalid environment'; end if;

  insert into public.device_tokens (user_id, token, platform, environment, last_seen_at)
  values (v_uid, v_token, p_platform, p_environment, now())
  on conflict (token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        environment  = excluded.environment,
        last_seen_at = now()
  returning id into v_id;

  return v_id;
end; $$;


--
-- Name: resign_game(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resign_game(p_game_id uuid) RETURNS public.games
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_winner text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if v_game.status <> 'in_progress' then return v_game; end if;

  if v_game.player_x = v_uid then v_winner := 'o';
  elsif v_game.player_o = v_uid then v_winner := 'x';
  else raise exception 'You are not a player in this game';
  end if;

  update public.games
     set status = 'completed',
         winner = v_winner,
         updated_at = now()
   where id = p_game_id
   returning * into v_game;

  return v_game;
end; $$;


--
-- Name: save_friend_group(text, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_friend_group(p_name text, p_member_ids uuid[], p_group_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_member uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_name = '' then raise exception 'A group needs a name'; end if;
  if char_length(v_name) > 40 then raise exception 'Group name is too long'; end if;

  if p_group_id is null then
    insert into public.friend_groups (owner_id, name)
    values (v_uid, v_name)
    returning id into v_id;
  else
    update public.friend_groups
       set name = v_name
     where id = p_group_id and owner_id = v_uid
    returning id into v_id;
    if v_id is null then raise exception 'Group not found'; end if;
    delete from public.friend_group_members where group_id = v_id;
  end if;

  if p_member_ids is not null then
    foreach v_member in array p_member_ids loop
      if v_member <> v_uid
         and public.are_connected(v_uid, v_member)
         and not public.is_blocked_with(v_member) then
        insert into public.friend_group_members (group_id, user_id)
        values (v_id, v_member)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_id;
end; $$;


--
-- Name: shared_meetup_count(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shared_meetup_count(p_user_a uuid, p_user_b uuid) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int
  from public.event_attendees ea1
  join public.event_attendees ea2 on ea1.event_id = ea2.event_id
  where ea1.user_id = p_user_a
    and ea2.user_id = p_user_b
$$;


--
-- Name: start_dm(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_dm(p_peer_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if auth.uid() = p_peer_id then
    raise exception 'Cannot DM yourself';
  end if;
  return public.ensure_dm_chat(auth.uid(), p_peer_id);
end;
$$;


--
-- Name: sync_chat_members_with_circle_members(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_chat_members_with_circle_members() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_chat_id uuid;
begin
  if tg_op = 'INSERT' then
    select id into v_chat_id from public.chats
      where type = 'group' and circle_id = new.circle_id
      limit 1;
    if v_chat_id is not null then
      insert into public.chat_members (chat_id, user_id)
        values (v_chat_id, new.user_id)
        on conflict do nothing;
    end if;
  elsif tg_op = 'DELETE' then
    select id into v_chat_id from public.chats
      where type = 'group' and circle_id = old.circle_id
      limit 1;
    if v_chat_id is not null then
      delete from public.chat_members
        where chat_id = v_chat_id and user_id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;


--
-- Name: sync_circle_member_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_circle_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.circles set member_count = member_count + 1 where id = new.circle_id;
  elsif tg_op = 'DELETE' then
    update public.circles set member_count = greatest(member_count - 1, 0) where id = old.circle_id;
  end if;
  return null;
end;
$$;


--
-- Name: sync_question_reveals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_question_reveals() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
  v_q public.questions%rowtype;
  v_chat record;
  v_my_ans public.daily_question_answers%rowtype;
  v_other_ans public.daily_question_answers%rowtype;
  v_my_name text;
  v_other_name text;
  v_payload jsonb;
  v_msg_id uuid;
  v_reveal_id uuid;
  v_first_user_id uuid;
  v_first_name text;
  v_first_text text;
  v_second_user_id uuid;
  v_second_name text;
  v_second_text text;
begin
  if v_uid is null then
    return;
  end if;

  -- Caller must have answered today
  select * into v_my_ans from public.daily_question_answers
    where user_id = v_uid and answer_day = v_today;
  if not found then
    return;
  end if;

  v_q := public.question_of_the_day();
  if v_q.id is null then
    return;
  end if;

  select name into v_my_name from public.profiles where id = v_uid;

  -- Find eligible chats where other member answered today and no reveal exists yet
  for v_chat in
    select cm1.chat_id, cm2.user_id as other_id, p.name as other_name
    from public.chat_members cm1
    join public.chat_members cm2 on cm2.chat_id = cm1.chat_id and cm2.user_id <> cm1.user_id
    join public.chats c on c.id = cm1.chat_id
    join public.profiles p on p.id = cm2.user_id
    where cm1.user_id = v_uid
      and c.type = 'dm'
  loop
    if public.is_question_eligible(v_chat.chat_id) then
      select * into v_other_ans from public.daily_question_answers
        where user_id = v_chat.other_id and answer_day = v_today;
      
      if v_other_ans.id is not null then
        if not exists (select 1 from public.question_reveals where chat_id = v_chat.chat_id and answer_day = v_today) then
          -- Reserve the reveal row safely
          begin
            insert into public.question_reveals (chat_id, answer_day)
              values (v_chat.chat_id, v_today)
              returning id into v_reveal_id;
          exception when unique_violation then
            v_reveal_id := null;
          end;

          if v_reveal_id is not null then
            -- Order answers by created_at ascending
            if v_my_ans.created_at <= v_other_ans.created_at then
              v_first_user_id := v_uid;
              v_first_name := v_my_name;
              v_first_text := v_my_ans.text;
              v_second_user_id := v_chat.other_id;
              v_second_name := v_chat.other_name;
              v_second_text := v_other_ans.text;
            else
              v_first_user_id := v_chat.other_id;
              v_first_name := v_chat.other_name;
              v_first_text := v_other_ans.text;
              v_second_user_id := v_uid;
              v_second_name := v_my_name;
              v_second_text := v_my_ans.text;
            end if;

            v_payload := jsonb_build_object(
              'variant', 'daily',
              'questionText', v_q.text,
              'answers', jsonb_build_array(
                jsonb_build_object('userId', v_first_user_id, 'name', v_first_name, 'text', v_first_text),
                jsonb_build_object('userId', v_second_user_id, 'name', v_second_name, 'text', v_second_text)
              )
            );

            insert into public.messages (chat_id, sender_id, text, kind, payload)
              values (v_chat.chat_id, v_uid, v_q.text, 'question', v_payload)
              returning id into v_msg_id;

            update public.question_reveals
               set message_id = v_msg_id
             where id = v_reveal_id;

            -- Notify recipient
            perform public.enqueue_notification(
              v_chat.other_id,
              'question_revealed',
              jsonb_build_object(
                'chatId', v_chat.chat_id,
                'name', v_my_name,
                'message', 'revealed daily question answers with you.'
              )
            );
          end if;
        end if;
      end if;
    end if;
  end loop;
end; $$;


--
-- Name: tic_tac_toe_winner(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tic_tac_toe_winner(p_cells jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  b text[];
  lines int[][] := array[
    array[0,1,2], array[3,4,5], array[6,7,8],   -- rows
    array[0,3,6], array[1,4,7], array[2,5,8],   -- cols
    array[0,4,8], array[2,4,6]                  -- diagonals
  ];
  ln int[];
  i int;
begin
  b := array(select coalesce(value, '') from jsonb_array_elements_text(p_cells) value);
  for i in 1..array_length(lines, 1) loop
    ln := lines[i];
    if b[ln[1]+1] <> '' and b[ln[1]+1] = b[ln[2]+1] and b[ln[2]+1] = b[ln[3]+1] then
      return b[ln[1]+1];
    end if;
  end loop;
  if not exists (select 1 from unnest(b) v where v = '') then
    return 'draw';
  end if;
  return null;
end; $$;


--
-- Name: toggle_message_reaction(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_message_reaction(p_message_id uuid, p_emoji text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_chat_id uuid;
  v_existing uuid;
begin
  select chat_id into v_chat_id from public.messages where id = p_message_id;
  if v_chat_id is null then
    raise exception 'Message not found';
  end if;

  if not public.is_chat_member(v_chat_id) then
    raise exception 'Not a member of this chat';
  end if;

  if p_emoji is null or length(trim(p_emoji)) = 0 or length(p_emoji) > 16 then
    raise exception 'Invalid emoji';
  end if;

  select id into v_existing
    from public.message_reactions
   where message_id = p_message_id
     and user_id = auth.uid()
     and emoji = p_emoji;

  if v_existing is not null then
    delete from public.message_reactions where id = v_existing;
    return false;
  end if;

  insert into public.message_reactions (message_id, chat_id, user_id, emoji)
  values (p_message_id, v_chat_id, auth.uid(), p_emoji);
  return true;
end;
$$;


--
-- Name: unblock_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unblock_user(p_target_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  delete from public.blocks
  where blocker_id = v_uid and blocked_id = p_target_id;
end; $$;


--
-- Name: unhide_chat(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unhide_chat(p_chat_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.chat_members
  set hidden_at = null
  where chat_id = p_chat_id
    and user_id = auth.uid();
$$;


--
-- Name: unregister_device_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unregister_device_token(p_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  delete from public.device_tokens
   where token = btrim(coalesce(p_token, '')) and user_id = v_uid;
end; $$;


--
-- Name: update_message_payload(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_message_payload(p_message_id uuid, p_payload jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: vote_poll(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vote_poll(p_poll_id uuid, p_option_index integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_existing boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_poll from public.polls where id = p_poll_id;
  if not found then raise exception 'Poll not found'; end if;
  if v_poll.closed_at is not null then raise exception 'This poll is closed'; end if;

  if not exists (
    select 1 from public.chat_members
    where chat_id = v_poll.chat_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this chat';
  end if;

  if p_option_index < 0 or p_option_index >= jsonb_array_length(v_poll.options) then
    raise exception 'Invalid option';
  end if;

  select exists (
    select 1 from public.poll_votes
    where poll_id = p_poll_id and user_id = v_uid and option_index = p_option_index
  ) into v_existing;

  if v_existing then
    delete from public.poll_votes
    where poll_id = p_poll_id and user_id = v_uid and option_index = p_option_index;
  else
    if not v_poll.allow_multiple then
      delete from public.poll_votes where poll_id = p_poll_id and user_id = v_uid;
    end if;
    insert into public.poll_votes (poll_id, user_id, option_index)
    values (p_poll_id, v_uid, p_option_index);
  end if;
end; $$;


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: application_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    hoop_id uuid NOT NULL,
    answer text
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid NOT NULL,
    applicant_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);


--
-- Name: battery_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.battery_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    points integer NOT NULL,
    reason text,
    result integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blocks_check CHECK ((blocker_id <> blocked_id))
);


--
-- Name: chat_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    name text NOT NULL
);


--
-- Name: chat_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_members (
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    last_read_at timestamp with time zone DEFAULT now(),
    hidden_at timestamp with time zone
);


--
-- Name: chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    circle_id uuid,
    name text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chats_type_check CHECK ((type = ANY (ARRAY['dm'::text, 'group'::text])))
);


--
-- Name: circle_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circle_members (
    circle_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT circle_members_role_check CHECK ((role = ANY (ARRAY['member'::text, 'organizer'::text, 'host'::text])))
);


--
-- Name: circles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    emoji text,
    city text,
    type text NOT NULL,
    category text,
    interest_tag text,
    member_count integer DEFAULT 0,
    cover_gradient text,
    description text,
    vibe text,
    rules text[] DEFAULT '{}'::text[],
    organizer_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    cover_image_url text,
    icon text,
    applications_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT circles_type_check CHECK ((type = ANY (ARRAY['open'::text, 'private'::text])))
);


--
-- Name: COLUMN circles.applications_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.circles.applications_enabled IS 'Private circles only. When true the circle accepts applications and is discoverable. When false the circle is invite-only and must be excluded from all discovery surfaces. Meaningless for type=''open''.';


--
-- Name: connection_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connection_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    responded_at timestamp with time zone,
    CONSTRAINT connection_requests_check CHECK ((requester_id <> recipient_id)),
    CONSTRAINT connection_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connections (
    user_id uuid NOT NULL,
    connected_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_hangout timestamp with time zone,
    CONSTRAINT connections_check CHECK ((user_id <> connected_user_id))
);


--
-- Name: daily_question_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_question_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    answer_day date NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text DEFAULT 'ios'::text NOT NULL,
    environment text DEFAULT 'sandbox'::text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_tokens_environment_check CHECK ((environment = ANY (ARRAY['sandbox'::text, 'production'::text]))),
    CONSTRAINT device_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])))
);


--
-- Name: event_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_attendees (
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    attended boolean,
    checked_in_at timestamp with time zone,
    checked_in_by uuid
);


--
-- Name: event_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    url text NOT NULL,
    storage_path text NOT NULL,
    caption text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    target_user_id uuid,
    emoji text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid,
    title text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    location text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    location_lat double precision,
    location_lng double precision,
    location_address text,
    cover_image_url text,
    recurrence_rule text DEFAULT 'none'::text,
    recurrence_end_date date,
    recurrence_parent_id uuid,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT events_recurrence_rule_check CHECK ((recurrence_rule = ANY (ARRAY['none'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text])))
);


--
-- Name: COLUMN events.location_lat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.location_lat IS 'Decimal degrees, set when the organizer picks a venue from autocomplete.';


--
-- Name: COLUMN events.location_lng; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.location_lng IS 'Decimal degrees, set when the organizer picks a venue from autocomplete.';


--
-- Name: COLUMN events.location_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.location_address IS 'Full address string returned by the geocoder; used for maps deeplinks and richer display.';


--
-- Name: events_with_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.events_with_counts WITH (security_invoker='on') AS
 SELECT e.id,
    e.circle_id,
    e.title,
    e.starts_at,
    e.location,
    e.notes,
    e.created_by,
    e.created_at,
    e.location_lat,
    e.location_lng,
    e.location_address,
    e.cover_image_url,
    e.recurrence_rule,
    e.recurrence_end_date,
    e.recurrence_parent_id,
    e.updated_at,
    COALESCE(a.cnt, 0) AS attendees_count,
    COALESCE(a.attended_cnt, 0) AS attended_count
   FROM (public.events e
     LEFT JOIN ( SELECT event_attendees.event_id,
            (count(*))::integer AS cnt,
            (count(*) FILTER (WHERE (event_attendees.attended = true)))::integer AS attended_cnt
           FROM public.event_attendees
          GROUP BY event_attendees.event_id) a ON ((a.event_id = e.id)));


--
-- Name: friend_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friend_group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: friend_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friend_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT friend_groups_name_len CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40)))
);


--
-- Name: google_calendar_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_tokens (
    user_id uuid NOT NULL,
    refresh_token text NOT NULL,
    access_token text,
    expires_at timestamp with time zone,
    scope text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hoops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hoops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid NOT NULL,
    type text NOT NULL,
    prompt text NOT NULL,
    options text[],
    order_index integer DEFAULT 0 NOT NULL,
    CONSTRAINT hoops_type_check CHECK ((type = ANY (ARRAY['written'::text, 'multiplechoice'::text])))
);


--
-- Name: lfg_joins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lfg_joins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lfg_post_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lfg_post_invites (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lfg_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lfg_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    activity text NOT NULL,
    place_name text,
    place_address text,
    latitude double precision,
    longitude double precision,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    visibility text DEFAULT 'everyone'::text NOT NULL,
    notify_connections boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lfg_posts_visibility_check CHECK ((visibility = ANY (ARRAY['everyone'::text, 'friends'::text])))
);


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    channel_id uuid,
    sender_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    kind text DEFAULT 'text'::text NOT NULL,
    payload jsonb
);


--
-- Name: COLUMN messages.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.kind IS 'Message variant. Default ''text'' renders as a plain bubble. Special kinds: ''game'' (payload carries gameId, gameType).';


--
-- Name: COLUMN messages.payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.payload IS 'Optional structured data accompanying non-text messages.';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_votes (
    poll_id uuid NOT NULL,
    user_id uuid NOT NULL,
    option_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT poll_votes_option_index_check CHECK ((option_index >= 0))
);


--
-- Name: polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.polls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    channel_id uuid,
    created_by uuid,
    question text NOT NULL,
    options jsonb NOT NULL,
    allow_multiple boolean DEFAULT false NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT polls_options_count CHECK (((jsonb_array_length(options) >= 2) AND (jsonb_array_length(options) <= 10))),
    CONSTRAINT polls_options_is_array CHECK ((jsonb_typeof(options) = 'array'::text)),
    CONSTRAINT polls_question_len CHECK (((char_length(btrim(question)) >= 1) AND (char_length(btrim(question)) <= 200)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    age integer,
    city text,
    bio text,
    avatar_url text,
    intents text[] DEFAULT '{}'::text[],
    interests text[] DEFAULT '{}'::text[],
    reconnect_threshold_days integer DEFAULT 21,
    search_radius integer DEFAULT 10,
    theme text DEFAULT 'dark'::text,
    battery_points integer DEFAULT 40,
    last_active_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    latitude double precision,
    longitude double precision,
    privacy jsonb DEFAULT jsonb_build_object('isPrivateProfile', false, 'showBio', true, 'showInterests', true, 'showCircles', true, 'showLocation', true, 'showAvailability', true) NOT NULL,
    intent_captured_at timestamp with time zone,
    intent_note text,
    notification_prefs jsonb DEFAULT '{"events": true, "messages": true, "connections": true, "chat_activity": true, "reconnect_nudges": true}'::jsonb
);


--
-- Name: COLUMN profiles.latitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.latitude IS 'Decimal degrees, set when user picks a city from autocomplete or shares browser location.';


--
-- Name: COLUMN profiles.longitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.longitude IS 'Decimal degrees, set when user picks a city from autocomplete or shares browser location.';


--
-- Name: COLUMN profiles.privacy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.privacy IS 'Per-section visibility flags. Enforced at app layer in v1. Keys: isPrivateProfile, showBio, showInterests, showCircles, showLocation, showAvailability.';


--
-- Name: question_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_prefs (
    user_id uuid NOT NULL,
    daily_enabled boolean DEFAULT true NOT NULL,
    last_dismissed_day date
);


--
-- Name: question_reveals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_reveals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    answer_day date NOT NULL,
    message_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid,
    reported_user_id uuid,
    reported_message_id uuid,
    reported_circle_id uuid,
    reason text NOT NULL,
    details text,
    context_snapshot jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT reports_check CHECK (((reported_user_id IS NOT NULL) OR (reported_message_id IS NOT NULL) OR (reported_circle_id IS NOT NULL))),
    CONSTRAINT reports_reason_check CHECK ((reason = ANY (ARRAY['harassment'::text, 'spam'::text, 'inappropriate_content'::text, 'impersonation'::text, 'safety_concern'::text, 'other'::text]))),
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'actioned'::text, 'dismissed'::text])))
);


--
-- Name: spontaneous_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spontaneous_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    asker_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    question_text text NOT NULL,
    asker_answer text NOT NULL,
    recipient_answer text,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '48:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT spontaneous_questions_check CHECK ((asker_id <> recipient_id)),
    CONSTRAINT spontaneous_questions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'revealed'::text, 'expired'::text])))
);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);


--
-- Name: application_answers application_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_answers
    ADD CONSTRAINT application_answers_pkey PRIMARY KEY (id);


--
-- Name: applications applications_circle_id_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_circle_id_applicant_id_key UNIQUE (circle_id, applicant_id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: battery_history battery_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battery_history
    ADD CONSTRAINT battery_history_pkey PRIMARY KEY (id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (blocker_id, blocked_id);


--
-- Name: chat_channels chat_channels_chat_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_chat_id_name_key UNIQUE (chat_id, name);


--
-- Name: chat_channels chat_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_pkey PRIMARY KEY (id);


--
-- Name: chat_members chat_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_pkey PRIMARY KEY (chat_id, user_id);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: circle_members circle_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_members
    ADD CONSTRAINT circle_members_pkey PRIMARY KEY (circle_id, user_id);


--
-- Name: circles circles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circles
    ADD CONSTRAINT circles_pkey PRIMARY KEY (id);


--
-- Name: connection_requests connection_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_requests
    ADD CONSTRAINT connection_requests_pkey PRIMARY KEY (id);


--
-- Name: connection_requests connection_requests_requester_id_recipient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_requests
    ADD CONSTRAINT connection_requests_requester_id_recipient_id_key UNIQUE (requester_id, recipient_id);


--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (user_id, connected_user_id);


--
-- Name: daily_question_answers daily_question_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_question_answers
    ADD CONSTRAINT daily_question_answers_pkey PRIMARY KEY (id);


--
-- Name: daily_question_answers daily_question_answers_user_id_answer_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_question_answers
    ADD CONSTRAINT daily_question_answers_user_id_answer_day_key UNIQUE (user_id, answer_day);


--
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- Name: event_attendees event_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_pkey PRIMARY KEY (event_id, user_id);


--
-- Name: event_photos event_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_photos
    ADD CONSTRAINT event_photos_pkey PRIMARY KEY (id);


--
-- Name: event_reactions event_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reactions
    ADD CONSTRAINT event_reactions_pkey PRIMARY KEY (id);


--
-- Name: event_reactions event_reactions_unique_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reactions
    ADD CONSTRAINT event_reactions_unique_key UNIQUE (event_id, user_id, target_user_id, emoji);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: friend_group_members friend_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_group_members
    ADD CONSTRAINT friend_group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: friend_groups friend_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_groups
    ADD CONSTRAINT friend_groups_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_tokens google_calendar_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_tokens
    ADD CONSTRAINT google_calendar_tokens_pkey PRIMARY KEY (user_id);


--
-- Name: hoops hoops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoops
    ADD CONSTRAINT hoops_pkey PRIMARY KEY (id);


--
-- Name: invites invites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_code_key UNIQUE (code);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: lfg_joins lfg_joins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_joins
    ADD CONSTRAINT lfg_joins_pkey PRIMARY KEY (id);


--
-- Name: lfg_joins lfg_joins_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_joins
    ADD CONSTRAINT lfg_joins_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: lfg_post_invites lfg_post_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_post_invites
    ADD CONSTRAINT lfg_post_invites_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: lfg_posts lfg_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_posts
    ADD CONSTRAINT lfg_posts_pkey PRIMARY KEY (id);


--
-- Name: message_reactions message_reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: poll_votes poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (poll_id, user_id, option_index);


--
-- Name: polls polls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: question_prefs question_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_prefs
    ADD CONSTRAINT question_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: question_reveals question_reveals_chat_id_answer_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_reveals
    ADD CONSTRAINT question_reveals_chat_id_answer_day_key UNIQUE (chat_id, answer_day);


--
-- Name: question_reveals question_reveals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_reveals
    ADD CONSTRAINT question_reveals_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: spontaneous_questions spontaneous_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spontaneous_questions
    ADD CONSTRAINT spontaneous_questions_pkey PRIMARY KEY (id);


--
-- Name: idx_battery_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_battery_user_created ON public.battery_history USING btree (user_id, created_at DESC);


--
-- Name: idx_blocks_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_blocked ON public.blocks USING btree (blocked_id);


--
-- Name: idx_blocks_blocker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_blocker ON public.blocks USING btree (blocker_id);


--
-- Name: idx_chat_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_members_user ON public.chat_members USING btree (user_id);


--
-- Name: idx_circle_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circle_members_user ON public.circle_members USING btree (user_id);


--
-- Name: idx_circles_discoverable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circles_discoverable ON public.circles USING btree (type, applications_enabled);


--
-- Name: idx_connreq_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connreq_recipient ON public.connection_requests USING btree (recipient_id, status);


--
-- Name: idx_device_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_device_tokens_token ON public.device_tokens USING btree (token);


--
-- Name: idx_device_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_tokens_user ON public.device_tokens USING btree (user_id);


--
-- Name: idx_dqa_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dqa_day ON public.daily_question_answers USING btree (answer_day);


--
-- Name: idx_event_attendees_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_attendees_user ON public.event_attendees USING btree (user_id);


--
-- Name: idx_event_photos_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_photos_event_id ON public.event_photos USING btree (event_id);


--
-- Name: idx_event_reactions_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_reactions_event_id ON public.event_reactions USING btree (event_id);


--
-- Name: idx_events_circle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_circle ON public.events USING btree (circle_id);


--
-- Name: idx_events_recurrence_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_recurrence_parent_id ON public.events USING btree (recurrence_parent_id);


--
-- Name: idx_events_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_starts_at ON public.events USING btree (starts_at);


--
-- Name: idx_friend_groups_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_groups_owner ON public.friend_groups USING btree (owner_id);


--
-- Name: idx_friend_groups_owner_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_friend_groups_owner_name ON public.friend_groups USING btree (owner_id, lower(btrim(name)));


--
-- Name: idx_games_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_games_chat ON public.games USING btree (chat_id);


--
-- Name: idx_games_players; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_games_players ON public.games USING btree (player_x, player_o);


--
-- Name: idx_hoops_circle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hoops_circle ON public.hoops USING btree (circle_id);


--
-- Name: idx_invites_circle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_circle_id ON public.invites USING btree (circle_id);


--
-- Name: idx_invites_code_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_invites_code_partial ON public.invites USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: idx_invites_inviter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_inviter ON public.invites USING btree (inviter_id);


--
-- Name: idx_invites_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_token ON public.invites USING btree (token);


--
-- Name: idx_lfg_joins_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lfg_joins_post ON public.lfg_joins USING btree (post_id);


--
-- Name: idx_lfg_posts_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lfg_posts_expires ON public.lfg_posts USING btree (expires_at);


--
-- Name: idx_lfg_posts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lfg_posts_user ON public.lfg_posts USING btree (user_id);


--
-- Name: idx_message_reactions_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_reactions_chat ON public.message_reactions USING btree (chat_id);


--
-- Name: idx_message_reactions_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_reactions_message ON public.message_reactions USING btree (message_id);


--
-- Name: idx_messages_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel ON public.messages USING btree (channel_id, created_at DESC);


--
-- Name: idx_messages_chat_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_chat_created ON public.messages USING btree (chat_id, created_at DESC);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_poll_votes_poll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poll_votes_poll ON public.poll_votes USING btree (poll_id);


--
-- Name: idx_polls_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polls_chat ON public.polls USING btree (chat_id);


--
-- Name: idx_questions_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_questions_sort ON public.questions USING btree (sort_order);


--
-- Name: idx_reports_reported_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_reported_user ON public.reports USING btree (reported_user_id);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status, created_at DESC);


--
-- Name: event_attendees trg_battery_on_attendance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_battery_on_attendance AFTER UPDATE ON public.event_attendees FOR EACH ROW EXECUTE FUNCTION public.award_battery_for_attendance();


--
-- Name: circles trg_chat_for_new_circle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chat_for_new_circle AFTER INSERT ON public.circles FOR EACH ROW EXECUTE FUNCTION public.create_chat_for_new_circle();


--
-- Name: circle_members trg_circle_member_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_circle_member_count AFTER INSERT OR DELETE ON public.circle_members FOR EACH ROW EXECUTE FUNCTION public.sync_circle_member_count();


--
-- Name: connection_requests trg_materialize_connection; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_materialize_connection AFTER INSERT OR UPDATE ON public.connection_requests FOR EACH ROW EXECUTE FUNCTION public.materialize_connection_on_accept();


--
-- Name: applications trg_notify_application_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_application_review AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_review();


--
-- Name: messages trg_notify_circle_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_circle_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_on_circle_message();


--
-- Name: connection_requests trg_notify_connection_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_connection_request AFTER INSERT OR UPDATE ON public.connection_requests FOR EACH ROW EXECUTE FUNCTION public.notify_on_connection_request();


--
-- Name: messages trg_push_on_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_push_on_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.push_on_message();


--
-- Name: notifications trg_push_on_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_push_on_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();


--
-- Name: circle_members trg_sync_chat_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_chat_members AFTER INSERT OR DELETE ON public.circle_members FOR EACH ROW EXECUTE FUNCTION public.sync_chat_members_with_circle_members();


--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: application_answers application_answers_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_answers
    ADD CONSTRAINT application_answers_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: application_answers application_answers_hoop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_answers
    ADD CONSTRAINT application_answers_hoop_id_fkey FOREIGN KEY (hoop_id) REFERENCES public.hoops(id) ON DELETE CASCADE;


--
-- Name: applications applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: applications applications_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: battery_history battery_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battery_history
    ADD CONSTRAINT battery_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_channels chat_channels_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chats chats_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: circle_members circle_members_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_members
    ADD CONSTRAINT circle_members_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: circle_members circle_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_members
    ADD CONSTRAINT circle_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: circles circles_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circles
    ADD CONSTRAINT circles_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: connection_requests connection_requests_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_requests
    ADD CONSTRAINT connection_requests_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: connection_requests connection_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_requests
    ADD CONSTRAINT connection_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: connections connections_connected_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_connected_user_id_fkey FOREIGN KEY (connected_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: connections connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_question_answers daily_question_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_question_answers
    ADD CONSTRAINT daily_question_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: daily_question_answers daily_question_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_question_answers
    ADD CONSTRAINT daily_question_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: device_tokens device_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_attendees event_attendees_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: event_attendees event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_attendees event_attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_photos event_photos_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_photos
    ADD CONSTRAINT event_photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_photos event_photos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_photos
    ADD CONSTRAINT event_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_reactions event_reactions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reactions
    ADD CONSTRAINT event_reactions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_reactions event_reactions_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reactions
    ADD CONSTRAINT event_reactions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_reactions event_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reactions
    ADD CONSTRAINT event_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: events events_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: events events_recurrence_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_recurrence_parent_id_fkey FOREIGN KEY (recurrence_parent_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: friend_group_members friend_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_group_members
    ADD CONSTRAINT friend_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.friend_groups(id) ON DELETE CASCADE;


--
-- Name: friend_group_members friend_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_group_members
    ADD CONSTRAINT friend_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: friend_groups friend_groups_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_groups
    ADD CONSTRAINT friend_groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: games games_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: games games_player_o_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_player_o_fkey FOREIGN KEY (player_o) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: games games_player_x_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_player_x_fkey FOREIGN KEY (player_x) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: google_calendar_tokens google_calendar_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_tokens
    ADD CONSTRAINT google_calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: hoops hoops_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoops
    ADD CONSTRAINT hoops_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: invites invites_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: invites invites_consumed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_consumed_by_fkey FOREIGN KEY (consumed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invites invites_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lfg_joins lfg_joins_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_joins
    ADD CONSTRAINT lfg_joins_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.lfg_posts(id) ON DELETE CASCADE;


--
-- Name: lfg_joins lfg_joins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_joins
    ADD CONSTRAINT lfg_joins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: lfg_post_invites lfg_post_invites_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_post_invites
    ADD CONSTRAINT lfg_post_invites_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.lfg_posts(id) ON DELETE CASCADE;


--
-- Name: lfg_post_invites lfg_post_invites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_post_invites
    ADD CONSTRAINT lfg_post_invites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: lfg_posts lfg_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lfg_posts
    ADD CONSTRAINT lfg_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;


--
-- Name: messages messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE;


--
-- Name: poll_votes poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: polls polls_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;


--
-- Name: polls polls_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: polls polls_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: question_prefs question_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_prefs
    ADD CONSTRAINT question_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: question_reveals question_reveals_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_reveals
    ADD CONSTRAINT question_reveals_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: question_reveals question_reveals_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_reveals
    ADD CONSTRAINT question_reveals_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: reports reports_reported_circle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_circle_id_fkey FOREIGN KEY (reported_circle_id) REFERENCES public.circles(id) ON DELETE SET NULL;


--
-- Name: reports reports_reported_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_message_id_fkey FOREIGN KEY (reported_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: reports reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: spontaneous_questions spontaneous_questions_asker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spontaneous_questions
    ADD CONSTRAINT spontaneous_questions_asker_id_fkey FOREIGN KEY (asker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: spontaneous_questions spontaneous_questions_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spontaneous_questions
    ADD CONSTRAINT spontaneous_questions_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: spontaneous_questions spontaneous_questions_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spontaneous_questions
    ADD CONSTRAINT spontaneous_questions_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: applications applicant creates own app; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "applicant creates own app" ON public.applications FOR INSERT TO authenticated WITH CHECK (((auth.uid() = applicant_id) AND (EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = applications.circle_id) AND (c.applications_enabled = true))))));


--
-- Name: application_answers applicant inserts own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "applicant inserts own answers" ON public.application_answers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.applications a
  WHERE ((a.id = application_answers.application_id) AND (a.applicant_id = auth.uid())))));


--
-- Name: application_answers applicant or organizer reads answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "applicant or organizer reads answers" ON public.application_answers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.applications a
     LEFT JOIN public.circles c ON ((c.id = a.circle_id)))
  WHERE ((a.id = application_answers.application_id) AND ((a.applicant_id = auth.uid()) OR (c.organizer_id = auth.uid()))))));


--
-- Name: applications applicant reads own apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "applicant reads own apps" ON public.applications FOR SELECT TO authenticated USING (((auth.uid() = applicant_id) OR (EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = applications.circle_id) AND (c.organizer_id = auth.uid()))))));


--
-- Name: application_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: event_photos attendees insert event photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "attendees insert event photos" ON public.event_photos FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.event_attendees ea
  WHERE ((ea.event_id = event_photos.event_id) AND (ea.user_id = auth.uid()))))));


--
-- Name: event_reactions attendees insert event reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "attendees insert event reactions" ON public.event_reactions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.event_attendees ea
  WHERE ((ea.event_id = event_reactions.event_id) AND (ea.user_id = auth.uid()))))));


--
-- Name: event_photos attendees view event photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "attendees view event photos" ON public.event_photos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.event_attendees ea
  WHERE ((ea.event_id = event_photos.event_id) AND (ea.user_id = auth.uid())))));


--
-- Name: event_reactions attendees view event reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "attendees view event reactions" ON public.event_reactions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.event_attendees ea
  WHERE ((ea.event_id = event_reactions.event_id) AND (ea.user_id = auth.uid())))));


--
-- Name: chats auth user creates chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth user creates chat" ON public.chats FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: circles auth users can create circles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth users can create circles" ON public.circles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = organizer_id));


--
-- Name: lfg_post_invites author or invitee reads lfg invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "author or invitee reads lfg invites" ON public.lfg_post_invites FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.lfg_posts p
  WHERE ((p.id = lfg_post_invites.post_id) AND (p.user_id = auth.uid()))))));


--
-- Name: battery_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.battery_history ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: message_reactions chat members add own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members add own reactions" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.is_chat_member(chat_id)));


--
-- Name: chat_channels chat members create channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members create channels" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (public.is_chat_member(chat_id));


--
-- Name: chat_channels chat members read channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members read channels" ON public.chat_channels FOR SELECT TO authenticated USING (public.is_chat_member(chat_id));


--
-- Name: chats chat members read chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members read chat" ON public.chats FOR SELECT TO authenticated USING (public.is_chat_member(id));


--
-- Name: chat_members chat members read membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members read membership" ON public.chat_members FOR SELECT TO authenticated USING (public.is_chat_member(chat_id));


--
-- Name: messages chat members read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members read messages" ON public.messages FOR SELECT TO authenticated USING ((public.is_chat_member(chat_id) AND ((sender_id IS NULL) OR (sender_id = auth.uid()) OR (NOT public.is_blocked_with(sender_id)))));


--
-- Name: message_reactions chat members read reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members read reactions" ON public.message_reactions FOR SELECT TO authenticated USING (public.is_chat_member(chat_id));


--
-- Name: messages chat members send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat members send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (((auth.uid() = sender_id) AND public.is_chat_member(chat_id)));


--
-- Name: chat_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

--
-- Name: chats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

--
-- Name: circles circle admins update circle; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "circle admins update circle" ON public.circles FOR UPDATE TO authenticated USING (public.is_circle_admin(id)) WITH CHECK (public.is_circle_admin(id));


--
-- Name: circle_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

--
-- Name: circle_members circle_members readable when permitted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "circle_members readable when permitted" ON public.circle_members FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = circle_members.circle_id) AND (c.type = 'open'::text)))) OR public.is_circle_member(circle_id)));


--
-- Name: circles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

--
-- Name: circles circles readable by authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "circles readable by authenticated" ON public.circles FOR SELECT TO authenticated USING (true);


--
-- Name: connection_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

--
-- Name: lfg_posts create own lfg posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "create own lfg posts" ON public.lfg_posts FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: events creator deletes own event; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "creator deletes own event" ON public.events FOR DELETE TO authenticated USING ((auth.uid() = created_by));


--
-- Name: events creator updates own event; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "creator updates own event" ON public.events FOR UPDATE TO authenticated USING ((auth.uid() = created_by)) WITH CHECK ((auth.uid() = created_by));


--
-- Name: daily_question_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_question_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: lfg_posts delete own lfg posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete own lfg posts" ON public.lfg_posts FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: device_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_question_answers dqa: read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dqa: read own" ON public.daily_question_answers FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: event_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: event_attendees event_attendees readable when permitted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "event_attendees readable when permitted" ON public.event_attendees FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.events e
  WHERE (e.id = event_attendees.event_id)))));


--
-- Name: event_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: event_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events readable when permitted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "events readable when permitted" ON public.events FOR SELECT TO authenticated USING (((circle_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = events.circle_id) AND (c.type = 'open'::text)))) OR public.is_circle_member(circle_id)));


--
-- Name: friend_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friend_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: friend_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friend_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

--
-- Name: games games: players read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "games: players read" ON public.games FOR SELECT TO authenticated USING (((auth.uid() = player_x) OR (auth.uid() = player_o)));


--
-- Name: games games: players update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "games: players update" ON public.games FOR UPDATE TO authenticated USING (((auth.uid() = player_x) OR (auth.uid() = player_o))) WITH CHECK (((auth.uid() = player_x) OR (auth.uid() = player_o)));


--
-- Name: google_calendar_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: hoops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hoops ENABLE ROW LEVEL SECURITY;

--
-- Name: hoops hoops readable by authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "hoops readable by authenticated" ON public.hoops FOR SELECT TO authenticated USING (true);


--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: invites invites: inviter creates own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invites: inviter creates own" ON public.invites FOR INSERT TO authenticated WITH CHECK ((auth.uid() = inviter_id));


--
-- Name: invites invites: inviter reads own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invites: inviter reads own" ON public.invites FOR SELECT TO authenticated USING ((auth.uid() = inviter_id));


--
-- Name: invites invites: public reads by code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invites: public reads by code" ON public.invites FOR SELECT TO authenticated, anon USING (((code IS NOT NULL) AND (expires_at > now())));


--
-- Name: circle_members join open or via approved app or organizer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "join open or via approved app or organizer" ON public.circle_members FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = circle_members.circle_id) AND (c.type = 'open'::text)))) OR (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE ((a.circle_id = a.circle_id) AND (a.applicant_id = auth.uid()) AND (a.status = 'approved'::text)))) OR (EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = circle_members.circle_id) AND (c.organizer_id = auth.uid())))))));


--
-- Name: lfg_joins leave own lfg join; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "leave own lfg join" ON public.lfg_joins FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: lfg_joins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lfg_joins ENABLE ROW LEVEL SECURITY;

--
-- Name: lfg_post_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lfg_post_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: lfg_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lfg_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: events members create circle events or own community events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members create circle events or own community events" ON public.events FOR INSERT TO authenticated WITH CHECK (((auth.uid() = created_by) AND ((circle_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.circle_members m
  WHERE ((m.circle_id = events.circle_id) AND (m.user_id = auth.uid())))))));


--
-- Name: message_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: circles organizer can delete own circle; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organizer can delete own circle" ON public.circles FOR DELETE TO authenticated USING ((auth.uid() = organizer_id));


--
-- Name: hoops organizer manages hoops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organizer manages hoops" ON public.hoops TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = hoops.circle_id) AND (c.organizer_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = hoops.circle_id) AND (c.organizer_id = auth.uid())))));


--
-- Name: applications organizer reviews app; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organizer reviews app" ON public.applications FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.circles c
  WHERE ((c.id = applications.circle_id) AND (c.organizer_id = auth.uid())))));


--
-- Name: friend_groups owner deletes own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner deletes own groups" ON public.friend_groups FOR DELETE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: friend_group_members owner reads own group members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner reads own group members" ON public.friend_group_members FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.friend_groups g
  WHERE ((g.id = friend_group_members.group_id) AND (g.owner_id = auth.uid())))));


--
-- Name: friend_groups owner reads own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner reads own groups" ON public.friend_groups FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: poll_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: poll_votes poll_votes: chat members read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "poll_votes: chat members read" ON public.poll_votes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.polls p
     JOIN public.chat_members cm ON ((cm.chat_id = p.chat_id)))
  WHERE ((p.id = poll_votes.poll_id) AND (cm.user_id = auth.uid())))));


--
-- Name: polls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

--
-- Name: polls polls: chat members read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "polls: chat members read" ON public.polls FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.chat_members cm
  WHERE ((cm.chat_id = polls.chat_id) AND (cm.user_id = auth.uid())))));


--
-- Name: question_prefs prefs: own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "prefs: own all" ON public.question_prefs TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles readable by all authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles readable by all authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: question_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: question_reveals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_reveals ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: questions questions: all read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "questions: all read" ON public.questions FOR SELECT TO authenticated USING (true);


--
-- Name: lfg_joins read relevant lfg joins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read relevant lfg joins" ON public.lfg_joins FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.lfg_posts p
  WHERE ((p.id = lfg_joins.post_id) AND (p.user_id = auth.uid()))))));


--
-- Name: lfg_posts read visible lfg posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read visible lfg posts" ON public.lfg_posts FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ((expires_at > now()) AND (NOT public.is_blocked_with(user_id)) AND ((visibility = 'everyone'::text) OR ((visibility = 'friends'::text) AND public.are_connected(auth.uid(), user_id))))));


--
-- Name: connection_requests recipient updates request status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "recipient updates request status" ON public.connection_requests FOR UPDATE TO authenticated USING ((auth.uid() = recipient_id));


--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: connection_requests requester or recipient deletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "requester or recipient deletes" ON public.connection_requests FOR DELETE TO authenticated USING (((auth.uid() = requester_id) OR (auth.uid() = recipient_id)));


--
-- Name: question_reveals reveals: members read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reveals: members read" ON public.question_reveals FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.chat_members cm
  WHERE ((cm.chat_id = question_reveals.chat_id) AND (cm.user_id = auth.uid())))));


--
-- Name: spontaneous_questions spontaneous: asker select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "spontaneous: asker select" ON public.spontaneous_questions FOR SELECT TO authenticated USING ((auth.uid() = asker_id));


--
-- Name: spontaneous_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spontaneous_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications system inserts notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system inserts notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lfg_posts update own lfg posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update own lfg posts" ON public.lfg_posts FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: event_photos uploader or host delete event photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "uploader or host delete event photos" ON public.event_photos FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_photos.event_id) AND (e.created_by = auth.uid()))))));


--
-- Name: event_attendees user RSVPs self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user RSVPs self" ON public.event_attendees FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_members user adds self to chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user adds self to chat" ON public.chat_members FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: event_attendees user cancels own RSVP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user cancels own RSVP" ON public.event_attendees FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: event_reactions user delete own event reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user delete own event reactions" ON public.event_reactions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: connections user deletes own connection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user deletes own connection" ON public.connections FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: device_tokens user deletes own device tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user deletes own device tokens" ON public.device_tokens FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications user deletes own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user deletes own notifications" ON public.notifications FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: battery_history user inserts own battery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user inserts own battery" ON public.battery_history FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: battery_history user reads own battery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user reads own battery" ON public.battery_history FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: connections user reads own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user reads own connections" ON public.connections FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (auth.uid() = connected_user_id)));


--
-- Name: device_tokens user reads own device tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user reads own device tokens" ON public.device_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications user reads own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user reads own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_members user removes own chat membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user removes own chat membership" ON public.chat_members FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_members user updates own chat membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user updates own chat membership" ON public.chat_members FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notifications user updates own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: blocks users create their own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create their own blocks" ON public.blocks FOR INSERT TO authenticated WITH CHECK ((auth.uid() = blocker_id));


--
-- Name: reports users file reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users file reports" ON public.reports FOR INSERT TO authenticated WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: profiles users insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: circle_members users leave their own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users leave their own membership" ON public.circle_members FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: blocks users read their own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read their own blocks" ON public.blocks FOR SELECT TO authenticated USING ((auth.uid() = blocker_id));


--
-- Name: reports users read their own reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read their own reports" ON public.reports FOR SELECT TO authenticated USING ((auth.uid() = reporter_id));


--
-- Name: message_reactions users remove own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users remove own reactions" ON public.message_reactions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: blocks users remove their own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users remove their own blocks" ON public.blocks FOR DELETE TO authenticated USING ((auth.uid() = blocker_id));


--
-- Name: connection_requests users see requests they sent or received; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users see requests they sent or received" ON public.connection_requests FOR SELECT TO authenticated USING (((auth.uid() = requester_id) OR (auth.uid() = recipient_id)));


--
-- Name: connection_requests users send their own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users send their own requests" ON public.connection_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = requester_id));


--
-- Name: profiles users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- PostgreSQL database dump complete
--

\unrestrict m0XrNPjrygGGNVqBg785X7ckr6Hg7UIqcpUNUSCqSCCdZvszYNWv7wHq7VAS8AO

