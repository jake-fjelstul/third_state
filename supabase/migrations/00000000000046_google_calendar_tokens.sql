-- =============================================================================
-- Migration 46: Google Calendar Server-Side Tokens & RPCs
-- =============================================================================

create table if not exists public.google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

-- No direct client select/insert/update policies on this table so tokens are never exposed to the client.

-- RPC to check connection status safely
create or replace function public.has_calendar_connection()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.google_calendar_tokens where user_id = auth.uid()
  );
$$;

grant execute on function public.has_calendar_connection() to authenticated;

-- RPC to disconnect calendar safely
create or replace function public.disconnect_calendar()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.google_calendar_tokens where user_id = auth.uid();
end;
$$;

grant execute on function public.disconnect_calendar() to authenticated;
