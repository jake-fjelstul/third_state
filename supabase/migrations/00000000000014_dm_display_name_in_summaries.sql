drop function if exists public.get_my_chat_summaries();

create function public.get_my_chat_summaries()
returns table (
  chat_id uuid,
  chat_type text,
  circle_id uuid,
  name text,
  avatar text,
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
    case
      when c.type = 'dm' then coalesce((
        select p.name
        from public.chat_members cm
        join public.profiles p on p.id = cm.user_id
        where cm.chat_id = c.id
          and cm.user_id <> auth.uid()
        limit 1
      ), '')
      else coalesce(c.name, '')
    end as name,
    case
      when c.type = 'dm' then coalesce((
        select p.avatar_url
        from public.chat_members cm
        join public.profiles p on p.id = cm.user_id
        where cm.chat_id = c.id
          and cm.user_id <> auth.uid()
        limit 1
      ), '')
      else ''
    end as avatar,
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
