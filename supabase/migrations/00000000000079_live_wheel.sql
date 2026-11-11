-- 079: The live wheel on Home (plan-2026-11-10.md, Part 3).
--
-- A check-in is an lfg_posts row with a place, one of four wheel categories
-- and an expiry. Pull-ups ride on lfg_joins (with an ETA). Table notes are a
-- short-lived thread for everyone at a table. Everything that already reads
-- lfg_posts (Discovery, notifications, the weekly goal) keeps working.

-- ============================================================================
-- Schema
-- ============================================================================
alter table public.lfg_posts
  add column if not exists category text,
  add column if not exists spot_id uuid references public.spots(id) on delete set null,
  add column if not exists circle_id uuid references public.circles(id) on delete set null,
  add column if not exists seats int,
  add column if not exists ended_at timestamptz;

alter table public.lfg_posts drop constraint if exists lfg_posts_category_check;
alter table public.lfg_posts add constraint lfg_posts_category_check
  check (category is null or category in ('study', 'food', 'hang', 'active'));
alter table public.lfg_posts drop constraint if exists lfg_posts_seats_check;
alter table public.lfg_posts add constraint lfg_posts_seats_check
  check (seats is null or seats between 1 and 12);
alter table public.lfg_posts drop constraint if exists lfg_posts_visibility_check;
alter table public.lfg_posts add constraint lfg_posts_visibility_check
  check (visibility in ('everyone', 'friends', 'circles', 'circle'));

create index if not exists idx_lfg_posts_live on public.lfg_posts (expires_at) where ended_at is null;
create index if not exists idx_lfg_posts_spot on public.lfg_posts (spot_id);

alter table public.lfg_joins
  add column if not exists eta_at timestamptz,
  add column if not exists arrived_at timestamptz;

create table if not exists public.checkin_notes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.lfg_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 140),
  created_at timestamptz not null default now()
);
create index if not exists idx_checkin_notes_post on public.checkin_notes (post_id, created_at);
alter table public.checkin_notes enable row level security;

create table if not exists public.wheel_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null check (category in ('study', 'food', 'hang', 'active')),
  spot_id    uuid not null references public.spots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category, spot_id)
);
alter table public.wheel_favorites enable row level security;
drop policy if exists "wheel_favorites: own" on public.wheel_favorites;
create policy "wheel_favorites: own" on public.wheel_favorites
  for select to authenticated using (user_id = auth.uid());

-- ============================================================================
-- Helpers
-- ============================================================================

-- Can p_viewer see this post?
create or replace function public._can_see_checkin(p_post uuid, p_viewer uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.lfg_posts p
     where p.id = p_post
       and (
         p.user_id = p_viewer
         or exists (select 1 from public.lfg_joins j where j.post_id = p.id and j.user_id = p_viewer)
         or (
           not exists (
             select 1 from public.blocks b
              where (b.blocker_id = p.user_id and b.blocked_id = p_viewer)
                 or (b.blocker_id = p_viewer and b.blocked_id = p.user_id)
           )
           and (
             p.visibility = 'everyone'
             or (p.visibility = 'friends' and public.are_connected(p_viewer, p.user_id))
             or (p.visibility = 'circles' and (
                   public.are_connected(p_viewer, p.user_id)
                   or exists (select 1 from public.circle_members a
                                join public.circle_members b on b.circle_id = a.circle_id
                               where a.user_id = p.user_id and b.user_id = p_viewer)))
             or (p.visibility = 'circle' and exists (
                   select 1 from public.circle_members m
                    where m.circle_id = p.circle_id and m.user_id = p_viewer))
           )
         )
       )
  );
$$;
revoke execute on function public._can_see_checkin(uuid, uuid) from public, anon;
grant execute on function public._can_see_checkin(uuid, uuid) to authenticated;

-- Which spots belong to a wheel category (OpenStreetMap kinds in public.spots).
create or replace function public._wheel_spot_matches(p_category text, p_spot_category text, p_kind text)
returns boolean language sql immutable as $$
  select case p_category
    when 'study'  then p_kind in ('cafe', 'library', 'books', 'coworking_space', 'university', 'college')
    when 'food'   then p_spot_category in ('food', 'coffee')
    when 'hang'   then p_spot_category in ('outdoors', 'drinks', 'arts', 'sights', 'browse') and p_kind not in ('dog_park')
    when 'active' then p_spot_category = 'active'
                       or p_kind in ('park', 'nature_reserve', 'climbing', 'sports_centre', 'fitness_centre',
                                     'pitch', 'track', 'swimming_pool', 'dog_park')
    else false
  end;
