-- =============================================================================
-- THIRD SPACE — Phase 4.2: Connection Questions (Daily & Spontaneous)
-- =============================================================================

-- ---------- 1a) Day helper ----------
create or replace function public.app_day()
returns date language sql stable as $$
  select (now() at time zone 'America/New_York')::date;
$$;

grant execute on function public.app_day() to authenticated;

-- ---------- 1b) Question bank ----------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  sort_order int not null,
  tier int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_questions_sort on public.questions(sort_order);
alter table public.questions enable row level security;

drop policy if exists "questions: all read" on public.questions;
create policy "questions: all read"
  on public.questions for select to authenticated using (true);

-- Seed 60 connection questions
insert into public.questions (sort_order, text) values
  (0, 'What''s something you keep meaning to do and haven''t?'),
  (1, 'What''s the last thing that made you laugh out loud?'),
  (2, 'What''s a small thing that reliably improves your day?'),
  (3, 'What''s a food combination you enjoy that others might find strange?'),
  (4, 'What''s a skill or hobby you''d love to learn if you had extra time?'),
  (5, 'What''s the best piece of advice you''ve received recently?'),
  (6, 'What''s something you recently bought that was surprisingly worth it?'),
  (7, 'What''s your ultimate comfort meal after a long day?'),
  (8, 'What''s a hidden gem spot in your city or neighborhood?'),
  (9, 'What''s a movie or show you can rewatch without getting tired of it?'),
  (10, 'What''s a topic you could give a 10-minute presentation on with zero prep?'),
  (11, 'What''s your favorite way to spend a quiet Sunday morning?'),
  (12, 'What''s a song that instantly boosts your mood?'),
  (13, 'What''s a habit you picked up recently that stuck?'),
  (14, 'What''s your ideal vacation style: active adventure or total relaxation?'),
  (15, 'What''s a book or article that changed how you think about something?'),
  (16, 'What''s your primary go-to beverage in the morning?'),
  (17, 'What''s something small that always makes you feel nostalgic?'),
  (18, 'What''s a simple pleasure you never take for granted?'),
  (19, 'What''s the most memorable meal you''ve had in the past year?'),
  (20, 'What''s a podcast or channel you listen to regularly?'),
  (21, 'What''s a minor inconvenience that annoys you more than it should?'),
  (22, 'What''s a recommendation someone gave you that exceeded expectations?'),
  (23, 'What''s your favorite seasonal weather of the year?'),
  (24, 'What''s a project or goal you''re excited about working on right now?'),
  (25, 'What''s a game (board game, video game, or sport) you love playing?'),
  (26, 'What''s your favorite sound in nature?'),
  (27, 'What''s a piece of tech or gear that makes your daily life easier?'),
  (28, 'What''s a lesson you learned the hard way that proved valuable?'),
  (29, 'What''s your favorite local coffee shop or restaurant dish?'),
  (30, 'What''s a creative outlet you enjoy?'),
  (31, 'What''s a tradition—big or small—that you always look forward to?'),
  (32, 'What''s the last museum, event, or concert you went to?'),
  (33, 'What''s something you were skeptical about until you tried it?'),
  (34, 'What''s your favorite room or corner in your home?'),
  (35, 'What''s a funny or unusual habit you have?'),
  (36, 'What''s your favorite dessert or sweet treat?'),
  (37, 'What''s a compliment you received that meant a lot to you?'),
  (38, 'What''s a trip or destination on your bucket list?'),
  (39, 'What''s your favorite thing to do on a rainy day?'),
  (40, 'What''s a movie genre you secretly love?'),
  (41, 'What''s the best gift you''ve ever given or received?'),
  (42, 'What''s a rule of thumb you live by?'),
  (43, 'What''s your favorite time of day and why?'),
  (44, 'What''s a childhood memory that still makes you smile?'),
  (45, 'What''s your favorite genre of music to listen to while working?'),
  (46, 'What''s something new you learned this past week?'),
  (47, 'What''s an item you never leave home without besides phone and keys?'),
  (48, 'What''s your favorite way to unwind after a high-stress day?'),
  (49, 'What''s a craft or DIY project you''d like to try?'),
  (50, 'What''s a scent that immediately takes you back in time?'),
  (51, 'What''s your favorite app on your phone that isn''t social media?'),
  (52, 'What''s a place you''ve visited that felt like another world?'),
  (53, 'What''s a quote or phrase that resonates with you?'),
  (54, 'What''s your go-to snack during a long movie?'),
  (55, 'What''s something you appreciate more as you get older?'),
  (56, 'What''s a favorite memory from a road trip or travel?'),
  (57, 'What''s a workout or physical activity you actually look forward to?'),
  (58, 'What''s a skill you''re surprisingly good at?'),
  (59, 'What''s something you''re looking forward to this week?')
