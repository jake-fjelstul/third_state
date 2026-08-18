-- ---------------------------------------------------------------------------
-- 1. Trigger function for event reaction notifications
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_event_reaction()
returns trigger
language plpgsql
security definer set search_path to 'public'
as $$
declare
  v_sender_name text;
begin
  if new.target_user_id is null or new.target_user_id = new.user_id then
    return new;
  end if;

  select name into v_sender_name
    from public.profiles
   where id = new.user_id;

  if v_sender_name is null or btrim(v_sender_name) = '' then
    v_sender_name := 'Someone';
  end if;

  begin
    perform public.enqueue_notification(
      new.target_user_id,
      'circle_activity',
      jsonb_build_object(
        'message', v_sender_name || ' reacted ' || new.emoji || ' to your event presence!',
        'eventId', new.event_id,
        'senderId', new.user_id,
        'emoji', new.emoji
      )
    );
  exception when others then
    raise warning '[notify_on_event_reaction] failed for reaction %: %', new.id, sqlerrm;
  end;

  return new;
end; $$;

-- ---------------------------------------------------------------------------
-- 2. Trigger on public.event_reactions
-- ---------------------------------------------------------------------------
drop trigger if exists trg_notify_on_event_reaction on public.event_reactions;

create trigger trg_notify_on_event_reaction
  after insert on public.event_reactions
  for each row execute function public.notify_on_event_reaction();

-- ---------------------------------------------------------------------------
-- 3. Drop notification insert policy
-- ---------------------------------------------------------------------------
drop policy if exists "system inserts notifications" on public.notifications;

-- ---------------------------------------------------------------------------
-- 4. Restrict enqueue_notification execution
-- ---------------------------------------------------------------------------
revoke execute on function public.enqueue_notification(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_notification(uuid, text, jsonb) to service_role;
