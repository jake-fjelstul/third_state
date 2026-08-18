-- =============================================================================
-- Migration: Nudge once per hangout period instead of every seven days
-- =============================================================================

-- 1. Add last_nudged_at to public.connections
alter table public.connections
  add column if not exists last_nudged_at timestamptz;

-- 2. CREATE OR REPLACE emit_reconnect_nudges with once-per-hangout semantics
create or replace function public.emit_reconnect_nudges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_target record;
begin
  for rec in
    select c.user_id, c.connected_user_id, c.last_hangout, p.reconnect_threshold_days
    from public.connections c
    join public.profiles p on p.id = c.user_id
    where c.last_hangout is not null
      and c.last_hangout < (now() - make_interval(days => coalesce(p.reconnect_threshold_days, 21)))
      and (c.last_nudged_at is null or c.last_nudged_at < c.last_hangout)
  loop
    select id, name, avatar_url into v_target
    from public.profiles
    where id = rec.connected_user_id;

    perform public.enqueue_notification(
      rec.user_id,
      'reconnect_nudge',
      jsonb_build_object(
        'targetId', v_target.id,
        'user', jsonb_build_object('id', v_target.id, 'name', v_target.name, 'avatar', coalesce(v_target.avatar_url, '')),
        'message', format(
          'You haven''t hung out with %s in a while. Reach out to reconnect!',
          split_part(v_target.name, ' ', 1)
        ),
        'suggestions', jsonb_build_array(
          'Hey! Long time no see!',
          'Are you free for coffee sometime next week?',
          'It''s been a minute! How have you been?'
        )
      )
    );

    update public.connections
    set last_nudged_at = now()
    where user_id = rec.user_id
      and connected_user_id = rec.connected_user_id;
  end loop;
end;
$$;