$$;

-- Read policy on lfg_posts follows the same rules (Discovery reads the table).
drop policy if exists "read visible lfg posts" on public.lfg_posts;
create policy "read visible lfg posts"
  on public.lfg_posts for select to authenticated
  using (user_id = auth.uid() or (expires_at > now() and public._can_see_checkin(id, auth.uid())));

-- Everyone at a table can see who else is there.
drop policy if exists "read relevant lfg joins" on public.lfg_joins;
create policy "read relevant lfg joins"
  on public.lfg_joins for select to authenticated
  using (user_id = auth.uid() or public._can_see_checkin(post_id, auth.uid()));

-- Notes: readable by the host and everyone pulled up while the check-in is live.
drop policy if exists "checkin notes: table reads" on public.checkin_notes;
create policy "checkin notes: table reads"
  on public.checkin_notes for select to authenticated
  using (exists (
    select 1 from public.lfg_posts p
     where p.id = checkin_notes.post_id
       and p.ended_at is null and p.expires_at > now()
       and (p.user_id = auth.uid()
            or exists (select 1 from public.lfg_joins j where j.post_id = p.id and j.user_id = auth.uid()))
  ));

-- join_lfg_post honours the new visibility levels.
create or replace function public.join_lfg_post(p_post_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_post public.lfg_posts%rowtype;
  v_name text;
  v_inserted boolean := false;
begin
  select * into v_post from public.lfg_posts where id = p_post_id;
  if v_post.id is null then raise exception 'Post not found'; end if;
  if v_post.user_id = auth.uid() then raise exception 'Cannot join your own post'; end if;
  if v_post.expires_at <= now() or v_post.ended_at is not null then raise exception 'This post has expired'; end if;
  if not public._can_see_checkin(p_post_id, auth.uid()) then raise exception 'Post not available'; end if;

  insert into public.lfg_joins (post_id, user_id)
  values (p_post_id, auth.uid())
  on conflict (post_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted then
    select name into v_name from public.profiles where id = auth.uid();
    perform public.enqueue_notification(
      v_post.user_id, 'lfg_join',
      jsonb_build_object(
        'user', jsonb_build_object('id', auth.uid(), 'name', coalesce(v_name, 'Someone')),
        'message', coalesce(v_name, 'Someone') || ' is in for ' || v_post.activity,
        'postId', p_post_id));
  end if;
  return true;
end;
$$;

-- ============================================================================
-- Check-ins
-- ============================================================================

-- End whatever I'm doing now: my own live check-in and any table I pulled up to.
create or replace function public._end_my_live(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.lfg_posts
     set ended_at = now(), expires_at = least(expires_at, now())
   where user_id = p_uid and ended_at is null and expires_at > now();
  delete from public.lfg_joins j
   using public.lfg_posts p
   where j.post_id = p.id and j.user_id = p_uid and p.expires_at > now() and p.ended_at is null;
end; $$;
revoke execute on function public._end_my_live(uuid) from public, anon, authenticated;

create or replace function public.create_checkin(
  p_category text,
  p_spot_id uuid default null,
  p_place_name text default null,
  p_place_address text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_minutes int default 120,
  p_visibility text default 'circles',
  p_circle_id uuid default null,
  p_seats int default null,
  p_notify boolean default true
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_spot public.spots%rowtype;
  v_name text;
  v_place text;
  v_label text;
  v_id uuid;
  v_conn uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_category not in ('study', 'food', 'hang', 'active') then raise exception 'Pick a category'; end if;
  if p_visibility not in ('everyone', 'friends', 'circles', 'circle') then raise exception 'Invalid visibility'; end if;
  if p_visibility = 'circle' and not exists (
       select 1 from public.circle_members where circle_id = p_circle_id and user_id = v_uid) then
    raise exception 'You are not in that circle';
  end if;

  if p_spot_id is not null then
    select * into v_spot from public.spots where id = p_spot_id;
    if not found then raise exception 'Spot not found'; end if;
  end if;
  v_place := coalesce(nullif(btrim(p_place_name), ''), v_spot.name);
  if v_place is null then raise exception 'Pick a place'; end if;

  v_label := case p_category
               when 'study' then 'Studying' when 'food' then 'Food & coffee'
               when 'hang' then 'Hanging out' else 'Active' end;

  perform public._end_my_live(v_uid);

  insert into public.lfg_posts (
    user_id, activity, place_name, place_address, latitude, longitude,
    starts_at, expires_at, visibility, notify_connections,
    category, spot_id, circle_id, seats
  ) values (
    v_uid, v_label || ' at ' || v_place,
    v_place, coalesce(nullif(btrim(p_place_address), ''), v_spot.address),
    coalesce(p_lat, v_spot.latitude), coalesce(p_lng, v_spot.longitude),
    now(), now() + make_interval(mins => least(greatest(coalesce(p_minutes, 120), 15), 360)),
    p_visibility, coalesce(p_notify, true),
    p_category, p_spot_id, case when p_visibility = 'circle' then p_circle_id end,
    case when p_seats between 1 and 12 then p_seats end
  ) returning id into v_id;

  -- Tell connections who can see it (not every circle-mate: that would be noisy).
  if coalesce(p_notify, true) then
    select name into v_name from public.profiles where id = v_uid;
    for v_conn in
      select connected_user_id from public.connections where user_id = v_uid
    loop
      if public._can_see_checkin(v_id, v_conn) then
        perform public.enqueue_notification(
          v_conn, 'lfg_post',
          jsonb_build_object(
            'user', jsonb_build_object('id', v_uid, 'name', coalesce(v_name, 'Someone')),
            'message', coalesce(v_name, 'Someone') || ' is at ' || v_place,
            'postId', v_id));
      end if;
    end loop;
  end if;

  return v_id;
end; $$;
revoke execute on function public.create_checkin(text, uuid, text, text, double precision, double precision, int, text, uuid, int, boolean) from public, anon;
grant execute on function public.create_checkin(text, uuid, text, text, double precision, double precision, int, text, uuid, int, boolean) to authenticated;

create or replace function public.end_checkin()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public._end_my_live(auth.uid());
end; $$;
revoke execute on function public.end_checkin() from public, anon;
grant execute on function public.end_checkin() to authenticated;

create or replace function public.extend_checkin(p_minutes int default 60)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_at timestamptz;
begin
  update public.lfg_posts
     set expires_at = least(expires_at + make_interval(mins => least(greatest(coalesce(p_minutes, 60), 15), 180)),
                            now() + interval '8 hours')
   where user_id = auth.uid() and ended_at is null and expires_at > now()
  returning expires_at into v_at;
  if v_at is null then raise exception 'You are not checked in'; end if;
  return v_at;
end; $$;
revoke execute on function public.extend_checkin(int) from public, anon;
grant execute on function public.extend_checkin(int) to authenticated;

-- ============================================================================
-- Pull Up
-- ============================================================================
create or replace function public.pull_up(p_post_id uuid, p_eta_minutes int default 10)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.lfg_posts%rowtype;
  v_name text;
  v_eta timestamptz;
  v_mins int := least(greatest(coalesce(p_eta_minutes, 10), 1), 60);
  v_other uuid;
  v_taken int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_post from public.lfg_posts where id = p_post_id;
  if not found then raise exception 'Post not found'; end if;
  if v_post.user_id = v_uid then raise exception 'That''s your own spot'; end if;
  if v_post.ended_at is not null or v_post.expires_at <= now() then raise exception 'This post has expired'; end if;
  if not public._can_see_checkin(p_post_id, v_uid) then raise exception 'Post not available'; end if;
  if v_post.seats is not null then
    select count(*) into v_taken from public.lfg_joins where post_id = p_post_id and user_id <> v_uid;
    if v_taken >= v_post.seats then raise exception 'This table is full'; end if;
  end if;

  -- You can only be in one place: end my own check-in and other pull-ups.
  update public.lfg_posts
     set ended_at = now(), expires_at = least(expires_at, now())
   where user_id = v_uid and ended_at is null and expires_at > now();
  delete from public.lfg_joins j using public.lfg_posts p
   where j.post_id = p.id and j.user_id = v_uid and j.post_id <> p_post_id
     and p.expires_at > now() and p.ended_at is null;

  v_eta := now() + make_interval(mins => v_mins);
  insert into public.lfg_joins (post_id, user_id, eta_at, arrived_at)
  values (p_post_id, v_uid, v_eta, null)
  on conflict (post_id, user_id) do update set eta_at = excluded.eta_at, arrived_at = null;

  select name into v_name from public.profiles where id = v_uid;
  for v_other in
    select v_post.user_id
    union
    select j.user_id from public.lfg_joins j where j.post_id = p_post_id and j.user_id <> v_uid
  loop
    if not public.is_blocked_with(v_other) then
      perform public.enqueue_notification(
        v_other, 'pull_up',
        jsonb_build_object(
          'user', jsonb_build_object('id', v_uid, 'name', coalesce(v_name, 'Someone')),
          'message', coalesce(v_name, 'Someone') || ' is pulling up to ' || coalesce(v_post.place_name, 'your spot') || ' · ~' || v_mins || ' min',
          'postId', p_post_id));
    end if;
  end loop;
  return v_eta;
end; $$;
revoke execute on function public.pull_up(uuid, int) from public, anon;
grant execute on function public.pull_up(uuid, int) to authenticated;

create or replace function public.cancel_pull_up(p_post_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.lfg_joins where post_id = p_post_id and user_id = auth.uid();
$$;
revoke execute on function public.cancel_pull_up(uuid) from public, anon;
grant execute on function public.cancel_pull_up(uuid) to authenticated;

create or replace function public.mark_arrived(p_post_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.lfg_joins set arrived_at = coalesce(arrived_at, now())
   where post_id = p_post_id and user_id = auth.uid();
$$;
revoke execute on function public.mark_arrived(uuid) from public, anon;
grant execute on function public.mark_arrived(uuid) to authenticated;

-- ============================================================================
-- Table notes
-- ============================================================================
create or replace function public.post_checkin_note(p_post_id uuid, p_text text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.lfg_posts%rowtype;
  v_id uuid;
  v_name text;
  v_recent boolean;
  v_other uuid;
  v_text text := btrim(coalesce(p_text, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if char_length(v_text) = 0 or char_length(v_text) > 140 then raise exception 'Notes are 1 to 140 characters'; end if;
  select * into v_post from public.lfg_posts where id = p_post_id;
  if not found or v_post.ended_at is not null or v_post.expires_at <= now() then raise exception 'This table has wrapped up'; end if;
  if v_post.user_id <> v_uid and not exists (
       select 1 from public.lfg_joins where post_id = p_post_id and user_id = v_uid) then
    raise exception 'Only people at this table can post';
  end if;

  -- One push per person per table every 5 minutes.
  select exists (select 1 from public.checkin_notes
                  where post_id = p_post_id and user_id = v_uid and created_at > now() - interval '5 minutes')
    into v_recent;

  insert into public.checkin_notes (post_id, user_id, text) values (p_post_id, v_uid, v_text)
  returning id into v_id;

  if not v_recent then
    select name into v_name from public.profiles where id = v_uid;
    for v_other in
      select v_post.user_id
      union
      select j.user_id from public.lfg_joins j where j.post_id = p_post_id
    loop
      if v_other <> v_uid and not public.is_blocked_with(v_other) then
        perform public.enqueue_notification(
          v_other, 'checkin_note',
          jsonb_build_object(
            'user', jsonb_build_object('id', v_uid, 'name', coalesce(v_name, 'Someone')),
            'message', coalesce(v_name, 'Someone') || ' at ' || coalesce(v_post.place_name, 'your table') || ': ' || left(v_text, 80),
            'postId', p_post_id));
      end if;
    end loop;
  end if;
  return v_id;
end; $$;
revoke execute on function public.post_checkin_note(uuid, text) from public, anon;
grant execute on function public.post_checkin_note(uuid, text) to authenticated;

create or replace function public.list_checkin_notes(p_post_id uuid)
returns table (id uuid, user_id uuid, name text, avatar_url text, text text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.id, n.user_id, p.name, p.avatar_url, n.text, n.created_at
    from public.checkin_notes n
    join public.profiles p on p.id = n.user_id
    join public.lfg_posts lp on lp.id = n.post_id
   where n.post_id = p_post_id
     and lp.ended_at is null and lp.expires_at > now()
     and (lp.user_id = auth.uid()
          or exists (select 1 from public.lfg_joins j where j.post_id = lp.id and j.user_id = auth.uid()))
   order by n.created_at;
$$;
revoke execute on function public.list_checkin_notes(uuid) from public, anon;
grant execute on function public.list_checkin_notes(uuid) to authenticated;

-- Notes leave with their check-in.
create or replace function public.purge_expired_checkin_notes()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from public.checkin_notes n using public.lfg_posts p
   where n.post_id = p.id and (p.ended_at is not null or p.expires_at <= now());
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
revoke execute on function public.purge_expired_checkin_notes() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-expired-checkin-notes') then
    perform cron.unschedule('purge-expired-checkin-notes');
  end if;
  perform cron.schedule('purge-expired-checkin-notes', '*/10 * * * *', 'select public.purge_expired_checkin_notes()');
end $$;

-- ============================================================================
-- The wheel
-- ============================================================================

-- Everything Home needs in one round trip:
--   me:     my live check-in (with its table) and the table I pulled up to
--   counts: people out now per category (scoped by circle when given)
--   tables: every live check-in I can see, with who's there
create or replace function public.get_wheel_state(p_circle_id uuid default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tables jsonb;
  v_counts jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  with live as (
    select p.*
      from public.lfg_posts p
     where p.ended_at is null and p.expires_at > now() and p.starts_at <= now() + interval '12 hours'
  ), visible as (
    select l.* from live l
     where public._can_see_checkin(l.id, v_uid)
       and (p_circle_id is null
            or l.user_id = v_uid
            or exists (select 1 from public.circle_members m where m.circle_id = p_circle_id and m.user_id = l.user_id)
            or l.circle_id = p_circle_id)
  ), members as (
    select v.id as post_id,
           jsonb_agg(jsonb_build_object(
             'id', pr.id, 'name', pr.name, 'avatar', coalesce(pr.avatar_url, ''),
             'status', case when j.user_id is null then 'host'
                            when j.arrived_at is not null or j.eta_at is null or j.eta_at <= now() then 'here'
                            else 'pulling_up' end,
             'etaAt', j.eta_at
           ) order by (j.user_id is not null), j.created_at) as people,
           count(*) as n
      from visible v
      join lateral (
        select v.user_id as uid, null::uuid as user_id, null::timestamptz as eta_at, null::timestamptz as arrived_at, v.created_at
        union all
        select jj.user_id, jj.user_id, jj.eta_at, jj.arrived_at, jj.created_at
          from public.lfg_joins jj
         where jj.post_id = v.id and not public.is_blocked_with(jj.user_id)
      ) j on true
      join public.profiles pr on pr.id = j.uid
     group by v.id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id,
      'hostId', v.user_id,
      'category', coalesce(v.category, 'hang'),
      'activity', v.activity,
      'spotId', v.spot_id,
      'placeName', v.place_name,
      'placeAddress', v.place_address,
      'lat', v.latitude, 'lng', v.longitude,
      'startsAt', v.starts_at, 'expiresAt', v.expires_at,
      'visibility', v.visibility, 'circleId', v.circle_id,
      'seats', v.seats,
      'seatsOpen', case when v.seats is null then null else greatest(v.seats - (m.n - 1), 0) end,
      'people', m.people,
      'mine', v.user_id = v_uid,
      'joined', exists (select 1 from public.lfg_joins j where j.post_id = v.id and j.user_id = v_uid),
      'connected', public.are_connected(v_uid, v.user_id),
      'sharedCircle', (
        select jsonb_build_object('id', c.id, 'name', c.name)
          from public.circle_members a
          join public.circle_members b on b.circle_id = a.circle_id
          join public.circles c on c.id = a.circle_id
         where a.user_id = v.user_id and b.user_id = v_uid and v.user_id <> v_uid
         order by c.member_count desc nulls last
         limit 1)
    ) order by v.expires_at), '[]'::jsonb),
    jsonb_build_object(
      'study',  coalesce(sum(m.n) filter (where coalesce(v.category, 'hang') = 'study'  and v.user_id <> v_uid), 0),
      'food',   coalesce(sum(m.n) filter (where coalesce(v.category, 'hang') = 'food'   and v.user_id <> v_uid), 0),
      'hang',   coalesce(sum(m.n) filter (where coalesce(v.category, 'hang') = 'hang'   and v.user_id <> v_uid), 0),
      'active', coalesce(sum(m.n) filter (where coalesce(v.category, 'hang') = 'active' and v.user_id <> v_uid), 0)
    )
    into v_tables, v_counts
    from visible v
    join members m on m.post_id = v.id;

  return jsonb_build_object('tables', coalesce(v_tables, '[]'::jsonb), 'counts', v_counts, 'at', now());
end; $$;
revoke execute on function public.get_wheel_state(uuid) from public, anon;
grant execute on function public.get_wheel_state(uuid) to authenticated;

-- Four spots for a wheel category, best first:
--   1. where people I can see are right now   2. my favorites
--   3. places I've checked into most            4. nearest matching spots
create or replace function public.get_wheel_presets(p_category text, p_lat double precision default null, p_lng double precision default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lat double precision := p_lat;
  v_lng double precision := p_lng;
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_lat is null or v_lng is null then
    select latitude, longitude into v_lat, v_lng from public.profiles where id = v_uid;
  end if;

  with live_here as (
    select p.spot_id, count(*) as n,
           array_agg(split_part(coalesce(pr.name, 'Someone'), ' ', 1) order by p.created_at) as names
      from public.lfg_posts p
      join public.profiles pr on pr.id = p.user_id
     where p.spot_id is not null and p.ended_at is null and p.expires_at > now()
       and p.user_id <> v_uid
       and public._can_see_checkin(p.id, v_uid)
     group by p.spot_id
  ), mine as (
    select spot_id, count(*) as n from public.lfg_posts
     where user_id = v_uid and spot_id is not null and category = p_category
     group by spot_id
  ), cand as (
    select s.*,
           case when v_lat is null then null else
             (6371000 * 2 * asin(sqrt(power(sin(radians(s.latitude - v_lat) / 2), 2)
               + cos(radians(v_lat)) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - v_lng) / 2), 2))))::int
           end as d,
           lh.n as here_n, lh.names as here_names,
           (f.spot_id is not null) as fav,
           coalesce(mi.n, 0) as used
      from public.spots s
      left join live_here lh on lh.spot_id = s.id
      left join public.wheel_favorites f on f.spot_id = s.id and f.user_id = v_uid and f.category = p_category
      left join mine mi on mi.spot_id = s.id
     where public._wheel_spot_matches(p_category, s.category, s.kind)
       and (lh.n is not null or f.spot_id is not null or mi.n is not null
            or v_lat is null
            or (s.latitude between v_lat - 0.15 and v_lat + 0.15 and s.longitude between v_lng - 0.18 and v_lng + 0.18))
  )
  select coalesce(jsonb_agg(x.j order by x.rank), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
               'id', c.id, 'name', c.name, 'category', c.category, 'kind', c.kind,
               'address', c.address, 'lat', c.latitude, 'lng', c.longitude, 'distanceM', c.d,
               'here', coalesce(to_jsonb(c.here_names), '[]'::jsonb), 'favorite', c.fav
             ) as j,
             row_number() over (order by (c.here_n is not null) desc, c.fav desc, c.used desc, c.d nulls last) as rank
        from cand c
       order by rank
       limit 4
    ) x;
  return v_out;
end; $$;
revoke execute on function public.get_wheel_presets(text, double precision, double precision) from public, anon;
grant execute on function public.get_wheel_presets(text, double precision, double precision) to authenticated;

create or replace function public.toggle_wheel_favorite(p_category text, p_spot_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.wheel_favorites where user_id = auth.uid() and category = p_category and spot_id = p_spot_id;
  if found then return false; end if;
  insert into public.wheel_favorites (user_id, category, spot_id) values (auth.uid(), p_category, p_spot_id);
  return true;
end; $$;
revoke execute on function public.toggle_wheel_favorite(text, uuid) from public, anon;
grant execute on function public.toggle_wheel_favorite(text, uuid) to authenticated;

-- ============================================================================
-- Push wording + realtime
-- ============================================================================
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
    when 'lfg_post'                      then 'Out now'
    when 'lfg_join'                      then 'Someone joined'
    when 'pull_up'                       then 'Pulling up'
    when 'checkin_note'                  then 'Table note'
    when 'poll_created'                  then 'New poll'
    when 'question_revealed'             then 'Answers revealed'
    when 'spontaneous_question'          then 'New question'
    when 'spontaneous_question_answered' then 'Question answered'
    when 'circle_invite'                 then 'Circle invite'
    when 'event_reaction'                then 'New reaction'
    when 'plan_tipped'                   then 'It''s on'
    else 'Third Space'
  end;
$$;

create or replace function public.push_body_for(p_type text, p_payload jsonb)
returns text language sql immutable as $$
  select case
    when p_type in ('lfg_post', 'lfg_join', 'poll_created', 'pull_up', 'checkin_note')
      then coalesce(p_payload->>'message', 'Tap to open')
    else btrim(
      coalesce(p_payload->>'name', p_payload->'user'->>'name', '')
      || ' ' || coalesce(p_payload->>'message', '')
    )
  end;
$$;

alter table public.lfg_joins replica identity full;
alter table public.checkin_notes replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lfg_joins') then
    execute 'alter publication supabase_realtime add table public.lfg_joins';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'checkin_notes') then
    execute 'alter publication supabase_realtime add table public.checkin_notes';
  end if;
end $$;
