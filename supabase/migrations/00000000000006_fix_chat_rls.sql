-- =============================================================================
-- Fix infinite recursion in chat_members RLS policy
-- =============================================================================

-- 1. Create a helper function that bypasses RLS to check membership
create or replace function public.is_chat_member(c_id uuid)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists(
    select 1 from public.chat_members
    where chat_id = c_id and user_id = auth.uid()
  );
$$;

-- 2. Drop the recursive policies
drop policy if exists "chat members read membership" on public.chat_members;
drop policy if exists "chat members read chat" on public.chats;
drop policy if exists "chat members read channels" on public.chat_channels;
drop policy if exists "chat members create channels" on public.chat_channels;
drop policy if exists "chat members read messages" on public.messages;
drop policy if exists "chat members send messages" on public.messages;

-- 3. Recreate them using the helper function to avoid recursion
create policy "chat members read membership"
  on public.chat_members for select to authenticated
  using (public.is_chat_member(chat_id));

create policy "chat members read chat"
  on public.chats for select to authenticated
  using (public.is_chat_member(id));

create policy "chat members read channels"
  on public.chat_channels for select to authenticated
  using (public.is_chat_member(chat_id));

create policy "chat members create channels"
  on public.chat_channels for insert to authenticated
  with check (public.is_chat_member(chat_id));

create policy "chat members read messages"
  on public.messages for select to authenticated
  using (public.is_chat_member(chat_id));

create policy "chat members send messages"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_chat_member(chat_id)
  );

-- =============================================================================
-- Update RPC to bypass RLS for performance and avoid edge cases
-- =============================================================================
create or replace function public.get_my_chat_summaries()
returns table (
  chat_id uuid,
  chat_type text,
  circle_id uuid,
  name text,
  last_message text,
  last_message_at timestamptz,
  unread_count int,
  member_count int
)
language sql
stable
security definer set search_path = public
as $$
  with my_memberships as (
    select cm.chat_id, cm.last_read_at
    from public.chat_members cm
    where cm.user_id = auth.uid()
  ),
  last_msgs as (
    select distinct on (m.chat_id)
      m.chat_id, m.text as last_message, m.created_at as last_message_at
    from public.messages m
    where m.chat_id in (select chat_id from my_memberships)
    order by m.chat_id, m.created_at desc
  ),
  unreads as (
    select m.chat_id, count(*)::int as unread_count
    from public.messages m
    join my_memberships mm on mm.chat_id = m.chat_id
    where m.created_at > coalesce(mm.last_read_at, 'epoch'::timestamptz)
      and m.sender_id is distinct from auth.uid()
    group by m.chat_id
  ),
  member_counts as (
    select chat_id, count(*)::int as member_count
    from public.chat_members
    group by chat_id
  )
  select
    c.id as chat_id,
    c.type as chat_type,
    c.circle_id,
    coalesce(c.name, ''),
    coalesce(lm.last_message, ''),
    lm.last_message_at,
    coalesce(u.unread_count, 0),
    coalesce(mc.member_count, 0)
  from public.chats c
  join my_memberships mm on mm.chat_id = c.id
  left join last_msgs lm on lm.chat_id = c.id
  left join unreads u on u.chat_id = c.id
  left join member_counts mc on mc.chat_id = c.id
  order by lm.last_message_at desc nulls last;
$$;
