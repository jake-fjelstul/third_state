-- Onboarding is now inline (Feed card + Profile progress ring). The flag is no longer needed.

-- Recreate the new-user trigger without onboarding_complete (canonical with OAuth metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, age, city, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    (new.raw_user_meta_data->>'age')::int,
    new.raw_user_meta_data->>'city',
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );
  return new;
end;
$$;

alter table public.profiles drop column if exists onboarding_complete;
