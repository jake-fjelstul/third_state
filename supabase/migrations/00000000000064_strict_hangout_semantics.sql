-- =============================================================================
-- Migration: Strict hangout semantics for emit_reconnect_nudges
-- Require last_hangout IS NOT NULL before emitting reconnect nudges.
-- =============================================================================

create or replace function public.emit_reconnect_nudges()
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_target record;
begin
  for rec in
    select c.user_id, c.connected_user_id, c.last_hangout, p.reconnect_threshold_days
    from public.connections c
    join public.profiles p on p.id = c.user_id
    where c.last_hangout is not null
      and (now() - c.last_hangout) >= make_interval(days => coalesce(p.reconnect_threshold_days, 21))
  loop
    -- skip if recent nudge exists
    if exists (
      select 1 from public.notifications n
      where n.user_id = rec.user_id
        and n.type = 'reconnect_nudge'
        and (n.payload->'user'->>'id')::uuid = rec.connected_user_id
        and n.created_at > now() - interval '7 days'
    ) then
      continue;
    end if;

    select id, name, avatar_url into v_target
      from public.profiles where id = rec.connected_user_id;

    perform public.enqueue_notification(
      rec.user_id,
      'reconnect_nudge',
      jsonb_build_object(
        'targetId', v_target.id,
        'user', jsonb_build_object('id', v_target.id, 'name', v_target.name, 'avatar', coalesce(v_target.avatar_url,'')),
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
  end loop;
end; $$;
