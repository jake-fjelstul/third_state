-- =============================================================================
-- THIRD SPACE — Battery drains for stale connections
-- =============================================================================
-- Every Monday at 9 AM UTC, drain a small amount from users who have stale
-- connections (connections where last_hangout — or created_at if never hung out —
-- has exceeded their reconnect_threshold_days). Drains 2 points per stale
-- connection, capped at 10. No drain if the user has zero stale connections.
-- Each drain writes a battery_history row so the UI can display it.
-- =============================================================================

create or replace function public.drain_battery_for_stale_connections()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  rec record;
  v_stale_count int;
  v_drain int;
  v_new_points int;
begin
  for rec in
    select p.id as user_id, coalesce(p.reconnect_threshold_days, 21) as threshold
    from public.profiles p
  loop
    select count(*) into v_stale_count
    from public.connections c
    where c.user_id = rec.user_id
      and (now() - coalesce(c.last_hangout, c.created_at))
          >= make_interval(days => rec.threshold);

    if v_stale_count > 0 then
      v_drain := least(v_stale_count * 2, 10);
      update public.profiles
         set battery_points = greatest(0, coalesce(battery_points, 0) - v_drain)
       where id = rec.user_id
      returning battery_points into v_new_points;

      insert into public.battery_history (user_id, points, reason, result)
      values (
        rec.user_id,
        -v_drain,
        v_stale_count || ' stale connection' || case when v_stale_count = 1 then '' else 's' end,
        v_new_points
      );
    end if;
  end loop;
end; $$;

-- Schedule weekly. Use try/except wrapper so re-running the migration is safe.
do $$
begin
  perform cron.schedule(
    'drain-battery-stale-connections',
    '0 9 * * 1',  -- Mondays 09:00 UTC
    $cron$select public.drain_battery_for_stale_connections();$cron$
  );
exception when others then
  -- Job may already exist or pg_cron name conflict — ignore.
  null;
end$$;

-- Optional convenience: a manual-trigger RPC for testing in Supabase SQL editor.
grant execute on function public.drain_battery_for_stale_connections() to authenticated;
