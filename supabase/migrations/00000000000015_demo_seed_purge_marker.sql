-- Marker migration for deploy-time demo-data checks.
-- Demo users are useful in dev/staging for a populated discovery experience.
-- Before production launch, deployment scripts should assert this returns false
-- and purge demo users in a controlled migration.

create or replace function public.has_demo_users()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where lower(name) in (
      'maya patel',
      'jordan lee',
      'sofia martinez',
      'marcus chen',
      'emma johnson',
      'alex rivera'
    )
  );
$$;

grant execute on function public.has_demo_users() to authenticated;
