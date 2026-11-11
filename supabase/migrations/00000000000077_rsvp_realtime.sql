-- 077: Realtime for RSVPs (plan-2026-11-10.md, 1A-5).
-- The app refreshes "my meetups" when an event_attendees row for me is added
-- or removed (coffee accepts, other devices). DELETE events only carry the old
-- row's non-key columns with replica identity full, which the user_id filter
-- needs.
alter table public.event_attendees replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_attendees'
  ) then
    execute 'alter publication supabase_realtime add table public.event_attendees';
  end if;
end $$;
