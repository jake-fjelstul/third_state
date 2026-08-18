-- Migration: Create public.get_circles_page() RPC returning full circles payload in one call

create or replace function public.get_circles_page()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  with my_circles as (
    select circle_id
    from public.circle_members
    where user_id = auth.uid()
  ),
  my_circle_ids_json as (
    select coalesce(jsonb_agg(circle_id), '[]'::jsonb) as val
    from my_circles
  ),
  visible_circles as (
    select
      c.id,
      c.name,
      c.icon,
      c.emoji,
      c.city,
      c.type,
      c.category,
      c.interest_tag,
      c.member_count,
      c.cover_image_url,
      c.cover_gradient,
      c.applications_enabled,
      c.organizer_id
    from public.circles c
    where c.type = 'open'
       or (c.type = 'private' and c.applications_enabled = true)
       or exists (
         select 1 from my_circles mc where mc.circle_id = c.id
       )
    order by c.member_count desc
  ),
  circles_json as (
    select coalesce(jsonb_agg(to_jsonb(vc)), '[]'::jsonb) as val
    from visible_circles vc
  ),
  joined_members as (
    select
      cm.circle_id,
      cm.user_id,
      p.name,
      coalesce(p.avatar_url, '') as avatar_url,
      cm.role
    from public.circle_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.circle_id in (select circle_id from my_circles)
  ),
  joined_members_json as (
    select coalesce(jsonb_agg(to_jsonb(jm)), '[]'::jsonb) as val
    from joined_members jm
  )
  select jsonb_build_object(
    'my_circle_ids', (select val from my_circle_ids_json),
    'circles', (select val from circles_json),
    'joined_circle_members', (select val from joined_members_json)
  );
$$;

revoke execute on function public.get_circles_page() from public, anon;
grant execute on function public.get_circles_page() to authenticated;
