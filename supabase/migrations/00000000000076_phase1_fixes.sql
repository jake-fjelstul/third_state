-- 076: Phase 1 fixes (plan-2026-11-10.md)
--   J1   "Free now" notifications can be turned off (notification_prefs.free_now)
--   1A-3 chat summaries carry the other person's id for DMs (peer_id)
--   1A-2 deleting one occurrence of a repeating event no longer deletes the series

-- ============================================================================
-- J1. free_now preference
-- ============================================================================
-- Same body as 056 plus the free_now branch. Pushes are sent from notification
-- rows, so skipping the row also skips the push.
create or replace function public.enqueue_notification(p_user_id uuid, p_type text, p_payload jsonb)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_prefs jsonb;
  v_should_enqueue boolean := true;
begin
  select notification_prefs into v_prefs from public.profiles where id = p_user_id;

  if v_prefs is not null then
    if p_type in ('connection_request', 'connection_accepted') then
      v_should_enqueue := coalesce((v_prefs->>'connections')::boolean, true);
    elsif p_type = 'event_approaching' then
      v_should_enqueue := coalesce((v_prefs->>'events')::boolean, true);
    elsif p_type = 'reconnect_nudge' then
      v_should_enqueue := coalesce((v_prefs->>'reconnect_nudges')::boolean, true);
    elsif p_type in ('poll_created', 'spontaneous_question',
                     'spontaneous_question_answered', 'question_revealed') then
      v_should_enqueue := coalesce((v_prefs->>'chat_activity')::boolean, true);
    elsif p_type in ('lfg_post', 'lfg_join', 'pull_up', 'checkin_note') then
      v_should_enqueue := coalesce((v_prefs->>'free_now')::boolean, true);
    end if;
  end if;

  if not v_should_enqueue then
    return null;
  end if;

  insert into public.notifications (user_id, type, payload, is_read)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb), false)
  returning id into v_id;

  return v_id;
end;
$$;

-- Keep 061's lockdown: definer code and the service role only.
revoke execute on function public.enqueue_notification(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_notification(uuid, text, jsonb) to service_role;

-- New default for people who never touched their prefs.
alter table public.profiles
  alter column notification_prefs set default
  '{"connections": true, "events": true, "reconnect_nudges": true, "chat_activity": true, "messages": true, "daily_question": true, "free_now": true}'::jsonb;

-- ============================================================================
-- 1A-3. Chat summaries: peer_id for DMs
-- ============================================================================
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
  member_count int,
  peer_id uuid
)
language sql
stable
security definer set search_path = public
as $$
  with my_memberships as (
    select cm.chat_id, cm.last_read_at, cm.hidden_at
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
    select cm.chat_id, count(*)::int as member_count
    from public.chat_members cm
    where cm.chat_id in (select chat_id from my_memberships)
    group by cm.chat_id
  ),
  peers as (
    select distinct on (cm.chat_id) cm.chat_id, cm.user_id as peer_id
    from public.chat_members cm
    join public.chats c on c.id = cm.chat_id and c.type = 'dm'
    where cm.chat_id in (select chat_id from my_memberships)
      and cm.user_id <> auth.uid()
    order by cm.chat_id, cm.user_id
  )
  select
    c.id as chat_id,
    c.type as chat_type,
    c.circle_id,
    case
      when c.type = 'dm' then coalesce((select p.name from public.profiles p where p.id = pr.peer_id), '')
      else coalesce(c.name, '')
    end as name,
    case
      when c.type = 'dm' then coalesce((select p.avatar_url from public.profiles p where p.id = pr.peer_id), '')
      else ''
    end as avatar,
    coalesce(lm.last_message, ''),
    lm.last_message_at,
    coalesce(u.unread_count, 0),
    coalesce(mc.member_count, 0),
    pr.peer_id
  from public.chats c
  join my_memberships mm on mm.chat_id = c.id
  left join last_msgs lm on lm.chat_id = c.id
  left join unreads u on u.chat_id = c.id
  left join member_counts mc on mc.chat_id = c.id
  left join peers pr on pr.chat_id = c.id
  where mm.hidden_at is null
     or (lm.last_message_at is not null and lm.last_message_at > mm.hidden_at)
  order by lm.last_message_at desc nulls last;
$$;

revoke execute on function public.get_my_chat_summaries() from public, anon;
grant execute on function public.get_my_chat_summaries() to authenticated;

-- ============================================================================
-- 1A-2. Repeating events: no cascade, and a scoped delete
-- ============================================================================
alter table public.events drop constraint if exists events_recurrence_parent_id_fkey;
alter table public.events
  add constraint events_recurrence_parent_id_fkey
  foreign key (recurrence_parent_id) references public.events(id) on delete set null;

-- p_scope: 'this' deletes one occurrence; 'following' deletes it and every
-- later occurrence in the same series. Deleting the first occurrence alone
-- promotes the next one to be the series parent. Creator only.
create or replace function public.delete_event(p_event_id uuid, p_scope text default 'this')
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ev public.events;
  v_parent uuid;
  v_next uuid;
  v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_scope not in ('this', 'following') then raise exception 'Bad scope'; end if;

  select * into v_ev from public.events where id = p_event_id;
  if not found then raise exception 'Event not found'; end if;
  if v_ev.created_by is distinct from v_uid then
    raise exception 'Only the event host can delete it';
  end if;

  v_parent := coalesce(v_ev.recurrence_parent_id, v_ev.id);

  if p_scope = 'following' then
    delete from public.events
     where created_by = v_uid
       and (id = p_event_id
            or ((id = v_parent or recurrence_parent_id = v_parent) and starts_at >= v_ev.starts_at));
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  -- 'this': if it's the parent, hand the series to the next occurrence first.
  if v_ev.recurrence_parent_id is null then
    select id into v_next from public.events
     where recurrence_parent_id = v_ev.id
     order by starts_at
     limit 1;
    if v_next is not null then
      update public.events
         set recurrence_parent_id = null,
             recurrence_rule = v_ev.recurrence_rule,
             recurrence_end_date = v_ev.recurrence_end_date
       where id = v_next;
      update public.events set recurrence_parent_id = v_next
       where recurrence_parent_id = v_ev.id and id <> v_next;
    end if;
  end if;

  delete from public.events where id = p_event_id;
  return 1;
end;
$$;

revoke execute on function public.delete_event(uuid, text) from public, anon;
grant execute on function public.delete_event(uuid, text) to authenticated;
