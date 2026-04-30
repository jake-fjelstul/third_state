-- Invite links for low-cost invite flow (mailto/sms handoff).

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  recipient_contact text,
  consumed_by uuid references auth.users(id) on delete set null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

create index idx_invites_token on public.invites(token);
create index idx_invites_inviter on public.invites(inviter_id);

alter table public.invites enable row level security;

create policy "invites: inviter reads own"
  on public.invites for select to authenticated
  using (auth.uid() = inviter_id);

create policy "invites: inviter creates own"
  on public.invites for insert to authenticated
  with check (auth.uid() = inviter_id);

create or replace function public.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from public.invites where token = p_token for update;
  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.consumed_at is not null then
    if v_invite.consumed_by = v_uid then
      return v_invite.inviter_id;
    end if;
    raise exception 'Invite already used';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_invite.inviter_id = v_uid then
    raise exception 'Cannot redeem your own invite';
  end if;

  update public.invites
    set consumed_by = v_uid, consumed_at = now()
    where id = v_invite.id;

  insert into public.connection_requests (requester_id, recipient_id, status, responded_at)
    values (v_invite.inviter_id, v_uid, 'accepted', now())
    on conflict (requester_id, recipient_id)
    do update
      set status = 'accepted',
          responded_at = coalesce(public.connection_requests.responded_at, now());

  update public.connection_requests
    set status = 'accepted',
        responded_at = coalesce(responded_at, now())
    where requester_id = v_invite.inviter_id
      and recipient_id = v_uid
      and status <> 'accepted';

  insert into public.connections (user_id, connected_user_id)
    values (v_invite.inviter_id, v_uid)
    on conflict do nothing;

  insert into public.connections (user_id, connected_user_id)
    values (v_uid, v_invite.inviter_id)
    on conflict do nothing;

  return v_invite.inviter_id;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
