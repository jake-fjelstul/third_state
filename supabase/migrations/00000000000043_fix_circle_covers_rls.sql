-- =============================================================================
-- Fix circle-covers storage RLS policies
-- =============================================================================

drop policy if exists "circle-covers: organizer writes" on storage.objects;
drop policy if exists "circle-covers: organizer updates" on storage.objects;
drop policy if exists "circle-covers: organizer deletes" on storage.objects;

create policy "circle-covers: organizer writes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'circle-covers'
    and exists (
      select 1 from public.circles c
      left join public.circle_members cm on cm.circle_id = c.id and cm.user_id = auth.uid()
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.organizer_id = auth.uid()
          or cm.role in ('organizer', 'host')
          or (c.organizer_id is null and cm.user_id is not null)
        )
    )
  );

create policy "circle-covers: organizer updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'circle-covers'
    and exists (
      select 1 from public.circles c
      left join public.circle_members cm on cm.circle_id = c.id and cm.user_id = auth.uid()
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.organizer_id = auth.uid()
          or cm.role in ('organizer', 'host')
          or (c.organizer_id is null and cm.user_id is not null)
        )
    )
  );

create policy "circle-covers: organizer deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'circle-covers'
    and exists (
      select 1 from public.circles c
      left join public.circle_members cm on cm.circle_id = c.id and cm.user_id = auth.uid()
      where c.id::text = (storage.foldername(name))[1]
        and (
          c.organizer_id = auth.uid()
          or cm.role in ('organizer', 'host')
          or (c.organizer_id is null and cm.user_id is not null)
        )
    )
  );
