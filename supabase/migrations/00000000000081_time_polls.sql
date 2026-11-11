-- 081: "When works?" time polls (plan-2026-11-10.md, Part 4 §4.4).
--
-- Sent from the iMessage app (or shared as third-space-app.com/p/<id>):
-- a title, an optional place and 2-4 times. People vote on every time that
-- works; the host turns the winner into a real event, which RSVPs everyone
-- who picked that time. Reads and writes go through the functions below.

create table if not exists public.time_polls (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  place       text check (place is null or char_length(place) <= 120),
  options     timestamptz[] not null check (array_length(options, 1) between 2 and 4),
  event_id    uuid references public.events(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_time_polls_creator on public.time_polls (created_by);

create table if not exists public.time_poll_votes (
  poll_id      uuid not null references public.time_polls(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  option_index int not null check (option_index between 0 and 3),
  created_at   timestamptz not null default now(),
  primary key (poll_id, user_id, option_index)
);

alter table public.time_polls enable row level security;
alter table public.time_poll_votes enable row level security;
-- No policies: the poll id in the link is the key; everything below checks it.

create or replace function public.create_time_poll(p_title text, p_options timestamptz[], p_place text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_opts timestamptz[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select array_agg(distinct o order by o) into v_opts from unnest(p_options) o where o > now() - interval '1 hour';
  if coalesce(array_length(v_opts, 1), 0) < 2 then raise exception 'Pick at least two times'; end if;
  if array_length(v_opts, 1) > 4 then raise exception 'Up to four times'; end if;
  insert into public.time_polls (created_by, title, place, options)
  values (auth.uid(), btrim(p_title), nullif(btrim(coalesce(p_place, '')), ''), v_opts)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.create_time_poll(text, timestamptz[], text) from public, anon;
grant execute on function public.create_time_poll(text, timestamptz[], text) to authenticated;

-- Vote for (p_on = true) or against one time. Returns the poll.
create or replace function public.vote_time_poll(p_poll_id uuid, p_option_index int, p_on boolean default true)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_poll public.time_polls%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_poll from public.time_polls where id = p_poll_id;
  if not found then raise exception 'Poll not found'; end if;
  if v_poll.event_id is not null then raise exception 'This plan is already set'; end if;
  if p_option_index < 0 or p_option_index >= array_length(v_poll.options, 1) then raise exception 'Bad option'; end if;
  if public.is_blocked_with(v_poll.created_by) then raise exception 'Poll not available'; end if;
  if p_on then
    insert into public.time_poll_votes (poll_id, user_id, option_index)
    values (p_poll_id, auth.uid(), p_option_index) on conflict do nothing;
  else
    delete from public.time_poll_votes
     where poll_id = p_poll_id and user_id = auth.uid() and option_index = p_option_index;
  end if;
  return public.get_time_poll(p_poll_id);
end; $$;
revoke execute on function public.vote_time_poll(uuid, int, boolean) from public, anon;
grant execute on function public.vote_time_poll(uuid, int, boolean) to authenticated;

-- The full poll for a signed-in viewer: counts, first names, my votes.
create or replace function public.get_time_poll(p_id uuid)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'place', p.place,
    'eventId', p.event_id,
    'mine', p.created_by = auth.uid(),
    'hostFirstName', split_part(coalesce(h.name, ''), ' ', 1),
    'voters', (select count(distinct v.user_id) from public.time_poll_votes v where v.poll_id = p.id),
    'options', (
      select jsonb_agg(jsonb_build_object(
        'index', o.i - 1,
        'at', o.t,
        'count', (select count(*) from public.time_poll_votes v where v.poll_id = p.id and v.option_index = o.i - 1),
        'mine', exists (select 1 from public.time_poll_votes v where v.poll_id = p.id and v.option_index = o.i - 1 and v.user_id = auth.uid()),
        'names', coalesce((select jsonb_agg(split_part(coalesce(pr.name, ''), ' ', 1) order by v.created_at)
                             from public.time_poll_votes v join public.profiles pr on pr.id = v.user_id
                            where v.poll_id = p.id and v.option_index = o.i - 1
                              and not public.is_blocked_with(v.user_id)), '[]'::jsonb)
      ) order by o.i)
      from unnest(p.options) with ordinality as o(t, i)
    )
  )
  from public.time_polls p
  join public.profiles h on h.id = p.created_by
  where p.id = p_id
    and auth.uid() is not null
    and not public.is_blocked_with(p.created_by);
$$;
revoke execute on function public.get_time_poll(uuid) from public, anon;
grant execute on function public.get_time_poll(uuid) to authenticated;

-- Link preview (signed out): title, place, times and counts; no names.
create or replace function public.public_time_poll_card(p_id uuid)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'place', p.place,
    'set', p.event_id is not null,
    'hostFirstName', split_part(coalesce(h.name, ''), ' ', 1),
    'options', (
      select jsonb_agg(jsonb_build_object(
        'at', o.t,
        'count', (select count(*) from public.time_poll_votes v where v.poll_id = p.id and v.option_index = o.i - 1)
      ) order by o.i)
      from unnest(p.options) with ordinality as o(t, i)
    )
  )
  from public.time_polls p
  join public.profiles h on h.id = p.created_by
  where p.id = p_id;
$$;
revoke execute on function public.public_time_poll_card(uuid) from public;
grant execute on function public.public_time_poll_card(uuid) to anon, authenticated;

-- Host only: make the chosen time a real event and RSVP everyone who
-- picked it. Returns the event id (the same one if called twice).
create or replace function public.make_event_from_poll(p_poll_id uuid, p_option_index int)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_poll public.time_polls%rowtype;
  v_event uuid;
  v_name text;
  v_voter uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_poll from public.time_polls where id = p_poll_id for update;
  if not found then raise exception 'Poll not found'; end if;
  if v_poll.created_by <> auth.uid() then raise exception 'Only the person who asked can set the time'; end if;
  if v_poll.event_id is not null then return v_poll.event_id; end if;
  if p_option_index < 0 or p_option_index >= array_length(v_poll.options, 1) then raise exception 'Bad option'; end if;

  insert into public.events (title, starts_at, ends_at, location, created_by)
  values (v_poll.title, v_poll.options[p_option_index + 1], v_poll.options[p_option_index + 1] + interval '90 minutes',
          v_poll.place, auth.uid())
  returning id into v_event;

  insert into public.event_attendees (event_id, user_id) values (v_event, auth.uid()) on conflict do nothing;

  select name into v_name from public.profiles where id = auth.uid();
  for v_voter in
    select distinct user_id from public.time_poll_votes
     where poll_id = p_poll_id and option_index = p_option_index and user_id <> auth.uid()
  loop
    insert into public.event_attendees (event_id, user_id) values (v_event, v_voter) on conflict do nothing;
    perform public.enqueue_notification(
      v_voter, 'poll_set',
      jsonb_build_object(
        'event', jsonb_build_object('id', v_event, 'title', v_poll.title, 'startsAt', v_poll.options[p_option_index + 1],
                                    'location', coalesce(v_poll.place, '')),
        'eventId', v_event,
        'message', v_poll.title || ' is on. ' || coalesce(nullif(split_part(v_name, ' ', 1), ''), 'Your friend')
                   || ' picked a time you said works, so you''re going.'));
  end loop;

  update public.time_polls set event_id = v_event where id = p_poll_id;
  return v_event;
end; $$;
revoke execute on function public.make_event_from_poll(uuid, int) from public, anon;
grant execute on function public.make_event_from_poll(uuid, int) to authenticated;

-- Push wording for the new notification type.
create or replace function public.push_title_for(p_type text)
returns text language sql immutable as $$
  select case p_type
    when 'connection_request'            then 'New connection request'
    when 'connection_accepted'           then 'Connection accepted'
    when 'event_approaching'             then 'Event tomorrow'
    when 'reconnect_nudge'               then 'Reconnect'
    when 'circle_activity'               then 'New message'
    when 'application_approved'          then 'Application approved'
    when 'application_declined'          then 'Application update'
    when 'lfg_post'                      then 'Out now'
    when 'lfg_join'                      then 'Someone joined'
    when 'pull_up'                       then 'Pulling up'
    when 'checkin_note'                  then 'Table note'
    when 'poll_set'                      then 'It''s on'
    when 'poll_created'                  then 'New poll'
    when 'question_revealed'             then 'Answers revealed'
    when 'spontaneous_question'          then 'New question'
    when 'spontaneous_question_answered' then 'Question answered'
    when 'circle_invite'                 then 'Circle invite'
    when 'event_reaction'                then 'New reaction'
    when 'plan_tipped'                   then 'It''s on'
    else 'Third Space'
  end;
$$;

create or replace function public.push_body_for(p_type text, p_payload jsonb)
returns text language sql immutable as $$
  select case
    when p_type in ('lfg_post', 'lfg_join', 'poll_created', 'pull_up', 'checkin_note', 'poll_set')
      then coalesce(p_payload->>'message', 'Tap to open')
    else btrim(
      coalesce(p_payload->>'name', p_payload->'user'->>'name', '')
      || ' ' || coalesce(p_payload->>'message', '')
    )
  end;
$$;
