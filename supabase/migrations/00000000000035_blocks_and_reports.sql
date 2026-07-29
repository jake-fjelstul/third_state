-- =============================================================================
-- THIRD SPACE — Blocks & Reports (App Store Guideline 1.2)
-- =============================================================================

-- ---------- 1) Blocks table
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_blocks_blocker on public.blocks(blocker_id);
create index if not exists idx_blocks_blocked on public.blocks(blocked_id);

alter table public.blocks enable row level security;

-- A user can see blocks they created. They cannot enumerate who blocked them.
create policy "users read their own blocks"
  on public.blocks for select to authenticated
  using (auth.uid() = blocker_id);

-- Inserts go through the block_user RPC, but allow direct insert as well
-- so the client can operate without the RPC if needed.
create policy "users create their own blocks"
  on public.blocks for insert to authenticated
  with check (auth.uid() = blocker_id);

create policy "users remove their own blocks"
  on public.blocks for delete to authenticated
  using (auth.uid() = blocker_id);

-- ---------- 2) Reports table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reported_message_id uuid references public.messages(id) on delete set null,
  reported_circle_id uuid references public.circles(id) on delete set null,
  reason text not null check (reason in (
    'harassment', 'spam', 'inappropriate_content', 'impersonation',
    'safety_concern', 'other'
  )),
  details text,
  context_snapshot jsonb,
  status text not null default 'pending' check (status in ('pending','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (
    reported_user_id is not null
    or reported_message_id is not null
    or reported_circle_id is not null
  )
);

create index if not exists idx_reports_status on public.reports(status, created_at desc);
create index if not exists idx_reports_reported_user on public.reports(reported_user_id);

alter table public.reports enable row level security;

-- Users can file reports and see the reports they filed. They cannot see
-- reports filed by others, and they cannot modify a report after filing.
create policy "users file reports"
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "users read their own reports"
  on public.reports for select to authenticated
  using (auth.uid() = reporter_id);

-- ---------- 3) Helper: is there a block in EITHER direction?
create or replace function public.is_blocked_with(p_other_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_id)
       or (blocker_id = p_other_id and blocked_id = auth.uid())
  );
$$;

grant execute on function public.is_blocked_with(uuid) to authenticated;

-- ---------- 4) Helper: all user ids the current user cannot see
create or replace function public.my_blocked_user_ids()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

grant execute on function public.my_blocked_user_ids() to authenticated;

-- ---------- 5) RPC: block a user (and sever all existing ties)
create or replace function public.block_user(p_target_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_uid = p_target_id then raise exception 'Cannot block yourself'; end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_target_id)
  on conflict do nothing;

  -- Sever the connection in both directions.
  delete from public.connections
  where (user_id = v_uid and connected_user_id = p_target_id)
     or (user_id = p_target_id and connected_user_id = v_uid);

  -- Remove any pending or historical connection requests.
  delete from public.connection_requests
  where (requester_id = v_uid and recipient_id = p_target_id)
     or (requester_id = p_target_id and recipient_id = v_uid);

  -- Clear notifications referencing the blocked user so they stop surfacing.
  delete from public.notifications
  where user_id = v_uid
    and payload->'user'->>'id' = p_target_id::text;
end; $$;

grant execute on function public.block_user(uuid) to authenticated;

-- ---------- 6) RPC: unblock
create or replace function public.unblock_user(p_target_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  delete from public.blocks
  where blocker_id = v_uid and blocked_id = p_target_id;
end; $$;

grant execute on function public.unblock_user(uuid) to authenticated;

-- ---------- 7) RPC: file a report
create or replace function public.file_report(
  p_reported_user_id uuid default null,
  p_reported_message_id uuid default null,
  p_reported_circle_id uuid default null,
  p_reason text default 'other',
  p_details text default null,
  p_context jsonb default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_reported_user_id is null
     and p_reported_message_id is null
     and p_reported_circle_id is null then
    raise exception 'A report must reference a user, message, or circle';
  end if;

  insert into public.reports (
    reporter_id, reported_user_id, reported_message_id, reported_circle_id,
    reason, details, context_snapshot
  ) values (
    v_uid, p_reported_user_id, p_reported_message_id, p_reported_circle_id,
    p_reason, p_details, p_context
  )
  returning id into v_id;

  return v_id;
end; $$;

grant execute on function public.file_report(uuid, uuid, uuid, text, text, jsonb) to authenticated;

-- ---------- 8) Hide messages from blocked users
-- The existing "chat members read messages" policy allows any chat member to
-- read all messages. Add a block filter on top of it.
drop policy if exists "chat members read messages" on public.messages;

create policy "chat members read messages"
  on public.messages for select to authenticated
  using (
    public.is_chat_member(chat_id)
    and (
      sender_id is null
      or sender_id = auth.uid()
      or not public.is_blocked_with(sender_id)
    )
  );
