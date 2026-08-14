-- =============================================================================
-- LFG posts: ephemeral "hang out now" posts
-- =============================================================================

-- Symmetric connection check. Security definer so policies can call it without
-- recursing through the connections table's own RLS.
create or replace function public.are_connected(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.connections
    where (user_id = p_a and connected_user_id = p_b)
       or (user_id = p_b and connected_user_id = p_a)
  );
$$;

grant execute on function public.are_connected(uuid, uuid) to authenticated;

create table public.lfg_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity text not null,
  place_name text,
  place_address text,
  latitude double precision,
  longitude double precision,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  visibility text not null default 'everyone'
    check (visibility in ('everyone', 'friends')),
  notify_connections boolean not null default false,
  created_at timestamptz default now()
);

create index idx_lfg_posts_expires on public.lfg_posts(expires_at);
create index idx_lfg_posts_user on public.lfg_posts(user_id);

create table public.lfg_joins (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lfg_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create index idx_lfg_joins_post on public.lfg_joins(post_id);

alter table public.lfg_posts enable row level security;
alter table public.lfg_joins enable row level security;

-- Visibility rule, in order: your own posts are always visible; otherwise the
-- post must be unexpired, you must not be blocked either way, and either the
-- post is public or you are connected to the author.
create policy "read visible lfg posts"
  on public.lfg_posts for select to authenticated
  using (
    user_id = auth.uid()
    or (
      expires_at > now()
      and not public.is_blocked_with(user_id)
      and (
        visibility = 'everyone'
        or (visibility = 'friends' and public.are_connected(auth.uid(), user_id))
      )
    )
  );

create policy "create own lfg posts"
  on public.lfg_posts for insert to authenticated
  with check (user_id = auth.uid());

create policy "update own lfg posts"
  on public.lfg_posts for update to authenticated
  using (user_id = auth.uid());

create policy "delete own lfg posts"
  on public.lfg_posts for delete to authenticated
  using (user_id = auth.uid());

-- Joins are readable by the post author and by the joiner.
create policy "read relevant lfg joins"
  on public.lfg_joins for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.lfg_posts p where p.id = post_id and p.user_id = auth.uid())
  );

create policy "leave own lfg join"
  on public.lfg_joins for delete to authenticated
  using (user_id = auth.uid());

-- Joining goes through an RPC only, so visibility is re-checked server-side.
-- No INSERT policy is defined deliberately.

-- Create a post, and optionally notify connections.
create or replace function public.create_lfg_post(
  p_activity text,
  p_expires_at timestamptz,
  p_visibility text default 'everyone',
  p_notify_connections boolean default false,
  p_place_name text default null,
  p_place_address text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_starts_at timestamptz default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_conn uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
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
    auth.uid(), trim(p_activity), p_place_name, p_place_address,
    p_latitude, p_longitude, coalesce(p_starts_at, now()),
    p_expires_at, p_visibility, p_notify_connections
  )
  returning id into v_id;

  if p_notify_connections then
    select name into v_name from public.profiles where id = auth.uid();
    for v_conn in
      select connected_user_id from public.connections where user_id = auth.uid()
      union
      select user_id from public.connections where connected_user_id = auth.uid()
    loop
      if not public.is_blocked_with(v_conn) then
        perform public.enqueue_notification(
          v_conn,
          'lfg_post',
          jsonb_build_object(
            'user', jsonb_build_object(
              'id', auth.uid(),
              'name', coalesce(v_name, 'Someone')
            ),
            'message', coalesce(v_name, 'Someone') || ' is free right now: ' || trim(p_activity),
            'postId', v_id
          )
        );
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

grant execute on function public.create_lfg_post(text, timestamptz, text, boolean, text, text, double precision, double precision, timestamptz) to authenticated;

-- Join a post. Re-checks visibility server-side.
create or replace function public.join_lfg_post(p_post_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_post public.lfg_posts%rowtype;
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

  return true;
end;
$$;

grant execute on function public.join_lfg_post(uuid) to authenticated;

alter publication supabase_realtime add table public.lfg_posts;
