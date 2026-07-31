-- =============================================================================
-- THIRD SPACE — Polls in chat
-- Mirrors the games pattern: a row in its own table, announced by a
-- messages row with kind='poll' and payload carrying the id.
-- =============================================================================

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  channel_id uuid references public.chat_channels(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  question text not null,
  options jsonb not null,
  allow_multiple boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint polls_question_len check (char_length(btrim(question)) between 1 and 200),
  constraint polls_options_is_array check (jsonb_typeof(options) = 'array'),
  constraint polls_options_count check (jsonb_array_length(options) between 2 and 10)
);

create index if not exists idx_polls_chat on public.polls(chat_id);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index int not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id, option_index)
);

create index if not exists idx_poll_votes_poll on public.poll_votes(poll_id);

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

create policy "polls: chat members read"
  on public.polls for select to authenticated
  using (exists (
    select 1 from public.chat_members cm
    where cm.chat_id = polls.chat_id and cm.user_id = auth.uid()
  ));

create policy "poll_votes: chat members read"
  on public.poll_votes for select to authenticated
  using (exists (
    select 1 from public.polls p
    join public.chat_members cm on cm.chat_id = p.chat_id
    where p.id = poll_votes.poll_id and cm.user_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies. All writes go through the security
-- definer RPCs below, matching the games table convention.

create or replace function public.create_chat_poll(
  p_chat_id uuid,
  p_question text,
  p_options jsonb,
  p_allow_multiple boolean default false,
  p_channel_id uuid default null
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll_id uuid;
  v_q text := btrim(p_question);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this chat';
  end if;

  if v_q = '' then raise exception 'A poll needs a question'; end if;

  if jsonb_typeof(p_options) <> 'array'
     or jsonb_array_length(p_options) < 2
     or jsonb_array_length(p_options) > 10 then
    raise exception 'A poll needs between two and ten options';
  end if;

  insert into public.polls (chat_id, channel_id, created_by, question, options, allow_multiple)
  values (p_chat_id, p_channel_id, v_uid, v_q, p_options, coalesce(p_allow_multiple, false))
  returning id into v_poll_id;

  insert into public.messages (chat_id, channel_id, sender_id, text, kind, payload)
  values (
    p_chat_id, p_channel_id, v_uid,
    '📊 ' || v_q,
    'poll',
    jsonb_build_object('pollId', v_poll_id)
  );

  return v_poll_id;
end; $$;

create or replace function public.vote_poll(p_poll_id uuid, p_option_index int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_existing boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_poll from public.polls where id = p_poll_id;
  if not found then raise exception 'Poll not found'; end if;
  if v_poll.closed_at is not null then raise exception 'This poll is closed'; end if;

  if not exists (
    select 1 from public.chat_members
    where chat_id = v_poll.chat_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this chat';
  end if;

  if p_option_index < 0 or p_option_index >= jsonb_array_length(v_poll.options) then
    raise exception 'Invalid option';
  end if;

  select exists (
    select 1 from public.poll_votes
    where poll_id = p_poll_id and user_id = v_uid and option_index = p_option_index
  ) into v_existing;

  if v_existing then
    delete from public.poll_votes
    where poll_id = p_poll_id and user_id = v_uid and option_index = p_option_index;
  else
    if not v_poll.allow_multiple then
      delete from public.poll_votes where poll_id = p_poll_id and user_id = v_uid;
    end if;
    insert into public.poll_votes (poll_id, user_id, option_index)
    values (p_poll_id, v_uid, p_option_index);
  end if;
end; $$;

create or replace function public.close_poll(p_poll_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  update public.polls
  set closed_at = now()
  where id = p_poll_id and created_by = v_uid and closed_at is null;
  if not found then raise exception 'Only the poll creator can close it'; end if;
end; $$;

grant execute on function public.create_chat_poll(uuid, text, jsonb, boolean, uuid) to authenticated;
grant execute on function public.vote_poll(uuid, int) to authenticated;
grant execute on function public.close_poll(uuid) to authenticated;

alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_votes;
