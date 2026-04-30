create or replace function public.adjust_battery(p_points int, p_reason text default null)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_next int;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set battery_points = greatest(0, least(100, coalesce(battery_points, 0) + coalesce(p_points, 0))),
      updated_at = now()
  where id = v_uid
  returning battery_points into v_next;

  if v_next is null then
    raise exception 'Profile not found';
  end if;

  insert into public.battery_history (user_id, points, reason, result)
  values (v_uid, coalesce(p_points, 0), p_reason, v_next);

  return v_next;
end;
$$;

grant execute on function public.adjust_battery(int, text) to authenticated;
