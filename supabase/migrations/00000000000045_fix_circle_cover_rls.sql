-- =============================================================================
-- Migration 45: Fix circle cover photo RLS and helper functions
-- =============================================================================

-- 1. Helper function: is_circle_admin
create or replace function public.is_circle_admin(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circles c
    where c.id = p_circle_id and c.organizer_id = auth.uid()
  ) or exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id and m.user_id = auth.uid() and m.role in ('organizer','host')
  );
$$;

grant execute on function public.is_circle_admin(uuid) to authenticated;

-- 2. Drop existing policies on storage.objects for circle-covers
drop policy if exists "circle-covers: anyone can read" on storage.objects;
drop policy if exists "circle-covers: organizer writes" on storage.objects;
drop policy if exists "circle-covers: organizer updates" on storage.objects;
drop policy if exists "circle-covers: organizer deletes" on storage.objects;
drop policy if exists "circle-covers: authenticated insert" on storage.objects;
drop policy if exists "circle-covers: authenticated update" on storage.objects;
drop policy if exists "circle-covers: authenticated delete" on storage.objects;
drop policy if exists "circle-covers: admin insert" on storage.objects;
drop policy if exists "circle-covers: admin update" on storage.objects;
drop policy if exists "circle-covers: admin delete" on storage.objects;

-- Recreate storage policies for circle-covers
create policy "circle-covers: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'circle-covers');

create policy "circle-covers: admin insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'circle-covers'
    and (storage.foldername(name))[1] is not null
    and public.is_circle_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "circle-covers: admin update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'circle-covers'
    and (storage.foldername(name))[1] is not null
    and public.is_circle_admin(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'circle-covers'
    and (storage.foldername(name))[1] is not null
    and public.is_circle_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "circle-covers: admin delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'circle-covers'
    and (storage.foldername(name))[1] is not null
    and public.is_circle_admin(((storage.foldername(name))[1])::uuid)
  );

-- 3. Update public.circles UPDATE policy so co-organizers can save cover_image_url
drop policy if exists "organizer can update own circle" on public.circles;
drop policy if exists "circle admins update circle" on public.circles;

create policy "circle admins update circle"
  on public.circles for update to authenticated
  using (public.is_circle_admin(id))
  with check (public.is_circle_admin(id));

-- 4. Backfill drifted organizer_ids
update public.circles c
  set organizer_id = m.user_id
  from public.circle_members m
 where m.circle_id = c.id
   and m.role = 'organizer'
   and c.organizer_id is null;

-- 5. Ensure bucket row exists and is public
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('circle-covers', 'circle-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

update storage.buckets set public = true where id in ('avatars','circle-covers');