on conflict (sort_order) do update set text = excluded.text;

-- ---------- 1c) Question of the day ----------
create or replace function public.question_of_the_day()
returns public.questions language sql stable as $$
  select q.* from public.questions q
  where q.active
  order by q.sort_order
  offset (
    (public.app_day() - date '2026-01-01')::int
    % greatest((select count(*) from public.questions where active), 1)
  )
  limit 1;
$$;

grant execute on function public.question_of_the_day() to authenticated;

-- ---------- 1d) Daily question answers table ----------
create table if not exists public.daily_question_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_day date not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (user_id, answer_day)
);

create index if not exists idx_dqa_day on public.daily_question_answers(answer_day);
alter table public.daily_question_answers enable row level security;

drop policy if exists "dqa: read own" on public.daily_question_answers;
create policy "dqa: read own"
  on public.daily_question_answers for select to authenticated
  using (auth.uid() = user_id);

-- ---------- 1e) Reveal guard and preferences ----------
create table if not exists public.question_reveals (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  answer_day date not null,
  message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (chat_id, answer_day)
);

alter table public.question_reveals enable row level security;

drop policy if exists "reveals: members read" on public.question_reveals;
create policy "reveals: members read"
  on public.question_reveals for select to authenticated
  using (exists (
    select 1 from public.chat_members cm
    where cm.chat_id = question_reveals.chat_id and cm.user_id = auth.uid()
  ));

create table if not exists public.question_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_enabled boolean not null default true,
  last_dismissed_day date
);

alter table public.question_prefs enable row level security;

drop policy if exists "prefs: own all" on public.question_prefs;
create policy "prefs: own all"
  on public.question_prefs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 1f) Eligibility helper ----------
create or replace function public.is_question_eligible(p_chat_id uuid)
returns boolean language plpgsql stable as $$
declare
  v_chat_type text;
  v_member_ids uuid[];
begin
  select type into v_chat_type from public.chats where id = p_chat_id;
  if v_chat_type <> 'dm' or v_chat_type is null then
    return false;
  end if;

  select array_agg(user_id) into v_member_ids
  from public.chat_members
  where chat_id = p_chat_id;

  if array_length(v_member_ids, 1) <> 2 then
    return false;
  end if;

  if not exists (select 1 from public.messages where chat_id = p_chat_id and sender_id = v_member_ids[1]) then
    return false;
  end if;

  if not exists (select 1 from public.messages where chat_id = p_chat_id and sender_id = v_member_ids[2]) then
    return false;
  end if;

  if not exists (select 1 from public.messages where chat_id = p_chat_id and created_at >= (now() - interval '21 days')) then
    return false;
  end if;

  return true;
end; $$;

grant execute on function public.is_question_eligible(uuid) to authenticated;

-- ---------- 1g) get_daily_question() RPC ----------
create or replace function public.get_daily_question()
returns table (
  question_id uuid,
  question_text text,
  already_answered boolean,
  dismissed_today boolean,
  enabled boolean
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
  v_q public.questions%rowtype;
  v_pref public.question_prefs%rowtype;
  v_answered boolean;
  v_dismissed boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_pref from public.question_prefs where user_id = v_uid;
  if not found then
    insert into public.question_prefs (user_id, daily_enabled, last_dismissed_day)
      values (v_uid, true, null)
      on conflict (user_id) do nothing;
    select * into v_pref from public.question_prefs where user_id = v_uid;
  end if;

  v_q := public.question_of_the_day();
  if v_q.id is null then
    return;
  end if;

  select exists (
    select 1 from public.daily_question_answers
    where user_id = v_uid and answer_day = v_today
  ) into v_answered;

  v_dismissed := (v_pref.last_dismissed_day is not null and v_pref.last_dismissed_day = v_today);

  return query select
    v_q.id,
    v_q.text,
    v_answered,
    v_dismissed,
    v_pref.daily_enabled;
end; $$;

grant execute on function public.get_daily_question() to authenticated;

-- ---------- 1k & 1h) Sweep function & answer RPC ----------
create or replace function public.sync_question_reveals()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
  v_q public.questions%rowtype;
  v_chat record;
  v_my_ans public.daily_question_answers%rowtype;
  v_other_ans public.daily_question_answers%rowtype;
  v_my_name text;
  v_other_name text;
  v_payload jsonb;
  v_msg_id uuid;
  v_reveal_id uuid;
  v_first_user_id uuid;
  v_first_name text;
  v_first_text text;
  v_second_user_id uuid;
  v_second_name text;
  v_second_text text;
