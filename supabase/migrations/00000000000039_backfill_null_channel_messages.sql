-- =============================================================================
-- THIRD SPACE — Backfill messages orphaned outside any channel
--
-- Group chats get four channels from a trigger (general, planning, photos,
-- meetups). ThreadView treated "no channel in the URL" as channel_id = null,
-- creating a bucket that no channel tab maps to. Those messages were
-- invisible from the channel views and vice versa. Move them to #general.
-- DMs legitimately have channel_id = null and are left alone.
-- =============================================================================

update public.messages m
set channel_id = cc.id
from public.chat_channels cc
join public.chats c on c.id = cc.chat_id
where cc.chat_id = m.chat_id
  and cc.name = 'general'
  and c.type <> 'dm'
  and m.channel_id is null;

update public.polls p
set channel_id = cc.id
from public.chat_channels cc
join public.chats c on c.id = cc.chat_id
where cc.chat_id = p.chat_id
  and cc.name = 'general'
  and c.type <> 'dm'
  and p.channel_id is null;
