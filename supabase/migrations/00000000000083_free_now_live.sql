-- Phase 6, revised (plan-2026-11-10.md, Part 3b).
--  1. Any member can share a circle's QR / invite link, except in circles that
--     review applications (organizer and hosts only there).
--  2. Ended check-ins stop being visible right away (not at their old expiry).
--  3. One live Free now post per person: posting again ends the old one.
--  4. profiles joins the realtime publication, so AppContext's listener for
--     your own profile (battery, settings changed on another device) fires.

-- 1 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_circle_invite_link(p_circle_id uuid, p_label text DEFAULT NULL::text)
 RETURNS invites
 LANGUAGE plpgsql
 SECURITY DEFINER
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

  -- Any member can share a circle's QR / link (plan 3b, D1), except in
  -- circles that review applications: there only the organizer and hosts
  -- can, so a link can't skip the review.
  if not v_is_organizer then
    if not exists (select 1 from public.circle_members cm
                    where cm.circle_id = p_circle_id and cm.user_id = v_uid) then
      raise exception 'Only members can share this circle';
    end if;
    if coalesce((select c.applications_enabled from public.circles c where c.id = p_circle_id), false) then
      raise exception 'This circle reviews applications, so only the organizer can share an invite';
    end if;
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

-- 2 ---------------------------------------------------------------------------
create or replace function public._can_see_checkin(p_post uuid, p_viewer uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.lfg_posts p
     where p.id = p_post
       and p.ended_at is null
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

-- 3 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_lfg_post(p_activity text, p_expires_at timestamp with time zone, p_visibility text DEFAULT 'everyone'::text, p_notify_connections boolean DEFAULT false, p_place_name text DEFAULT NULL::text, p_place_address text DEFAULT NULL::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_invitee_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
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

  -- One live status per person (plan 3b, D3): posting again replaces the
  -- old post, and you're no longer at a table you'd pulled up to.
  perform public._end_my_live(v_uid);

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

-- 4 ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
