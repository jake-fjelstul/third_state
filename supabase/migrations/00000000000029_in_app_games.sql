-- =============================================================================
-- THIRD SPACE — PHASE 4.1: In-App Games (multiplayer + win checks + RPCs)
-- =============================================================================

-- ---------- 1) Messages: kind + payload for typed messages (game invites etc.)
alter table public.messages
  add column if not exists kind text not null default 'text',
  add column if not exists payload jsonb;

comment on column public.messages.kind is
  'Message variant. Default ''text'' renders as a plain bubble. Special kinds: ''game'' (payload carries gameId, gameType).';
comment on column public.messages.payload is
  'Optional structured data accompanying non-text messages.';

-- ---------- 2) Games table
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('tic_tac_toe', 'connect_four')),
  chat_id uuid not null references public.chats(id) on delete cascade,
  player_x uuid not null references public.profiles(id) on delete cascade,  -- host (first to move)
  player_o uuid not null references public.profiles(id) on delete cascade,  -- opponent
  current_turn text not null default 'x' check (current_turn in ('x','o')),
  state jsonb not null,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  winner text check (winner in ('x','o','draw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_x <> player_o)
);

create index idx_games_chat on public.games(chat_id);
create index idx_games_players on public.games(player_x, player_o);

alter table public.games enable row level security;

create policy "games: players read"
  on public.games for select to authenticated
  using (auth.uid() = player_x or auth.uid() = player_o);

create policy "games: players update"
  on public.games for update to authenticated
  using (auth.uid() = player_x or auth.uid() = player_o)
  with check (auth.uid() = player_x or auth.uid() = player_o);

-- INSERT is via RPC only — no insert policy. (RPCs run as security definer.)

-- ---------- 3) Win-check helpers

-- Tic-Tac-Toe: 9-cell flat array, '' / 'x' / 'o'
create or replace function public.tic_tac_toe_winner(p_cells jsonb)
returns text language plpgsql immutable as $$
declare
  b text[];
  lines int[][] := array[
    array[0,1,2], array[3,4,5], array[6,7,8],   -- rows
    array[0,3,6], array[1,4,7], array[2,5,8],   -- cols
    array[0,4,8], array[2,4,6]                  -- diagonals
  ];
  ln int[];
  i int;
begin
  b := array(select coalesce(value, '') from jsonb_array_elements_text(p_cells) value);
  for i in 1..array_length(lines, 1) loop
    ln := lines[i];
    if b[ln[1]+1] <> '' and b[ln[1]+1] = b[ln[2]+1] and b[ln[2]+1] = b[ln[3]+1] then
      return b[ln[1]+1];
    end if;
  end loop;
  if not exists (select 1 from unnest(b) v where v = '') then
    return 'draw';
  end if;
  return null;
end; $$;

-- Connect Four: 42-cell flat array, row-major (row 0 top). 6 rows x 7 cols.
create or replace function public.connect_four_winner(p_cells jsonb)
returns text language plpgsql immutable as $$
declare
  b text[];
  r int; c int; v text; idx int;
begin
  b := array(select coalesce(value, '') from jsonb_array_elements_text(p_cells) value);
  -- Horizontal
  for r in 0..5 loop
    for c in 0..3 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+1] and v = b[idx+2] and v = b[idx+3] then return v; end if;
    end loop;
  end loop;
  -- Vertical
  for c in 0..6 loop
    for r in 0..2 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+7] and v = b[idx+14] and v = b[idx+21] then return v; end if;
    end loop;
  end loop;
  -- Diagonal down-right
  for r in 0..2 loop
    for c in 0..3 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+8] and v = b[idx+16] and v = b[idx+24] then return v; end if;
    end loop;
  end loop;
  -- Diagonal down-left
  for r in 0..2 loop
    for c in 3..6 loop
      idx := r*7 + c + 1;
      v := b[idx];
      if v <> '' and v = b[idx+6] and v = b[idx+12] and v = b[idx+18] then return v; end if;
    end loop;
  end loop;
  if not exists (select 1 from unnest(b) cell where cell = '') then
    return 'draw';
  end if;
  return null;
end; $$;

