create or replace function public.approve_application(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_circle_id uuid;
  v_applicant_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  select a.circle_id, a.applicant_id
    into v_circle_id, v_applicant_id
  from public.applications a
  where a.id = p_application_id;

  if v_circle_id is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1
    from public.circles c
    where c.id = v_circle_id
      and c.organizer_id = v_uid
  ) then
    raise exception 'Not authorized';
  end if;

  update public.applications
  set status = 'approved', reviewed_at = now()
  where id = p_application_id;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle_id, v_applicant_id, 'member')
  on conflict (circle_id, user_id) do nothing;
end;
$$;

create or replace function public.decline_application(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_circle_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  select a.circle_id into v_circle_id
  from public.applications a
  where a.id = p_application_id;

  if v_circle_id is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1
    from public.circles c
    where c.id = v_circle_id
      and c.organizer_id = v_uid
  ) then
    raise exception 'Not authorized';
  end if;

  update public.applications
  set status = 'declined', reviewed_at = now()
  where id = p_application_id;
end;
$$;

grant execute on function public.approve_application(uuid) to authenticated;
grant execute on function public.decline_application(uuid) to authenticated;
