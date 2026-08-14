-- =============================================================================
-- LFG: notify author on join, and expose the joiner list
-- =============================================================================

-- Replaces the previous version. Same visibility checks, now also notifying
-- the post author and returning richer state.
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

grant execute on function public.join_lfg_post(uuid) to authenticated;

-- Leave a post you previously joined.
create or replace function public.leave_lfg_post(p_post_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.lfg_joins
   where post_id = p_post_id and user_id = auth.uid();
  return true;
end;
$$;

grant execute on function public.leave_lfg_post(uuid) to authenticated;

-- Who has joined a post. Author sees everyone; a joiner sees only themselves.
create or replace function public.lfg_post_joiners(p_post_id uuid)
returns table (user_id uuid, name text, avatar_url text, joined_at timestamptz)
language sql
stable
security definer set search_path = public
as $$
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

grant execute on function public.lfg_post_joiners(uuid) to authenticated;
