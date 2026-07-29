-- =============================================================================
-- THIRD SPACE — Account deletion (App Store Guideline 5.1.1(v))
-- =============================================================================
-- Deletes the calling user's auth record. All application data referencing
-- profiles(id) or auth.users(id) with ON DELETE CASCADE is removed
-- automatically by the foreign key cascade.

alter table public.reports alter column reporter_id drop not null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Remove rows that do NOT cascade from auth.users deletion.
  delete from public.blocks where blocker_id = v_uid or blocked_id = v_uid;

  -- Preserve reports filed AGAINST this user for safety review, but detach
  -- reports this user filed so no personal data remains linked to them.
  update public.reports set reporter_id = null where reporter_id = v_uid;

  -- Delete the auth user. Cascades remove the profile and all owned data.
  delete from auth.users where id = v_uid;
end; $$;

grant execute on function public.delete_my_account() to authenticated;
