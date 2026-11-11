-- 075: Plan — real-world spots and "I'd go" ideas.
--
-- spots:      real places (cafes, parks, museums, ...) imported by area from
--             OpenStreetMap by the spots-import edge function. Shared by all.
-- spot_tiles: which map tiles have been imported, and when.
-- plan_ideas: something a person would like to do, usually at a spot. Friends
--             add themselves; once `needed` people are in, the idea "tips"
--             (tipped_at) and is ready to become a real plan.

create table if not exists public.spots (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'osm',
  source_id     text not null,
  name          text not null,
  category      text not null,          -- coffee, food, drinks, outdoors, arts, active, browse, sights
  kind          text,                   -- raw type, e.g. cafe, park, museum
  latitude      double precision not null,
  longitude     double precision not null,
  address       text,
  city          text,
  website       text,
  opening_hours text,
  cuisine       text,
  photo_url     text,
  tile_key      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists spots_lat_lng_idx on public.spots (latitude, longitude);
create index if not exists spots_category_idx on public.spots (category);

create table if not exists public.spot_tiles (
  tile_key   text primary key,
  fetched_at timestamptz not null default now(),
  spot_count integer not null default 0
);

create table if not exists public.plan_ideas (
  id         uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  spot_id    uuid references public.spots(id) on delete set null,
  title      text not null check (char_length(title) between 1 and 80),
  needed     integer not null default 3 check (needed between 2 and 8),
  tipped_at  timestamptz,
  event_id   uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists plan_ideas_created_by_idx on public.plan_ideas (created_by);

create table if not exists public.plan_idea_members (
  idea_id    uuid not null references public.plan_ideas(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);
create index if not exists plan_idea_members_user_idx on public.plan_idea_members (user_id);

alter table public.spots enable row level security;
alter table public.spot_tiles enable row level security;
alter table public.plan_ideas enable row level security;
alter table public.plan_idea_members enable row level security;

drop policy if exists "spots: read" on public.spots;
create policy "spots: read" on public.spots for select to authenticated using (true);
-- spots and spot_tiles are written only by the import function (service role).
-- Ideas and members are read and written only through the functions below.

-- Can p_viewer see this idea? Its creator, anyone in it, or a connection of
-- the creator or of someone in it (never across a block).
create or replace function public._can_see_idea(p_idea uuid, p_viewer uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.plan_ideas i
     where i.id = p_idea
       and not exists (select 1 from public.blocks b
                        where (b.blocker_id = p_viewer and b.blocked_id = i.created_by)
                           or (b.blocker_id = i.created_by and b.blocked_id = p_viewer))
       and (i.created_by = p_viewer
            or public.are_connected(i.created_by, p_viewer)
            or exists (select 1 from public.plan_idea_members m
                        where m.idea_id = i.id
                          and (m.user_id = p_viewer or public.are_connected(m.user_id, p_viewer))))
  );
$$;
revoke execute on function public._can_see_idea(uuid, uuid) from public, anon, authenticated;

create or replace function public._idea_json(p_idea uuid, p_viewer uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id, 'title', i.title, 'needed', i.needed, 'tippedAt', i.tipped_at,
    'eventId', i.event_id, 'createdBy', i.created_by, 'createdAt', i.created_at,
    'mine', exists (select 1 from public.plan_idea_members m where m.idea_id = i.id and m.user_id = p_viewer),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'avatar', p.avatar_url) order by m.created_at)
        from public.plan_idea_members m join public.profiles p on p.id = m.user_id
       where m.idea_id = i.id), '[]'::jsonb),
    'spot', case when s.id is null then null else jsonb_build_object(
      'id', s.id, 'name', s.name, 'category', s.category, 'kind', s.kind,
      'latitude', s.latitude, 'longitude', s.longitude, 'address', s.address,
      'city', s.city, 'website', s.website, 'openingHours', s.opening_hours,
      'cuisine', s.cuisine, 'photoUrl', s.photo_url) end)
    from public.plan_ideas i left join public.spots s on s.id = i.spot_id
   where i.id = p_idea;
$$;
revoke execute on function public._idea_json(uuid, uuid) from public, anon, authenticated;

-- The board: ideas I can see that are still open (not yet an event), closest
-- to tipping first.
create or replace function public.get_plan_board()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(j order by ratio desc, created_at desc), '[]'::jsonb)
    from (
      select public._idea_json(i.id, auth.uid()) as j, i.created_at,
             (select count(*) from public.plan_idea_members m where m.idea_id = i.id)::numeric / i.needed as ratio
        from public.plan_ideas i
       where auth.uid() is not null
         and i.event_id is null
         and i.created_at > now() - interval '120 days'
         and public._can_see_idea(i.id, auth.uid())
       limit 60
    ) t;
$$;
revoke execute on function public.get_plan_board() from public, anon;
grant execute on function public.get_plan_board() to authenticated;

create or replace function public.create_plan_idea(p_spot_id uuid, p_title text, p_needed integer default 3)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_title = '' and p_spot_id is not null then
    select name into v_title from public.spots where id = p_spot_id;
  end if;
  if coalesce(v_title, '') = '' then raise exception 'An idea needs a name'; end if;

  -- One open idea per person per spot: adding it again returns the first.
  if p_spot_id is not null then
    select i.id into v_id from public.plan_ideas i
     where i.spot_id = p_spot_id and i.event_id is null and public._can_see_idea(i.id, v_uid)
     order by i.created_at limit 1;
  end if;

  if v_id is null then
    insert into public.plan_ideas (created_by, spot_id, title, needed)
    values (v_uid, p_spot_id, left(v_title, 80), greatest(2, least(8, coalesce(p_needed, 3))))
    returning id into v_id;
  end if;

  insert into public.plan_idea_members (idea_id, user_id) values (v_id, v_uid)
  on conflict do nothing;
  perform public._idea_check_tip(v_id);
  return public._idea_json(v_id, v_uid);
