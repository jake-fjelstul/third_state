-- =============================================================================
-- Fix: new accounts weren't showing in discovery because onboarding_complete
-- defaulted to false and was never set to true.
-- =============================================================================

-- 1. Update the signup trigger to set onboarding_complete = true
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, age, city, onboarding_complete)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    (new.raw_user_meta_data->>'age')::int,
    new.raw_user_meta_data->>'city',
    true
  );
  return new;
end;
$$;

-- 2. Backfill: mark all existing profiles as onboarding complete
update public.profiles
  set onboarding_complete = true
  where onboarding_complete = false;
