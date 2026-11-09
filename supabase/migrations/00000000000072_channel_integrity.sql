-- 072: A message or poll's channel must belong to its chat (audit L4).
-- Covers create_chat_poll and direct message inserts alike.

create or replace function public.check_channel_belongs_to_chat()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.channel_id is not null and not exists (
    select 1 from public.chat_channels c
     where c.id = new.channel_id and c.chat_id = new.chat_id
  ) then
    raise exception 'Channel does not belong to this chat';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_channel_integrity on public.messages;
create trigger trg_messages_channel_integrity
  before insert or update of channel_id, chat_id on public.messages
  for each row execute function public.check_channel_belongs_to_chat();

drop trigger if exists trg_polls_channel_integrity on public.polls;
create trigger trg_polls_channel_integrity
  before insert or update of channel_id, chat_id on public.polls
  for each row execute function public.check_channel_belongs_to_chat();
