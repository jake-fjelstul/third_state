-- =============================================================================
-- Saved friend groups + targeted LFG notifications
-- =============================================================================

create table public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint friend_groups_name_len check (char_length(btrim(name)) between 1 and 40)
);

-- One group name per owner, case-insensitively.
create unique index idx_friend_groups_owner_name
  on public.friend_groups (owner_id, lower(btrim(name)));

create index idx_friend_groups_owner on public.friend_groups(owner_id);

create table public.friend_group_members (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;

-- Groups are strictly private to their owner. Nobody can see which groups they
-- have been placed in.
create policy "owner reads own groups"
  on public.friend_groups for select to authenticated
  using (owner_id = auth.uid());

create policy "owner deletes own groups"
  on public.friend_groups for delete to authenticated
  using (owner_id = auth.uid());

create policy "owner reads own group members"
  on public.friend_group_members for select to authenticated
  using (exists (
    select 1 from public.friend_groups g
    where g.id = group_id and g.owner_id = auth.uid()
  ));

-- No INSERT or UPDATE policies on either table, deliberately. All writes go
-- through the security-definer RPCs below so connection membership is
-- validated server-side.

-- ---------------------------------------------------------------------------
-- save_friend_group: creates when p_group_id is null, otherwise renames and
-- replaces the membership of an existing group. Members that are not
-- connections are silently dropped rather than erroring, so a stale client
-- cannot smuggle strangers in.
-- ---------------------------------------------------------------------------
create or replace function public.save_friend_group(
  p_name text,
  p_member_ids uuid[],
  p_group_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
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

grant execute on function public.save_friend_group(text, uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- list_friend_groups: groups with their members, filtered to CURRENT
-- connections. A member who has since disconnected disappears from the list
-- without needing a cleanup job.
-- ---------------------------------------------------------------------------
create or replace function public.list_friend_groups()
returns table (
  group_id uuid,
  name text,
  created_at timestamptz,
  member_id uuid,
  member_name text,
  member_avatar_url text
)
language sql
stable
security definer set search_path = public
as $$
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

grant execute on function public.list_friend_groups() to authenticated;

-- ---------------------------------------------------------------------------
-- Who was actually pinged about a post. Author-only.
-- ---------------------------------------------------------------------------
create table public.lfg_post_invites (
  post_id uuid not null references public.lfg_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.lfg_post_invites enable row level security;

create policy "author or invitee reads lfg invites"
  on public.lfg_post_invites for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.lfg_posts p
                where p.id = post_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- create_lfg_post, with optional targeting.
--
-- DROP the old function first. CREATE OR REPLACE with a longer argument list
-- creates an OVERLOAD rather than replacing, which leaves PostgREST able to
-- bind to the stale version. The new p_invitee_ids has a DEFAULT, so the
-- existing client call (which omits it) still resolves correctly until the UI
-- phase ships.
-- ---------------------------------------------------------------------------
drop function if exists public.create_lfg_post(
  text, timestamptz, text, boolean, text, text,
  double precision, double precision, timestamptz
);

create or replace function public.create_lfg_post(
  p_activity text,
  p_expires_at timestamptz,
  p_visibility text default 'everyone',
  p_notify_connections boolean default false,
  p_place_name text default null,
  p_place_address text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_starts_at timestamptz default null,
  p_invitee_ids uuid[] default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
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

grant execute on function public.create_lfg_post(
  text, timestamptz, text, boolean, text, text,
  double precision, double precision, timestamptz, uuid[]
) to authenticated;