begin
  if v_uid is null then
    return;
  end if;

  -- Caller must have answered today
  select * into v_my_ans from public.daily_question_answers
    where user_id = v_uid and answer_day = v_today;
  if not found then
    return;
  end if;

  v_q := public.question_of_the_day();
  if v_q.id is null then
    return;
  end if;

  select name into v_my_name from public.profiles where id = v_uid;

  -- Find eligible chats where other member answered today and no reveal exists yet
  for v_chat in
    select cm1.chat_id, cm2.user_id as other_id, p.name as other_name
    from public.chat_members cm1
    join public.chat_members cm2 on cm2.chat_id = cm1.chat_id and cm2.user_id <> cm1.user_id
    join public.chats c on c.id = cm1.chat_id
    join public.profiles p on p.id = cm2.user_id
    where cm1.user_id = v_uid
      and c.type = 'dm'
  loop
    if public.is_question_eligible(v_chat.chat_id) then
      select * into v_other_ans from public.daily_question_answers
        where user_id = v_chat.other_id and answer_day = v_today;
      
      if v_other_ans.id is not null then
        if not exists (select 1 from public.question_reveals where chat_id = v_chat.chat_id and answer_day = v_today) then
          -- Reserve the reveal row safely
          begin
            insert into public.question_reveals (chat_id, answer_day)
              values (v_chat.chat_id, v_today)
              returning id into v_reveal_id;
          exception when unique_violation then
            v_reveal_id := null;
          end;

          if v_reveal_id is not null then
            -- Order answers by created_at ascending
            if v_my_ans.created_at <= v_other_ans.created_at then
              v_first_user_id := v_uid;
              v_first_name := v_my_name;
              v_first_text := v_my_ans.text;
              v_second_user_id := v_chat.other_id;
              v_second_name := v_chat.other_name;
              v_second_text := v_other_ans.text;
            else
              v_first_user_id := v_chat.other_id;
              v_first_name := v_chat.other_name;
              v_first_text := v_other_ans.text;
              v_second_user_id := v_uid;
              v_second_name := v_my_name;
              v_second_text := v_my_ans.text;
            end if;

            v_payload := jsonb_build_object(
              'variant', 'daily',
              'questionText', v_q.text,
              'answers', jsonb_build_array(
                jsonb_build_object('userId', v_first_user_id, 'name', v_first_name, 'text', v_first_text),
                jsonb_build_object('userId', v_second_user_id, 'name', v_second_name, 'text', v_second_text)
              )
            );

            insert into public.messages (chat_id, sender_id, text, kind, payload)
              values (v_chat.chat_id, v_uid, v_q.text, 'question', v_payload)
              returning id into v_msg_id;

            update public.question_reveals
               set message_id = v_msg_id
             where id = v_reveal_id;

            -- Notify recipient
            perform public.enqueue_notification(
              v_chat.other_id,
              'question_revealed',
              jsonb_build_object(
                'chatId', v_chat.chat_id,
                'name', v_my_name,
                'message', 'revealed daily question answers with you.'
              )
            );
          end if;
        end if;
      end if;
    end if;
  end loop;
end; $$;

grant execute on function public.sync_question_reveals() to authenticated;

