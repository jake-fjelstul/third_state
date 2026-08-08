-- =============================================================================
-- Migration: Reusable & circle-scoped invite links
-- Extends public.invites to support QR codes, reusable links, and circle invites
-- =============================================================================

-- 1. New columns on public.invites
alter table public.invites
  add column if not exists code text unique,
  add column if not exists circle_id uuid references public.circles(id) on delete cascade,
  add column if not exists kind text not null default 'personal' check (kind in ('personal','circle')),
  add column if not exists is_reusable boolean not null default false,
  add column if not exists max_uses int,
  add column if not exists use_count int not null default 0,
  add column if not exists label text;

-- 2. Indexes
create unique index if not exists idx_invites_code_partial on public.invites(code) where code is not null;
create index if not exists idx_invites_circle_id on public.invites(circle_id);

-- 3. Helper function to generate an 8-character code from unambiguous alphabet
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_chars text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_len int := char_length(v_chars);
  v_code text;
  v_exists boolean;
  i int;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_chars, floor(random() * v_len + 1)::int, 1);
    end loop;

    select exists(select 1 from public.invites where code = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end;
$$;

-- 4. RPC to create or return reusable circle invite link
create or replace function public.create_circle_invite_link(
  p_circle_id uuid,
  p_label text default null
)
returns public.invites
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_is_organizer boolean;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1 from public.circles c
    where c.id = p_circle_id and c.organizer_id = v_uid
    union
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = v_uid and cm.role in ('organizer', 'host')
  ) into v_is_organizer;

  if not v_is_organizer then
    raise exception 'Only the organizer can create invite links';
  end if;

  select * into v_invite
  from public.invites
  where circle_id = p_circle_id
    and inviter_id = v_uid
    and kind = 'circle'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    return v_invite;
  end if;

  v_code := generate_invite_code();

  insert into public.invites (
    token, code, inviter_id, circle_id, kind, is_reusable, max_uses, expires_at, label
  ) values (
    gen_random_uuid()::text, v_code, v_uid, p_circle_id, 'circle', true, null, now() + interval '365 days', p_label
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.create_circle_invite_link(uuid, text) to authenticated;

-- 5. RPC to create or return reusable personal invite link
create or replace function public.create_personal_invite_link()
returns public.invites
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invites
  where inviter_id = v_uid
    and kind = 'personal'
    and circle_id is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    return v_invite;
  end if;

  v_code := generate_invite_code();

  insert into public.invites (
    token, code, inviter_id, circle_id, kind, is_reusable, max_uses, expires_at
  ) values (
    gen_random_uuid()::text, v_code, v_uid, null, 'personal', true, null, now() + interval '365 days'
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.create_personal_invite_link() to authenticated;

-- 6. RPC to redeem an invite by code
create or replace function public.redeem_invite_code(p_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_circle_name text := null;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from public.invites where code = p_code for update;
  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'Invite limit reached';
  end if;

  if v_invite.inviter_id = v_uid then
    return jsonb_build_object('ok', true, 'self', true, 'circle_id', v_invite.circle_id);
  end if;

  update public.invites
    set use_count = use_count + 1
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

  if v_invite.circle_id is not null then
    insert into public.circle_members (circle_id, user_id, role)
      values (v_invite.circle_id, v_uid, 'member')
      on conflict do nothing;

    select name into v_circle_name from public.circles where id = v_invite.circle_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'self', false,
    'inviter_id', v_invite.inviter_id,
    'circle_id', v_invite.circle_id,
    'circle_name', v_circle_name
  );
end;
$$;

grant execute on function public.redeem_invite_code(text) to authenticated;

-- 7. RLS policy for public read by code
drop policy if exists "invites: public reads by code" on public.invites;
create policy "invites: public reads by code"
  on public.invites for select to anon, authenticated
  using (code is not null and expires_at > now());

-- 8. Backfill existing rows
update public.invites set code = generate_invite_code() where code is null;
