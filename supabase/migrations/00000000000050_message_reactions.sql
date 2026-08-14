-- =============================================================================
-- Message reactions (iMessage-style)
-- =============================================================================

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id, emoji)
);

create index idx_message_reactions_message on public.message_reactions(message_id);
create index idx_message_reactions_chat on public.message_reactions(chat_id);

alter table public.message_reactions enable row level security;

-- Members of the chat can see all reactions in that chat.
create policy "chat members read reactions"
  on public.message_reactions for select to authenticated
  using (public.is_chat_member(chat_id));

-- A user may only insert their own reaction, and only in a chat they belong to.
create policy "chat members add own reactions"
  on public.message_reactions for insert to authenticated
  with check (auth.uid() = user_id and public.is_chat_member(chat_id));

-- A user may only remove their own reaction.
create policy "users remove own reactions"
  on public.message_reactions for delete to authenticated
  using (auth.uid() = user_id);

-- Toggle helper: adds the reaction if absent, removes it if present.
-- Security definer so chat_id can be derived from the message server-side
-- rather than trusted from the client.
create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_chat_id uuid;
  v_existing uuid;
begin
  select chat_id into v_chat_id from public.messages where id = p_message_id;
  if v_chat_id is null then
    raise exception 'Message not found';
  end if;

  if not public.is_chat_member(v_chat_id) then
    raise exception 'Not a member of this chat';
  end if;

  if p_emoji is null or length(trim(p_emoji)) = 0 or length(p_emoji) > 16 then
    raise exception 'Invalid emoji';
  end if;

  select id into v_existing
    from public.message_reactions
   where message_id = p_message_id
     and user_id = auth.uid()
     and emoji = p_emoji;

  if v_existing is not null then
    delete from public.message_reactions where id = v_existing;
    return false;
  end if;

  insert into public.message_reactions (message_id, chat_id, user_id, emoji)
  values (p_message_id, v_chat_id, auth.uid(), p_emoji);
  return true;
end;
$$;

alter publication supabase_realtime add table public.message_reactions;
