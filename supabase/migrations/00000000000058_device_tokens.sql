-- =============================================================================
-- Push notification device tokens
-- =============================================================================

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'ios' check (platform in ('ios','android')),
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- A device token is globally unique. Re-registering it reassigns the device to
-- whoever is now signed in, rather than creating a second row.
create unique index idx_device_tokens_token on public.device_tokens(token);

-- The sender's hot path: every token for one user.
create index idx_device_tokens_user on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

-- Users may only ever see or remove their own devices. The Edge Function reads
-- with the service role, which bypasses RLS entirely.
create policy "user reads own device tokens"
  on public.device_tokens for select to authenticated
  using (user_id = auth.uid());

create policy "user deletes own device tokens"
  on public.device_tokens for delete to authenticated
  using (user_id = auth.uid());

-- No INSERT or UPDATE policy, deliberately. Registration goes through the RPC
-- below so the reassignment logic cannot be bypassed.

-- ---------------------------------------------------------------------------
-- register_device_token
--
-- Idempotent. Called on every app launch, so it must be cheap and must never
-- error on a token that already exists.
-- ---------------------------------------------------------------------------
create or replace function public.register_device_token(
  p_token text,
  p_platform text default 'ios',
  p_environment text default 'sandbox'
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_token text := btrim(coalesce(p_token, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_token = '' then raise exception 'A device token is required'; end if;
  if p_platform not in ('ios','android') then raise exception 'Invalid platform'; end if;
  if p_environment not in ('sandbox','production') then raise exception 'Invalid environment'; end if;

  insert into public.device_tokens (user_id, token, platform, environment, last_seen_at)
  values (v_uid, v_token, p_platform, p_environment, now())
  on conflict (token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        environment  = excluded.environment,
        last_seen_at = now()
  returning id into v_id;

  return v_id;
end; $$;

grant execute on function public.register_device_token(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- unregister_device_token — called on sign-out.
-- ---------------------------------------------------------------------------
create or replace function public.unregister_device_token(p_token text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  delete from public.device_tokens
   where token = btrim(coalesce(p_token, '')) and user_id = v_uid;
end; $$;

grant execute on function public.unregister_device_token(text) to authenticated;
