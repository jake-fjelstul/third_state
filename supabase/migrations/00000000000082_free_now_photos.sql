-- Free now photos: an optional picture of what you're doing, shown to the
-- same people who can see the post, and only while it's live.
--
-- Storage: private bucket "free-now-photos", objects at <user id>/<file>.
-- Display uses short-lived signed URLs (same model as event-photos).

alter table public.lfg_posts
  add column if not exists photo_path text;

-- A post can only point at a photo in its author's own folder, so nobody can
-- attach someone else's photo to their post to gain read access to it.
alter table public.lfg_posts drop constraint if exists lfg_posts_photo_path_owner;
alter table public.lfg_posts add constraint lfg_posts_photo_path_owner
  check (photo_path is null or photo_path like (user_id::text || '/%'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('free-now-photos', 'free-now-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "free-now-photos: owner insert" on storage.objects;
create policy "free-now-photos: owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'free-now-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "free-now-photos: owner delete" on storage.objects;
create policy "free-now-photos: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'free-now-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- Readers: the author, or anyone who can see a live post using this photo.
drop policy if exists "free-now-photos: post viewers read" on storage.objects;
create policy "free-now-photos: post viewers read"
  on storage.objects for select to authenticated
  using (bucket_id = 'free-now-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or exists (
                select 1 from public.lfg_posts p
                 where p.photo_path = objects.name
                   and p.expires_at > now()
                   and p.ended_at is null
                   and public._can_see_checkin(p.id, auth.uid()))));
