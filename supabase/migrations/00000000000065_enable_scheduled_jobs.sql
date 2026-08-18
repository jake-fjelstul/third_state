-- =============================================================================
-- Migration: Enable pg_cron extension and schedule background jobs
-- =============================================================================

create extension if not exists pg_cron;

-- Idempotently unschedule existing jobs if present
do $$
begin
  if exists (select 1 from cron.job where jobname = 'promote-elapsed-coffee-attendance-daily') then
    perform cron.unschedule('promote-elapsed-coffee-attendance-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'emit-reconnect-nudges-daily') then
    perform cron.unschedule('emit-reconnect-nudges-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'emit-event-reminders-hourly') then
    perform cron.unschedule('emit-event-reminders-hourly');
  end if;
end $$;

-- Order matters: coffee promotion writes last_hangout, so it must run before nudges evaluate.
select cron.schedule(
  'promote-elapsed-coffee-attendance-daily',
  '30 13 * * *',  -- 13:30 UTC daily (before 14:00 UTC nudge job)
  $cron$ select public.promote_elapsed_coffee_attendance(); $cron$
);

select cron.schedule(
  'emit-reconnect-nudges-daily',
  '0 14 * * *',  -- 14:00 UTC daily (~9am Central)
  $cron$ select public.emit_reconnect_nudges(); $cron$
);

select cron.schedule(
  'emit-event-reminders-hourly',
  '15 * * * *',  -- every hour at :15
  $cron$ select public.emit_event_reminders(); $cron$
);
