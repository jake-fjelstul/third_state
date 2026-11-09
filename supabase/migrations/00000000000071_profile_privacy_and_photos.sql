-- 071: Profile privacy server-side (M8), people search/discovery (M3),
-- circle-mates for New Message (M11), private event photos (M15).

-- ============================================================================
-- M8. Other people's profiles: only safe columns from the table; location
--     and privacy-gated fields come from public_profiles.
-- ============================================================================

revoke select on public.profiles from anon, authenticated;
grant select (id, name, age, city, bio, avatar_url, intents, interests, privacy, created_at, updated_at)
  on public.profiles to authenticated;

-- Your own full row (settings, battery, exact location).
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- Everyone else, with their privacy settings applied by the server and
-- location rounded to ~1 km. Blocked users are invisible.
create or replace view public.public_profiles as
  select
    p.id,
    p.name,
    p.age,
    p.city,
    p.avatar_url,
    p.intents,
    case when coalesce((p.privacy->>'showBio')::boolean, true) or p.id = auth.uid() then p.bio end as bio,
    case when coalesce((p.privacy->>'showInterests')::boolean, true) or p.id = auth.uid() then p.interests else '{}'::text[] end as interests,
    case when coalesce((p.privacy->>'showLocation')::boolean, true) then round(p.latitude::numeric, 2)::double precision end as latitude,
    case when coalesce((p.privacy->>'showLocation')::boolean, true) then round(p.longitude::numeric, 2)::double precision end as longitude,
    p.privacy,
    p.created_at
  from public.profiles p
  where auth.uid() is not null
    and not public.is_blocked_with(p.id);

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- ============================================================================
-- M3. Discovery and search on the server (no more "first 50 rows")
-- ============================================================================

create or replace function public.discover_people(p_query text default null, p_limit int default 60)
returns setof public.public_profiles
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lat double precision;
  v_lng double precision;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select latitude, longitude into v_lat, v_lng from public.profiles where id = v_uid;

  return query
    select pp.*
      from public.public_profiles pp
     where pp.id <> v_uid
       and (v_q is null
            or pp.name ilike '%' || v_q || '%'
            or coalesce(pp.bio, '') ilike '%' || v_q || '%'
            or exists (select 1 from unnest(pp.interests) i where i ilike '%' || v_q || '%'))
     order by
       case when v_lat is null or pp.latitude is null then 1 else 0 end,
       case when v_lat is null or pp.latitude is null then 0
            else (pp.latitude - v_lat) ^ 2 + ((pp.longitude - v_lng) * cos(radians(v_lat))) ^ 2 end,
       pp.created_at desc
     limit least(greatest(coalesce(p_limit, 60), 1), 200);
end;
$$;
revoke execute on function public.discover_people(text, int) from public, anon;
grant execute on function public.discover_people(text, int) to authenticated;

-- ============================================================================
-- M11. People who share a circle with me, for New Message
-- ============================================================================

create or replace function public.my_circle_mates()
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer set search_path = public
as $$
  select distinct p.id, p.name, p.avatar_url
    from public.circle_members mine
    join public.circle_members other on other.circle_id = mine.circle_id and other.user_id <> mine.user_id
    join public.profiles p on p.id = other.user_id
   where mine.user_id = auth.uid()
     and not public.is_blocked_with(p.id)
   order by p.name;
$$;
revoke execute on function public.my_circle_mates() from public, anon;
grant execute on function public.my_circle_mates() to authenticated;

-- ============================================================================
-- M15. Event photos: private bucket, readable by attendees via signed URLs
-- ============================================================================

update storage.buckets set public = false where id = 'event-photos';

drop policy if exists "event-photos: anyone can read" on storage.objects;
drop policy if exists "event-photos: attendee read" on storage.objects;
create policy "event-photos: attendee read"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-photos'
         and public.is_event_attendee(public.try_uuid((storage.foldername(name))[1])));
