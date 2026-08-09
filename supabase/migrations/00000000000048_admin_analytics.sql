-- =============================================================================
-- THIRD SPACE — MIGRATION 37: ADMIN ANALYTICS LAYER
-- Additive & append-only admin analytics RPCs & helper table/functions.
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════
-- PART 1 — ADMIN GATE
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- Intentionally NO policies: this table is unreadable except via SECURITY DEFINER.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- PART 2 — SHARED ACTIVITY HELPER
-- ═══════════════════════════════════════════════════════════════

create or replace function public._admin_activity(p_from date)
returns table (day date, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
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

revoke all on function public._admin_activity(date) from anon;
grant execute on function public._admin_activity(date) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- PART 3 — ANALYTICS RPCs
-- ═══════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------
-- 1. admin_overview(p_days int default 30)
-- ---------------------------------------------------------------
create or replace function public.admin_overview(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_overview(int) from anon;
grant execute on function public.admin_overview(int) to authenticated;

-- ---------------------------------------------------------------
-- 2. admin_growth_series(p_days int default 30)
-- ---------------------------------------------------------------
create or replace function public.admin_growth_series(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_growth_series(int) from anon;
grant execute on function public.admin_growth_series(int) to authenticated;

-- ---------------------------------------------------------------
-- 3. admin_onboarding_funnel()
-- ---------------------------------------------------------------
create or replace function public.admin_onboarding_funnel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_onboarding_funnel() from anon;
grant execute on function public.admin_onboarding_funnel() to authenticated;

-- ---------------------------------------------------------------
-- 4. admin_circle_stats(p_limit int default 100)
-- ---------------------------------------------------------------
create or replace function public.admin_circle_stats(p_limit int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_circle_stats(int) from anon;
grant execute on function public.admin_circle_stats(int) to authenticated;

-- ---------------------------------------------------------------
-- 5. admin_event_stats(p_days int default 90)
-- ---------------------------------------------------------------
create or replace function public.admin_event_stats(p_days int default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_event_stats(int) from anon;
grant execute on function public.admin_event_stats(int) to authenticated;

-- ---------------------------------------------------------------
-- 6. admin_connection_stats()
-- ---------------------------------------------------------------
create or replace function public.admin_connection_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_connection_stats() from anon;
grant execute on function public.admin_connection_stats() to authenticated;

-- ---------------------------------------------------------------
-- 7. admin_retention_cohorts(p_weeks int default 8)
-- ---------------------------------------------------------------
create or replace function public.admin_retention_cohorts(p_weeks int default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_retention_cohorts(int) from anon;
grant execute on function public.admin_retention_cohorts(int) to authenticated;

-- ---------------------------------------------------------------
-- 8. admin_recent_users(p_limit int default 50)
-- ---------------------------------------------------------------
create or replace function public.admin_recent_users(p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_recent_users(int) from anon;
grant execute on function public.admin_recent_users(int) to authenticated;

-- ---------------------------------------------------------------
-- 9. admin_content_stats(p_days int default 30)
-- ---------------------------------------------------------------
create or replace function public.admin_content_stats(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

revoke all on function public.admin_content_stats(int) from anon;
grant execute on function public.admin_content_stats(int) to authenticated;