-- ---------- 1h) answer_daily_question(p_text) RPC ----------
create or replace function public.answer_daily_question(p_text text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
  v_q public.questions%rowtype;
  v_clean text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_clean := trim(coalesce(p_text, ''));
  if v_clean = '' then
    raise exception 'Answer cannot be empty';
  end if;

  v_q := public.question_of_the_day();
  if v_q.id is null then
    raise exception 'No active question found';
  end if;

  if exists (select 1 from public.daily_question_answers where user_id = v_uid and answer_day = v_today) then
    raise exception 'Already answered today';
  end if;

  insert into public.daily_question_answers (user_id, question_id, answer_day, text)
    values (v_uid, v_q.id, v_today, v_clean);

  -- Perform reveal sweep for caller
  perform public.sync_question_reveals();
end; $$;

grant execute on function public.answer_daily_question(text) to authenticated;

-- ---------- 1i) dismiss_daily_question(p_permanent) RPC ----------
create or replace function public.dismiss_daily_question(p_permanent boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.app_day();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(p_permanent, false) then
    insert into public.question_prefs (user_id, daily_enabled)
      values (v_uid, false)
      on conflict (user_id) do update set daily_enabled = false;
  else
    insert into public.question_prefs (user_id, last_dismissed_day)
      values (v_uid, v_today)
      on conflict (user_id) do update set last_dismissed_day = v_today;
  end if;
end; $$;

grant execute on function public.dismiss_daily_question(boolean) to authenticated;

-- ---------- 1j) Spontaneous questions ----------
create table if not exists public.spontaneous_questions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  asker_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  question_text text not null,
  asker_answer text not null,
  recipient_answer text,
  status text not null default 'pending' check (status in ('pending','revealed','expired')),
  expires_at timestamptz not null default now() + interval '48 hours',
  created_at timestamptz not null default now(),
  check (asker_id <> recipient_id)
);

alter table public.spontaneous_questions enable row level security;

drop policy if exists "spontaneous: asker select" on public.spontaneous_questions;
create policy "spontaneous: asker select"
  on public.spontaneous_questions for select to authenticated
  using (auth.uid() = asker_id);

