-- Allow a signed-in user to create their own profile row if the auth trigger
-- did not run (e.g. OAuth edge cases or migrations not yet applied remotely).
create policy "users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);