-- ---------- 4) RPC: create_chat_game
-- Creates a multiplayer game in a DM chat + sends a "game invite" message in one atomic op.
create or replace function public.create_chat_game(
  p_chat_id uuid,
  p_game_type text
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game_id uuid;
  v_other uuid;
  v_initial jsonb;
  v_label text;
  v_member_count int;
  v_chat_type text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (select 1 from public.chat_members where chat_id = p_chat_id and user_id = v_uid) then
    raise exception 'Not a member of this chat';
  end if;

  select type into v_chat_type from public.chats where id = p_chat_id;
  if v_chat_type <> 'dm' then
    raise exception 'Games are only supported in 1-on-1 chats';
  end if;

  select count(*) into v_member_count from public.chat_members where chat_id = p_chat_id;
  if v_member_count <> 2 then
    raise exception 'Games are only supported in 1-on-1 chats';
  end if;

  select user_id into v_other from public.chat_members
    where chat_id = p_chat_id and user_id <> v_uid limit 1;

  case p_game_type
    when 'tic_tac_toe' then
      v_initial := jsonb_build_object('cells', jsonb_build_array('','','','','','','','',''));
      v_label   := 'Tic-Tac-Toe';
    when 'connect_four' then
      v_initial := jsonb_build_object(
        'cells', (select jsonb_agg(''::text) from generate_series(1, 42))
      );
      v_label := 'Connect Four';
    else raise exception 'Unknown game type %', p_game_type;
  end case;

  insert into public.games (type, chat_id, player_x, player_o, current_turn, state, status)
  values (p_game_type, p_chat_id, v_uid, v_other, 'x', v_initial, 'in_progress')
  returning id into v_game_id;

  insert into public.messages (chat_id, sender_id, text, kind, payload)
  values (
    p_chat_id, v_uid,
    '🎮 Started ' || v_label,
    'game',
    jsonb_build_object('gameId', v_game_id, 'gameType', p_game_type)
  );

  return v_game_id;
end; $$;

grant execute on function public.create_chat_game(uuid, text) to authenticated;

-- ---------- 5) RPC: commit_game_move
-- Validates turn order + computes winner, then writes new state.
create or replace function public.commit_game_move(p_game_id uuid, p_new_state jsonb)
returns public.games
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_my_token text;
  v_winner text;
  v_new_status text;
  v_new_turn text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if v_game.status <> 'in_progress' then raise exception 'Game already ended'; end if;

  if v_game.player_x = v_uid then v_my_token := 'x';
  elsif v_game.player_o = v_uid then v_my_token := 'o';
  else raise exception 'You are not a player in this game';
  end if;

  if v_game.current_turn <> v_my_token then
    raise exception 'Not your turn';
  end if;

  case v_game.type
    when 'tic_tac_toe'  then v_winner := public.tic_tac_toe_winner(p_new_state->'cells');
    when 'connect_four' then v_winner := public.connect_four_winner(p_new_state->'cells');
    else raise exception 'Unknown game type %', v_game.type;
  end case;

  if v_winner is not null then
    v_new_status := 'completed';
    v_new_turn := v_game.current_turn;
  else
    v_new_status := 'in_progress';
    v_new_turn := case when v_my_token = 'x' then 'o' else 'x' end;
  end if;

  update public.games
     set state = p_new_state,
         current_turn = v_new_turn,
         status = v_new_status,
         winner = v_winner,
         updated_at = now()
   where id = p_game_id
   returning * into v_game;

  return v_game;
end; $$;

grant execute on function public.commit_game_move(uuid, jsonb) to authenticated;

-- ---------- 6) RPC: resign_game (forfeit)
create or replace function public.resign_game(p_game_id uuid)
returns public.games
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_winner text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if v_game.status <> 'in_progress' then return v_game; end if;

  if v_game.player_x = v_uid then v_winner := 'o';
  elsif v_game.player_o = v_uid then v_winner := 'x';
  else raise exception 'You are not a player in this game';
  end if;

  update public.games
     set status = 'completed',
         winner = v_winner,
         updated_at = now()
   where id = p_game_id
   returning * into v_game;

  return v_game;
end; $$;

grant execute on function public.resign_game(uuid) to authenticated;

-- ---------- 7) Realtime publication
alter publication supabase_realtime add table public.games;
