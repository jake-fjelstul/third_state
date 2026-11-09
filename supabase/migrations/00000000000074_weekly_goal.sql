-- 074: Weekly goal on the social battery.
--
-- Each person has a target number of real-life meetups per week (default 1,
-- 1 to 5). A week runs Monday to Sunday in the person's own time zone.
-- What counts as a meetup:
--   * an event or coffee chat you went to (attended, or RSVP'd and the event
--     is over without the organizer marking you absent)
--   * an "I'm free" post you joined, or one of yours that someone joined
-- Messages and games do not count.
-- Reaching the target once in a week gives +15 battery and extends the streak.

create table if not exists public.weekly_goals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  target  integer not null default 1 check (target between 1 and 5)
);

create table if not exists public.weekly_goal_weeks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  met_at     timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.weekly_goals enable row level security;
alter table public.weekly_goal_weeks enable row level security;

drop policy if exists "weekly_goals: own read" on public.weekly_goals;
create policy "weekly_goals: own read" on public.weekly_goals
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "weekly_goal_weeks: own read" on public.weekly_goal_weeks;
create policy "weekly_goal_weeks: own read" on public.weekly_goal_weeks
  for select to authenticated using (auth.uid() = user_id);
-- Writes only happen through the functions below.

-- Meetups for one person in the week starting p_week_start (their local Monday).
create or replace function public._weekly_meetup_count(p_user_id uuid, p_week_start date, p_tz text)
returns integer
language sql
stable
security definer set search_path = public
as $$
  with bounds as (
    select (p_week_start::timestamp at time zone p_tz) as lo,
           ((p_week_start + 7)::timestamp at time zone p_tz) as hi
  )
  select (
    (select count(*) from public.event_attendees ea
       join public.events e on e.id = ea.event_id, bounds b
      where ea.user_id = p_user_id
        and e.starts_at >= b.lo and e.starts_at < b.hi
        and (ea.attended = true
             or (ea.attended is null and coalesce(e.ends_at, e.starts_at + interval '2 hours') < now())))
    +
    (select count(*) from public.lfg_joins j
       join public.lfg_posts p on p.id = j.post_id, bounds b
      where j.user_id = p_user_id and p.user_id <> p_user_id
        and p.starts_at >= b.lo and p.starts_at < b.hi)
    +
    (select count(*) from public.lfg_posts p, bounds b
      where p.user_id = p_user_id
        and p.starts_at >= b.lo and p.starts_at < b.hi
        and exists (select 1 from public.lfg_joins j where j.post_id = p.id and j.user_id <> p_user_id))
  )::integer;
$$;

revoke execute on function public._weekly_meetup_count(uuid, date, text) from public, anon, authenticated;

create or replace function public.get_weekly_goal()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_tz      text;
  v_target  integer;
  v_week    date;
  v_count   integer;
  v_prev    integer;
  v_met     boolean;
  v_streak  integer := 0;
  v_cursor  date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(nullif(timezone, ''), 'America/Chicago') into v_tz from public.profiles where id = v_uid;
  begin
    perform now() at time zone v_tz;
  exception when others then
    v_tz := 'America/Chicago';
  end;

  select target into v_target from public.weekly_goals where user_id = v_uid;
  v_target := coalesce(v_target, 1);

  v_week  := date_trunc('week', now() at time zone v_tz)::date;  -- Monday
  v_count := public._weekly_meetup_count(v_uid, v_week, v_tz);

  -- Last week still counts if it was reached but the app was not opened.
  if not exists (select 1 from public.weekly_goal_weeks where user_id = v_uid and week_start = v_week - 7) then
    v_prev := public._weekly_meetup_count(v_uid, v_week - 7, v_tz);
    if v_prev >= v_target then
      insert into public.weekly_goal_weeks (user_id, week_start) values (v_uid, v_week - 7)
      on conflict do nothing;
    end if;
  end if;

  if v_count >= v_target then
    insert into public.weekly_goal_weeks (user_id, week_start) values (v_uid, v_week)
    on conflict do nothing;
    if found then
      perform public._battery_apply(v_uid, 15, 'Weekly goal reached');
    end if;
  end if;

  v_met := exists (select 1 from public.weekly_goal_weeks where user_id = v_uid and week_start = v_week);

  -- Streak: weeks in a row, ending this week if reached, otherwise last week.
  v_cursor := case when v_met then v_week else v_week - 7 end;
  while exists (select 1 from public.weekly_goal_weeks where user_id = v_uid and week_start = v_cursor) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 7;
  end loop;

  return jsonb_build_object(
    'target', v_target,
    'count', v_count,
    'met', v_met,
    'streak', v_streak,
    'weekStart', v_week
  );
end; $$;

revoke execute on function public.get_weekly_goal() from public, anon;
grant execute on function public.get_weekly_goal() to authenticated;

create or replace function public.set_weekly_goal(p_target integer)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.weekly_goals (user_id, target)
  values (v_uid, greatest(1, least(5, coalesce(p_target, 1))))
  on conflict (user_id) do update set target = excluded.target;
  return public.get_weekly_goal();
end; $$;

revoke execute on function public.set_weekly_goal(integer) from public, anon;
grant execute on function public.set_weekly_goal(integer) to authenticated;
