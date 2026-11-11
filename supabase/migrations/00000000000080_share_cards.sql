-- 080: Smart links (plan-2026-11-10.md, Part 4 Layer A).
--
-- Shared links (third-space-app.com/e/<event>, /s/<check-in>) need a preview
-- that works signed out: link previews in Messages, Slack, etc. are fetched
-- by a server with no account. These functions return only what a preview
-- card shows, and only for things that are meant to be public.

-- Hosts can turn off public previews for an event.
alter table public.events add column if not exists share_enabled boolean not null default true;

-- An event card: open circles and community events only (the same events
-- anyone could already see in the app). Private-circle events and 1:1 coffee
-- chats return null.
create or replace function public.public_event_card(p_id uuid)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
           'id', e.id,
           'title', e.title,
           'startsAt', e.starts_at,
           'endsAt', e.ends_at,
           'location', e.location,
           'coverImageUrl', e.cover_image_url,
           'circleName', c.name,
           'hostFirstName', split_part(coalesce(p.name, ''), ' ', 1),
           'going', (select count(*) from public.event_attendees a where a.event_id = e.id)
         )
    from public.events e
    left join public.circles c on c.id = e.circle_id
    left join public.profiles p on p.id = e.created_by
   where e.id = p_id
     and e.share_enabled
     and coalesce(e.source, '') <> 'coffee'   -- 1:1 coffee chats stay private
     and (e.circle_id is null or c.type = 'open');
$$;
revoke execute on function public.public_event_card(uuid) from public;
grant execute on function public.public_event_card(uuid) to anon, authenticated;

-- A check-in card. Live posts shared with everyone show where and what;
-- anything narrower only says that a friend is out (no place, no name).
create or replace function public.public_checkin_card(p_id uuid)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select case
    when p.visibility = 'everyone' then jsonb_build_object(
      'id', p.id,
      'live', true,
      'public', true,
      'activity', p.activity,
      'category', p.category,
      'placeName', p.place_name,
      'expiresAt', p.expires_at,
      'hostFirstName', split_part(coalesce(pr.name, ''), ' ', 1),
      'people', 1 + (select count(*) from public.lfg_joins j where j.post_id = p.id)
    )
    else jsonb_build_object('id', p.id, 'live', true, 'public', false)
  end
    from public.lfg_posts p
    join public.profiles pr on pr.id = p.user_id
   where p.id = p_id
     and p.ended_at is null
     and p.expires_at > now();
$$;
revoke execute on function public.public_checkin_card(uuid) from public;
grant execute on function public.public_checkin_card(uuid) to anon, authenticated;
