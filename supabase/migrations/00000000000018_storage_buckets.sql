-- Storage path conventions used by RLS checks:
-- - avatars: {user_id}/avatar.jpg
-- - circle-covers: {circle_id}/cover.jpg
-- The first folder segment is always the owner id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('circle-covers', 'circle-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars: anyone can read" on storage.objects;
drop policy if exists "avatars: user writes own folder" on storage.objects;
drop policy if exists "avatars: user updates own folder" on storage.objects;
drop policy if exists "avatars: user deletes own folder" on storage.objects;

create policy "avatars: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "avatars: user writes own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: user updates own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: user deletes own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "circle-covers: anyone can read" on storage.objects;
drop policy if exists "circle-covers: organizer writes" on storage.objects;
drop policy if exists "circle-covers: organizer updates" on storage.objects;
drop policy if exists "circle-covers: organizer deletes" on storage.objects;

create policy "circle-covers: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'circle-covers');

create policy "circle-covers: organizer writes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'circle-covers'
    and exists (
      select 1 from public.circles c
      where c.id::text = (storage.foldername(name))[1]
        and c.organizer_id = auth.uid()
    )
  );

create policy "circle-covers: organizer updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'circle-covers'
    and exists (
      select 1 from public.circles c
      where c.id::text = (storage.foldername(name))[1]
        and c.organizer_id = auth.uid()
    )
  );

create policy "circle-covers: organizer deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'circle-covers'
    and exists (
      select 1 from public.circles c
      where c.id::text = (storage.foldername(name))[1]
        and c.organizer_id = auth.uid()
    )
  );
