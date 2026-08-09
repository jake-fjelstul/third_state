-- Fix spontaneous questions RPC to return pending question for both asker and recipient,
-- and add cancel_spontaneous_question RPC.

drop function if exists public.get_pending_question_for_chat(uuid);

create or replace function public.get_pending_question_for_chat(p_chat_id uuid)
returns table (
  id uuid,
  chat_id uuid,
  asker_id uuid,
  asker_name text,
  asker_avatar text,
  recipient_id uuid,
  recipient_name text,
  recipient_avatar text,
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
    p_asker.name as asker_name,
    coalesce(p_asker.avatar_url, '') as asker_avatar,
    sq.recipient_id,
    p_rec.name as recipient_name,
    coalesce(p_rec.avatar_url, '') as recipient_avatar,
    sq.question_text,
    sq.status,
    sq.expires_at,
    sq.created_at
  from public.spontaneous_questions sq
  join public.profiles p_asker on p_asker.id = sq.asker_id
  join public.profiles p_rec on p_rec.id = sq.recipient_id
  where sq.chat_id = p_chat_id
    and (sq.recipient_id = v_uid or sq.asker_id = v_uid)
    and sq.status = 'pending'
    and sq.expires_at > now()
  order by sq.created_at desc
  limit 1;
end; $$;

grant execute on function public.get_pending_question_for_chat(uuid) to authenticated;

drop function if exists public.cancel_spontaneous_question(uuid);

create or replace function public.cancel_spontaneous_question(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sq public.spontaneous_questions%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sq from public.spontaneous_questions where id = p_id;
  if not found then
    raise exception 'Question not found';
  end if;

  if v_sq.asker_id <> v_uid then
    raise exception 'Only the asker can cancel this question';
  end if;

  if v_sq.status <> 'pending' then
    raise exception 'Only pending questions can be cancelled';
  end if;

  update public.spontaneous_questions
     set status = 'expired'
   where id = p_id;
end; $$;

grant execute on function public.cancel_spontaneous_question(uuid) to authenticated;
