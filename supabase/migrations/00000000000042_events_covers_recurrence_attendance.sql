-- =============================================================================
-- Migration: Event covers, recurrence, attendance tracking, and recaps
-- =============================================================================

-- 1. New columns on public.events
alter table public.events
  add column if not exists cover_image_url text,
  add column if not exists recurrence_rule text check (recurrence_rule in ('none','weekly','biweekly','monthly')) default 'none',
  add column if not exists recurrence_end_date date,
  add column if not exists recurrence_parent_id uuid references public.events(id) on delete cascade,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_events_recurrence_parent_id on public.events(recurrence_parent_id);

-- 2. New columns on public.event_attendees
alter table public.event_attendees
  add column if not exists attended boolean,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references public.profiles(id) on delete set null;

-- 3. Recreate public.events_with_counts view with attended_count
drop view if exists public.events_with_counts cascade;
create view public.events_with_counts as
select e.*,
       coalesce(a.cnt, 0)::int as attendees_count,
       coalesce(a.attended_cnt, 0)::int as attended_count
from public.events e
left join (
  select event_id,
         count(*)::int as cnt,
         count(*) filter (where attended = true)::int as attended_cnt
  from public.event_attendees
  group by event_id
) a on a.event_id = e.id;

alter view public.events_with_counts set (security_invoker = on);

-- 4. New table public.event_photos
create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_photos_event_id on public.event_photos(event_id);

alter table public.event_photos enable row level security;

drop policy if exists "attendees view event photos" on public.event_photos;
create policy "attendees view event photos"
  on public.event_photos for select to authenticated
  using (
    exists (
      select 1 from public.event_attendees ea
      where ea.event_id = event_photos.event_id and ea.user_id = auth.uid()
    )
  );

drop policy if exists "attendees insert event photos" on public.event_photos;
create policy "attendees insert event photos"
  on public.event_photos for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.event_attendees ea
      where ea.event_id = event_photos.event_id and ea.user_id = auth.uid()
    )
  );

drop policy if exists "uploader or host delete event photos" on public.event_photos;
create policy "uploader or host delete event photos"
  on public.event_photos for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.events e
      where e.id = event_photos.event_id and e.created_by = auth.uid()
    )
  );

-- 5. New table public.event_reactions
create table if not exists public.event_reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint event_reactions_unique_key unique (event_id, user_id, target_user_id, emoji)
);

create index if not exists idx_event_reactions_event_id on public.event_reactions(event_id);

alter table public.event_reactions enable row level security;

drop policy if exists "attendees view event reactions" on public.event_reactions;
create policy "attendees view event reactions"
  on public.event_reactions for select to authenticated
  using (
    exists (
      select 1 from public.event_attendees ea
      where ea.event_id = event_reactions.event_id and ea.user_id = auth.uid()
    )
  );

drop policy if exists "attendees insert event reactions" on public.event_reactions;
create policy "attendees insert event reactions"
  on public.event_reactions for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.event_attendees ea
      where ea.event_id = event_reactions.event_id and ea.user_id = auth.uid()
    )
  );

drop policy if exists "user delete own event reactions" on public.event_reactions;
create policy "user delete own event reactions"
  on public.event_reactions for delete to authenticated
  using (auth.uid() = user_id);

-- 6. Storage bucket 'event-photos'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "event-photos: anyone can read" on storage.objects;
drop policy if exists "event-photos: attendees insert" on storage.objects;
drop policy if exists "event-photos: uploader deletes" on storage.objects;

create policy "event-photos: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'event-photos');

create policy "event-photos: attendees insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.event_attendees ea
      where ea.event_id::text = (storage.foldername(name))[1]
        and ea.user_id = auth.uid()
    )
  );

create policy "event-photos: uploader deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

-- 7. Storage bucket 'event-covers'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "event-covers: anyone can read" on storage.objects;
drop policy if exists "event-covers: creator inserts" on storage.objects;
drop policy if exists "event-covers: creator updates" on storage.objects;
drop policy if exists "event-covers: creator deletes" on storage.objects;

create policy "event-covers: anyone can read"
  on storage.objects for select to public
  using (bucket_id = 'event-covers');

create policy "event-covers: creator inserts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-covers'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.created_by = auth.uid()
    )
  );

create policy "event-covers: creator updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event-covers'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.created_by = auth.uid()
    )
  );

create policy "event-covers: creator deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-covers'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.created_by = auth.uid()
    )
  );

-- 8. RPC public.mark_event_attendance
create or replace function public.mark_event_attendance(
  p_event_id uuid,
  p_user_id uuid,
  p_attended boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host_id uuid;
  v_rows_affected int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select created_by into v_host_id from public.events where id = p_event_id;
  if not found or v_host_id <> v_uid then
    raise exception 'Only the event host can mark attendance';
  end if;

  update public.event_attendees
    set attended = p_attended,
        checked_in_at = case when p_attended then now() else null end,
        checked_in_by = v_uid
    where event_id = p_event_id and user_id = p_user_id;

  get diagnostics v_rows_affected = row_count;
  if v_rows_affected = 0 then
    raise exception 'That person has not RSVPd to this event';
  end if;
end;
$$;

grant execute on function public.mark_event_attendance(uuid, uuid, boolean) to authenticated;

-- 9. Move battery reward from RSVP to confirmed attendance
drop trigger if exists trg_battery_on_rsvp on public.event_attendees;

create or replace function public.award_battery_for_attendance()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_points int;
begin
  if new.attended = true and (old.attended is null or old.attended = false) then
    update public.profiles
      set battery_points = least(coalesce(battery_points, 0) + 20, 100)
      where id = new.user_id
    returning battery_points into v_new_points;

    insert into public.battery_history (user_id, points, reason, result)
    values (new.user_id, 20, 'Attended an event', coalesce(v_new_points, 20));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_battery_on_attendance on public.event_attendees;
create trigger trg_battery_on_attendance
  after update on public.event_attendees
  for each row execute procedure public.award_battery_for_attendance();

-- 10. Update policy WITH CHECK on public.events
drop policy if exists "creator updates own event" on public.events;
create policy "creator updates own event"
  on public.events for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- 11. Fix events INSERT policy for community events (circle_id is null)
drop policy if exists "circle members create events" on public.events;
drop policy if exists "members create circle events or own community events" on public.events;
create policy "members create circle events or own community events"
  on public.events for insert to authenticated with check (
    auth.uid() = created_by
    and (
      circle_id is null
      or exists (
        select 1 from public.circle_members m
        where m.circle_id = events.circle_id and m.user_id = auth.uid()
      )
    )
  );