end; $$;

-- Marks an idea tipped the first time enough people are in, and tells them.
create or replace function public._idea_check_tip(p_idea uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_idea public.plan_ideas%rowtype;
  v_count integer;
  r record;
begin
  select * into v_idea from public.plan_ideas where id = p_idea for update;
  if not found then return; end if;
  select count(*) into v_count from public.plan_idea_members where idea_id = p_idea;
  if v_count >= v_idea.needed and v_idea.tipped_at is null then
    update public.plan_ideas set tipped_at = now() where id = p_idea;
    for r in select user_id from public.plan_idea_members where idea_id = p_idea loop
      perform public.enqueue_notification(r.user_id, 'plan_tipped',
        jsonb_build_object('ideaId', p_idea, 'name', v_idea.title, 'message', 'is on. Pick a time.'));
    end loop;
  elsif v_count < v_idea.needed and v_idea.tipped_at is not null and v_idea.event_id is null then
    update public.plan_ideas set tipped_at = null where id = p_idea;
  end if;
end; $$;
revoke execute on function public._idea_check_tip(uuid) from public, anon, authenticated;

-- Add or remove me. The last person leaving removes the idea.
create or replace function public.toggle_plan_idea(p_idea uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public._can_see_idea(p_idea, v_uid) then raise exception 'Idea not found'; end if;

  if exists (select 1 from public.plan_idea_members where idea_id = p_idea and user_id = v_uid) then
    delete from public.plan_idea_members where idea_id = p_idea and user_id = v_uid;
    if not exists (select 1 from public.plan_idea_members where idea_id = p_idea) then
      delete from public.plan_ideas where id = p_idea;
      return null;
    end if;
  else
    insert into public.plan_idea_members (idea_id, user_id) values (p_idea, v_uid);
  end if;
  perform public._idea_check_tip(p_idea);
  return public._idea_json(p_idea, v_uid);
end; $$;

-- Once someone turns a tipped idea into an event, it leaves the board.
create or replace function public.link_plan_idea_event(p_idea uuid, p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.plan_ideas set event_id = p_event
   where id = p_idea
     and exists (select 1 from public.plan_idea_members m where m.idea_id = p_idea and m.user_id = auth.uid())
     and exists (select 1 from public.events e where e.id = p_event and e.created_by = auth.uid());
end; $$;

revoke execute on function public.create_plan_idea(uuid, text, integer) from public, anon;
revoke execute on function public.toggle_plan_idea(uuid) from public, anon;
revoke execute on function public.link_plan_idea_event(uuid, uuid) from public, anon;
grant execute on function public.create_plan_idea(uuid, text, integer) to authenticated;
grant execute on function public.toggle_plan_idea(uuid) to authenticated;
grant execute on function public.link_plan_idea_event(uuid, uuid) to authenticated;

-- Spots near a point, nearest first, with optional category and name filter.
create or replace function public.spots_near(
  p_lat double precision, p_lng double precision,
  p_radius_m integer default 8000, p_category text default null,
  p_query text default null, p_limit integer default 40, p_offset integer default 0)
returns table (
  id uuid, name text, category text, kind text, latitude double precision, longitude double precision,
  address text, city text, website text, opening_hours text, cuisine text, photo_url text, distance_m integer)
language sql stable security definer set search_path = public
as $$
  with box as (
    select least(greatest(coalesce(p_radius_m, 8000), 500), 40000) as r
  ), cand as (
    select s.*,
           (6371000 * 2 * asin(sqrt(
              power(sin(radians(s.latitude - p_lat) / 2), 2)
              + cos(radians(p_lat)) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - p_lng) / 2), 2)
           )))::integer as d
      from public.spots s, box
     where s.latitude between p_lat - box.r / 111000.0 and p_lat + box.r / 111000.0
       and s.longitude between p_lng - box.r / (111000.0 * greatest(cos(radians(p_lat)), 0.2))
                           and p_lng + box.r / (111000.0 * greatest(cos(radians(p_lat)), 0.2))
       and (p_category is null or s.category = p_category)
       and (coalesce(btrim(p_query), '') = '' or s.name ilike '%' || btrim(p_query) || '%'
            or s.kind ilike '%' || btrim(p_query) || '%' or s.cuisine ilike '%' || btrim(p_query) || '%')
  )
  select c.id, c.name, c.category, c.kind, c.latitude, c.longitude, c.address, c.city, c.website,
         c.opening_hours, c.cuisine, c.photo_url, c.d
    from cand c, box
   where c.d <= box.r
   order by c.d
   limit least(greatest(coalesce(p_limit, 40), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke execute on function public.spots_near(double precision, double precision, integer, text, text, integer, integer) from public, anon;
grant execute on function public.spots_near(double precision, double precision, integer, text, text, integer, integer) to authenticated;

-- Push wording for the new notification type.
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
    when 'circle_invite'                 then 'Circle invite'
    when 'event_reaction'                then 'New reaction'
    when 'plan_tipped'                   then 'It''s on'
    else 'Third Space'
  end;
$$;
