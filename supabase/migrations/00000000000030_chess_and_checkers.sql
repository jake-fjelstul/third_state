-- =============================================================================
-- THIRD SPACE — PHASE 4.1b: Chess & Checkers (game types + RPC extension)
-- =============================================================================

-- 1) Extend allowed game types
alter table public.games drop constraint games_type_check;
alter table public.games add constraint games_type_check
  check (type in ('tic_tac_toe', 'connect_four', 'chess', 'checkers'));

-- 2) Checkers basic win check — server-validated "0 pieces remaining" case.
--    More nuanced "no legal moves" (stalemate) is trusted to the client declaration.
create or replace function public.checkers_winner_basic(p_cells jsonb)
returns text language plpgsql immutable as $$
declare
  has_x boolean;
  has_o boolean;
begin
  select
    exists(select 1 from jsonb_array_elements_text(p_cells) v where v in ('x','X')),
    exists(select 1 from jsonb_array_elements_text(p_cells) v where v in ('o','O'))
  into has_x, has_o;
  if not has_x then return 'o'; end if;
  if not has_o then return 'x'; end if;
  return null;
end; $$;

-- 3) Replace commit_game_move with a 3-arg version that accepts a client-declared winner.
drop function if exists public.commit_game_move(uuid, jsonb);

create or replace function public.commit_game_move(
  p_game_id uuid,
  p_new_state jsonb,
  p_declared_winner text default null
) returns public.games
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_my_token text;
  v_winner text;
  v_basic_winner text;
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

  -- Sanitize declared winner so clients can't supply garbage
  if p_declared_winner is not null
     and p_declared_winner not in ('x','o','draw') then
    raise exception 'Invalid declared winner %', p_declared_winner;
  end if;

  case v_game.type
    when 'tic_tac_toe' then
      v_winner := public.tic_tac_toe_winner(p_new_state->'cells');
    when 'connect_four' then
      v_winner := public.connect_four_winner(p_new_state->'cells');
    when 'checkers' then
      v_basic_winner := public.checkers_winner_basic(p_new_state->'cells');
      v_winner := coalesce(v_basic_winner, p_declared_winner);
    when 'chess' then
      v_winner := p_declared_winner;
    else
      raise exception 'Unknown game type %', v_game.type;
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

grant execute on function public.commit_game_move(uuid, jsonb, text) to authenticated;

-- 4) create_chat_game needs initial states for the new types
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
      v_label := 'Tic-Tac-Toe';
    when 'connect_four' then
      v_initial := jsonb_build_object(
        'cells', (select jsonb_agg(''::text) from generate_series(1, 42))
      );
      v_label := 'Connect Four';
    when 'checkers' then
      v_initial := jsonb_build_object(
        'cells', jsonb_build_array(
          '','o','','o','','o','','o',
          'o','','o','','o','','o','',
          '','o','','o','','o','','o',
          '','','','','','','','',
          '','','','','','','','',
          'x','','x','','x','','x','',
          '','x','','x','','x','','x',
          'x','','x','','x','','x',''
        )
      );
      v_label := 'Checkers';
    when 'chess' then
      v_initial := jsonb_build_object(
        'fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      );
      v_label := 'Chess';
    else
      raise exception 'Unknown game type %', p_game_type;
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
