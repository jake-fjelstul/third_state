-- =============================================================================
-- Connection requests (pending state before a connection is mutual).
-- A separate table so addConnection() stays simple.
-- =============================================================================
create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

create index idx_connreq_recipient on public.connection_requests(recipient_id, status);

alter table public.connection_requests enable row level security;

create policy "users see requests they sent or received"
  on public.connection_requests for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "users send their own requests"
  on public.connection_requests for insert to authenticated
  with check (auth.uid() = requester_id);

create policy "recipient updates request status"
  on public.connection_requests for update to authenticated
  using (auth.uid() = recipient_id);

create policy "requester or recipient deletes"
  on public.connection_requests for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

-- =============================================================================
-- RLS: allow users to delete their own notifications.
-- (The initial schema only had select/update/insert.)
-- =============================================================================
create policy "user deletes own notifications"
  on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

-- =============================================================================
-- Helper: enqueue a notification.
-- =============================================================================
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_type text,
  p_payload jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, payload, is_read)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb), false)
  returning id into v_id;
  return v_id;
end;
$$;

-- =============================================================================
-- Trigger: new connection_request -> notification for recipient.
-- =============================================================================
create or replace function public.notify_on_connection_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_requester record;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select id, name, avatar_url into v_requester
      from public.profiles where id = new.requester_id;
    perform public.enqueue_notification(
      new.recipient_id,
      'connection_request',
      jsonb_build_object(
        'requestId', new.id,
        'user', jsonb_build_object(
          'id', v_requester.id,
          'name', v_requester.name,
          'avatar', coalesce(v_requester.avatar_url, '')
        ),
        'message', 'wants to connect with you.'
      )
    );
  elsif tg_op = 'UPDATE' and new.status <> old.status and new.status = 'accepted' then
    -- notify the requester that their request was accepted
    select id, name, avatar_url into v_requester
      from public.profiles where id = new.recipient_id;
    perform public.enqueue_notification(
      new.requester_id,
      'connection_accepted',
      jsonb_build_object(
        'user', jsonb_build_object(
          'id', v_requester.id,
          'name', v_requester.name,
          'avatar', coalesce(v_requester.avatar_url, '')
        ),
        'message', 'accepted your connection request.'
      )
    );
  end if;
  return new;
end; $$;

create trigger trg_notify_connection_request
  after insert or update on public.connection_requests
  for each row execute procedure public.notify_on_connection_request();

-- =============================================================================
-- Trigger: when a connection_request becomes accepted, write the actual
-- connection rows (both directions) so addConnection logic doesn't have to.
-- =============================================================================
create or replace function public.materialize_connection_on_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.connections (user_id, connected_user_id)
      values (new.requester_id, new.recipient_id)
      on conflict do nothing;
    insert into public.connections (user_id, connected_user_id)
      values (new.recipient_id, new.requester_id)
      on conflict do nothing;
  end if;
  return new;
end; $$;

create trigger trg_materialize_connection
  after update on public.connection_requests
  for each row execute procedure public.materialize_connection_on_accept();

-- =============================================================================
-- Trigger: application status -> notification for applicant.
-- =============================================================================
create or replace function public.notify_on_application_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_circle record;
begin
  if tg_op = 'UPDATE' and new.status <> old.status
     and new.status in ('approved','declined') then
    select id, name, emoji into v_circle
      from public.circles where id = new.circle_id;
    perform public.enqueue_notification(
      new.applicant_id,
      case when new.status = 'approved' then 'application_approved' else 'application_declined' end,
      jsonb_build_object(
        'circle', jsonb_build_object(
          'id', v_circle.id,
          'name', v_circle.name,
          'emoji', coalesce(v_circle.emoji, '')
        ),
        'message', case
          when new.status = 'approved' then format('Your application to %s was approved.', v_circle.name)
          else format('Your application to %s was declined.', v_circle.name)
        end
      )
    );
  end if;
  return new;
end; $$;

create trigger trg_notify_application_review
  after update on public.applications
  for each row execute procedure public.notify_on_application_review();

-- =============================================================================
-- Trigger: new circle message -> notification to other chat members,
-- but rate-limited to one circle_activity notification per chat per recipient
-- per hour to avoid floods.
-- =============================================================================
create or replace function public.notify_on_circle_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_chat record;
  v_circle record;
  v_sender record;
begin
  -- only group (circle) chats
  select c.* into v_chat from public.chats c where c.id = new.chat_id;
  if v_chat.type <> 'group' or v_chat.circle_id is null then
    return new;
  end if;

  select id, name, emoji into v_circle from public.circles where id = v_chat.circle_id;
  select id, name, avatar_url into v_sender from public.profiles where id = new.sender_id;

  -- rate limit: skip if we already inserted a circle_activity for this chat
  -- and recipient within the last hour
  insert into public.notifications (user_id, type, payload, is_read)
  select cm.user_id,
         'circle_activity',
         jsonb_build_object(
           'circle', jsonb_build_object('id', v_circle.id, 'name', v_circle.name, 'emoji', coalesce(v_circle.emoji,'')),
           'user',   jsonb_build_object('id', v_sender.id, 'name', v_sender.name, 'avatar', coalesce(v_sender.avatar_url,'')),
           'chatId', new.chat_id,
           'message', 'posted a new message.'
         ),
         false
    from public.chat_members cm
    where cm.chat_id = new.chat_id
      and cm.user_id <> new.sender_id
      and not exists (
        select 1 from public.notifications n
         where n.user_id = cm.user_id
           and n.type = 'circle_activity'
           and (n.payload->>'chatId')::uuid = new.chat_id
           and n.created_at > now() - interval '1 hour'
      );
  return new;
end; $$;

create trigger trg_notify_circle_message
  after insert on public.messages
  for each row execute procedure public.notify_on_circle_message();