create or replace function public.get_pending_question_for_chat(p_chat_id uuid)
returns table (
  id uuid,
  chat_id uuid,
  asker_id uuid,
  asker_name text,
  asker_avatar text,
  question_text text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    sq.id,
    sq.chat_id,
    sq.asker_id,
    p.name as asker_name,
    coalesce(p.avatar_url, '') as asker_avatar,
    sq.question_text,
    sq.status,
    sq.expires_at,
    sq.created_at
  from public.spontaneous_questions sq
  join public.profiles p on p.id = sq.asker_id
  where sq.chat_id = p_chat_id
    and sq.recipient_id = v_uid
    and sq.status = 'pending'
    and sq.expires_at > now()
  order by sq.created_at desc
  limit 1;
end; $$;

grant execute on function public.get_pending_question_for_chat(uuid) to authenticated;

create or replace function public.ask_spontaneous_question(
  p_chat_id uuid,
  p_question text,
  p_my_answer text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_recipient_id uuid;
  v_q_clean text;
  v_a_clean text;
  v_chat_type text;
  v_sq_id uuid;
  v_asker_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_q_clean := trim(coalesce(p_question, ''));
  v_a_clean := trim(coalesce(p_my_answer, ''));
  if v_q_clean = '' or v_a_clean = '' then
    raise exception 'Question and answer are both required';
  end if;

  select type into v_chat_type from public.chats where id = p_chat_id;
  if v_chat_type <> 'dm' or v_chat_type is null then
    raise exception 'Spontaneous questions can only be sent in 1-on-1 chats';
  end if;

  select user_id into v_recipient_id from public.chat_members
    where chat_id = p_chat_id and user_id <> v_uid limit 1;
  if v_recipient_id is null then
    raise exception 'Recipient not found in chat';
  end if;

  if exists (
    select 1 from public.spontaneous_questions
    where chat_id = p_chat_id and status = 'pending' and expires_at > now()
  ) then
    raise exception 'A pending question already exists in this chat';
  end if;

  insert into public.spontaneous_questions (
    chat_id, asker_id, recipient_id, question_text, asker_answer
  ) values (
    p_chat_id, v_uid, v_recipient_id, v_q_clean, v_a_clean
  ) returning id into v_sq_id;

  select name into v_asker_name from public.profiles where id = v_uid;

  perform public.enqueue_notification(
    v_recipient_id,
    'spontaneous_question',
    jsonb_build_object(
      'chatId', p_chat_id,
      'name', v_asker_name,
      'message', 'asked you a question.'
    )
  );

  return v_sq_id;
end; $$;

grant execute on function public.ask_spontaneous_question(uuid, text, text) to authenticated;

create or replace function public.answer_spontaneous_question(
  p_id uuid,
  p_text text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sq public.spontaneous_questions%rowtype;
  v_clean text;
  v_asker_name text;
  v_recipient_name text;
  v_payload jsonb;
  v_msg_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_clean := trim(coalesce(p_text, ''));
  if v_clean = '' then
    raise exception 'Answer cannot be empty';
  end if;

  select * into v_sq from public.spontaneous_questions
    where id = p_id for update;
  if not found then
    raise exception 'Question not found';
  end if;

  if v_sq.recipient_id <> v_uid then
    raise exception 'Only the recipient can answer this question';
  end if;

  if v_sq.status <> 'pending' then
    raise exception 'Question is no longer pending';
  end if;

  if v_sq.expires_at <= now() then
    raise exception 'Question has expired';
  end if;

  update public.spontaneous_questions
     set recipient_answer = v_clean,
         status = 'revealed'
   where id = p_id;

  select name into v_asker_name from public.profiles where id = v_sq.asker_id;
  select name into v_recipient_name from public.profiles where id = v_uid;

  v_payload := jsonb_build_object(
    'variant', 'spontaneous',
    'questionText', v_sq.question_text,
    'answers', jsonb_build_array(
      jsonb_build_object('userId', v_sq.asker_id, 'name', v_asker_name, 'text', v_sq.asker_answer),
      jsonb_build_object('userId', v_uid, 'name', v_recipient_name, 'text', v_clean)
    )
  );

  insert into public.messages (chat_id, sender_id, text, kind, payload)
    values (v_sq.chat_id, v_uid, v_sq.question_text, 'question', v_payload)
    returning id into v_msg_id;

  perform public.enqueue_notification(
    v_sq.asker_id,
    'spontaneous_question_answered',
    jsonb_build_object(
      'chatId', v_sq.chat_id,
      'name', v_recipient_name,
      'message', 'answered your question.'
    )
  );
end; $$;

grant execute on function public.answer_spontaneous_question(uuid, text) to authenticated;

-- ---------- Part 2 Helper & Trigger: Auto-create DM on connection accept ----------
create or replace function public.ensure_dm_chat(p_user_1 uuid, p_user_2 uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_chat_id uuid;
begin
  if p_user_1 is null or p_user_2 is null or p_user_1 = p_user_2 then
    return null;
  end if;

  select cm1.chat_id into v_chat_id
    from public.chat_members cm1
    join public.chat_members cm2 on cm2.chat_id = cm1.chat_id
    join public.chats c on c.id = cm1.chat_id
    where cm1.user_id = p_user_1
      and cm2.user_id = p_user_2
      and c.type = 'dm'
    limit 1;

  if v_chat_id is not null then
    return v_chat_id;
  end if;

  insert into public.chats (type, name)
    values ('dm', null)
    returning id into v_chat_id;

  insert into public.chat_members (chat_id, user_id)
    values (v_chat_id, p_user_1), (v_chat_id, p_user_2);

  return v_chat_id;
end;
$$;

grant execute on function public.ensure_dm_chat(uuid, uuid) to authenticated;

create or replace function public.start_dm(p_peer_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if auth.uid() = p_peer_id then
    raise exception 'Cannot DM yourself';
  end if;
  return public.ensure_dm_chat(auth.uid(), p_peer_id);
end;
$$;

grant execute on function public.start_dm(uuid) to authenticated;

create or replace function public.materialize_connection_on_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'accepted') or (tg_op = 'UPDATE' and new.status = 'accepted' and (old.status is null or old.status <> 'accepted')) then
    insert into public.connections (user_id, connected_user_id)
      values (new.requester_id, new.recipient_id)
      on conflict do nothing;
    insert into public.connections (user_id, connected_user_id)
      values (new.recipient_id, new.requester_id)
      on conflict do nothing;

    perform public.ensure_dm_chat(new.requester_id, new.recipient_id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_materialize_connection on public.connection_requests;
create trigger trg_materialize_connection
  after insert or update on public.connection_requests
  for each row execute procedure public.materialize_connection_on_accept();
