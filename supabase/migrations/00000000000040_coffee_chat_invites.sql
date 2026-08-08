-- =============================================================================
-- Migration: Coffee chat invite message payload update helper RPC
-- =============================================================================

create or replace function public.update_message_payload(p_message_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chat_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select chat_id into v_chat_id from public.messages where id = p_message_id;
  if not found then raise exception 'Message not found'; end if;

  if not exists (
    select 1 from public.chat_members where chat_id = v_chat_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this chat';
  end if;

  update public.messages set payload = p_payload where id = p_message_id;
end; $$;

grant execute on function public.update_message_payload(uuid, jsonb) to authenticated;
