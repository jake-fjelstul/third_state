-- 073: Daily push for the question of the day.
--
-- Once a day, around 10 AM in each person's own time zone, send a push with
-- today's question. Nobody gets it who:
--   * turned daily questions off (question_prefs.daily_enabled = false)
--   * turned this reminder off (profiles.notification_prefs.daily_question = false)
--   * already answered or dismissed today's question
--   * has no 1:1 chat to answer it in, or no device registered for push
-- This is a push only; it does not add a row to the in-app notification list.

alter table public.question_prefs
  add column if not exists last_push_day date;

create or replace function public.emit_daily_question_pushes()
returns integer
language plpgsql
security definer set search_path = public, net, vault
as $$
declare
  v_url    text;
  v_secret text;
  v_q      public.questions%rowtype;
  v_today  date := public.app_day();
  v_count  integer := 0;
  r        record;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then
    return 0;
  end if;

  v_q := public.question_of_the_day();
  if v_q.id is null then
    return 0;
  end if;

  for r in
    select p.id as user_id,
           (select cm.chat_id
              from public.chat_members cm
              join public.chats c on c.id = cm.chat_id and c.type = 'dm'
             where cm.user_id = p.id and cm.hidden_at is null
             order by coalesce(cm.last_read_at, cm.joined_at) desc
             limit 1) as chat_id
      from public.profiles p
      left join public.question_prefs qp on qp.user_id = p.id
     where extract(hour from (now() at time zone coalesce(nullif(p.timezone, ''), 'America/Chicago'))) = 10
       and coalesce(qp.daily_enabled, true)
       and coalesce((p.notification_prefs->>'daily_question')::boolean, true)
       and (qp.last_push_day is null or qp.last_push_day < v_today)
       and (qp.last_dismissed_day is null or qp.last_dismissed_day < v_today)
       and not exists (select 1 from public.daily_question_answers a
                        where a.user_id = p.id and a.answer_day = v_today)
       and exists (select 1 from public.device_tokens d where d.user_id = p.id)
  loop
    continue when r.chat_id is null;

    insert into public.question_prefs (user_id, last_push_day)
    values (r.user_id, v_today)
    on conflict (user_id) do update set last_push_day = excluded.last_push_day;

    begin
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret),
        body    := jsonb_build_object(
          'userId',   r.user_id,
          'title',    'Question of the day',
          'body',     v_q.text,
          'threadId', 'daily_question',
          'data',     jsonb_build_object('type', 'daily_question', 'chatId', r.chat_id)
        )
      );
      v_count := v_count + 1;
    exception when others then
      raise warning '[emit_daily_question_pushes] failed for %: %', r.user_id, sqlerrm;
    end;
  end loop;

  return v_count;
end; $$;

revoke execute on function public.emit_daily_question_pushes() from public, anon, authenticated;
grant execute on function public.emit_daily_question_pushes() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'emit-daily-question-pushes-hourly') then
    perform cron.unschedule('emit-daily-question-pushes-hourly');
  end if;
end $$;

-- Hourly on the hour; the function only picks people for whom it is 10 AM.
select cron.schedule(
  'emit-daily-question-pushes-hourly',
  '0 * * * *',
  $cron$ select public.emit_daily_question_pushes(); $cron$
);
