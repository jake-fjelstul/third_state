-- =============================================================================
-- Auto-create a group chat + default channels when a new circle is inserted.
-- Adds the organizer as a chat member.
-- =============================================================================
create or replace function public.create_chat_for_new_circle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_chat_id uuid;
  v_channel_name text;
begin
  insert into public.chats (type, circle_id, name)
  values ('group', new.id, new.name)
  returning id into v_chat_id;

  foreach v_channel_name in array array['general','planning','photos','meetups'] loop
    insert into public.chat_channels (chat_id, name) values (v_chat_id, v_channel_name);
  end loop;

  -- organizer (if any) joins immediately
  if new.organizer_id is not null then
    insert into public.chat_members (chat_id, user_id) values (v_chat_id, new.organizer_id)
      on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger trg_chat_for_new_circle
  after insert on public.circles
  for each row execute procedure public.create_chat_for_new_circle();

-- =============================================================================
-- When a user joins a circle, auto-add them to the circle's group chat.
-- =============================================================================
create or replace function public.sync_chat_members_with_circle_members()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_chat_id uuid;
begin
  if tg_op = 'INSERT' then
    select id into v_chat_id from public.chats
      where type = 'group' and circle_id = new.circle_id
      limit 1;
    if v_chat_id is not null then
      insert into public.chat_members (chat_id, user_id)
        values (v_chat_id, new.user_id)
        on conflict do nothing;
    end if;
  elsif tg_op = 'DELETE' then
    select id into v_chat_id from public.chats
      where type = 'group' and circle_id = old.circle_id
      limit 1;
    if v_chat_id is not null then
      delete from public.chat_members
        where chat_id = v_chat_id and user_id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_sync_chat_members
  after insert or delete on public.circle_members
  for each row execute procedure public.sync_chat_members_with_circle_members();

-- =============================================================================
-- Backfill: create chats + channels + members for circles that already exist
-- (seeded in earlier migrations before these triggers were in place).
-- =============================================================================
do $$
declare
  c record;
  v_chat_id uuid;
  v_channel_name text;
  m record;
begin
  for c in select * from public.circles loop
    select id into v_chat_id from public.chats
      where type = 'group' and circle_id = c.id
      limit 1;
    if v_chat_id is null then
      insert into public.chats (type, circle_id, name)
        values ('group', c.id, c.name)
        returning id into v_chat_id;
      foreach v_channel_name in array array['general','planning','photos','meetups'] loop
        insert into public.chat_channels (chat_id, name)
          values (v_chat_id, v_channel_name);
      end loop;
    end if;
    -- mirror existing memberships
    for m in select user_id from public.circle_members where circle_id = c.id loop
      insert into public.chat_members (chat_id, user_id)
        values (v_chat_id, m.user_id)
        on conflict do nothing;
    end loop;
  end loop;
end $$;

-- =============================================================================
-- Postgres function: chat summaries for the current user.
-- Returns one row per chat the caller is a member of, with last message
-- preview, last message time, and unread count derived from last_read_at.
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
security invoker
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

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chat_members;
