-- =============================================================================
-- Fix storage policies for circle-covers, event-covers, and event-photos
-- Eliminates nested table subquery RLS evaluation failures on storage.objects
-- =============================================================================

-- 1. circle-covers
drop policy if exists "circle-covers: anyone can read" on storage.objects;
drop policy if exists "circle-covers: organizer writes" on storage.objects;
drop policy if exists "circle-covers: organizer updates" on storage.objects;
drop policy if exists "circle-covers: organizer deletes" on storage.objects;
drop policy if exists "circle-covers: authenticated insert" on storage.objects;
drop policy if exists "circle-covers: authenticated update" on storage.objects;
drop policy if exists "circle-covers: authenticated delete" on storage.objects;

create policy "circle-covers: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'circle-covers');

create policy "circle-covers: authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'circle-covers');

create policy "circle-covers: authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'circle-covers')
  with check (bucket_id = 'circle-covers');

create policy "circle-covers: authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'circle-covers');

-- 2. event-covers
drop policy if exists "event-covers: anyone can read" on storage.objects;
drop policy if exists "event-covers: creator inserts" on storage.objects;
drop policy if exists "event-covers: creator updates" on storage.objects;
drop policy if exists "event-covers: creator deletes" on storage.objects;
drop policy if exists "event-covers: authenticated insert" on storage.objects;
drop policy if exists "event-covers: authenticated update" on storage.objects;
drop policy if exists "event-covers: authenticated delete" on storage.objects;

create policy "event-covers: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'event-covers');

create policy "event-covers: authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers');

create policy "event-covers: authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-covers')
  with check (bucket_id = 'event-covers');

create policy "event-covers: authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers');

-- 3. event-photos
drop policy if exists "event-photos: anyone can read" on storage.objects;
drop policy if exists "event-photos: attendees insert" on storage.objects;
drop policy if exists "event-photos: uploader deletes" on storage.objects;
drop policy if exists "event-photos: authenticated insert" on storage.objects;
drop policy if exists "event-photos: authenticated update" on storage.objects;
drop policy if exists "event-photos: authenticated delete" on storage.objects;

create policy "event-photos: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'event-photos');

create policy "event-photos: authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos');

create policy "event-photos: authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-photos')
  with check (bucket_id = 'event-photos');

create policy "event-photos: authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos');
