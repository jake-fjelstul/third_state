-- =============================================================================
-- Fix: startDM fails because the chat_members insert policy only allows
-- inserting your own row, but creating a DM requires inserting both members.
-- Solution: a security-definer function that creates the DM atomically.
-- =============================================================================

create or replace function public.start_dm(p_peer_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chat_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_uid = p_peer_id then
    raise exception 'Cannot DM yourself';
  end if;

  -- Check for existing DM between these two users
  select cm1.chat_id into v_chat_id
    from public.chat_members cm1
    join public.chat_members cm2 on cm2.chat_id = cm1.chat_id
    join public.chats c on c.id = cm1.chat_id
    where cm1.user_id = v_uid
      and cm2.user_id = p_peer_id
      and c.type = 'dm'
    limit 1;

  if v_chat_id is not null then
    return v_chat_id;
  end if;

  -- Create new DM chat
  insert into public.chats (type, name)
    values ('dm', null)
    returning id into v_chat_id;

  -- Add both members (this bypasses RLS since we're security definer)
  insert into public.chat_members (chat_id, user_id)
    values (v_chat_id, v_uid), (v_chat_id, p_peer_id);

  return v_chat_id;
end;
$$;
