-- =============================================================================
-- THIRD SPACE — Disconnect RPC
-- =============================================================================
-- Removes a bidirectional connection AND the old connection_requests row so
-- the unique(requester_id, recipient_id) constraint doesn't block reconnecting
-- later.
-- =============================================================================

create or replace function public.disconnect_from(p_target_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_uid = p_target_id then raise exception 'Cannot disconnect from yourself'; end if;

  -- Remove both directional rows
  delete from public.connections
  where (user_id = v_uid and connected_user_id = p_target_id)
     or (user_id = p_target_id and connected_user_id = v_uid);

  -- Remove old connection_requests so reconnecting works clean.
  delete from public.connection_requests
  where (requester_id = v_uid and recipient_id = p_target_id)
     or (requester_id = p_target_id and recipient_id = v_uid);
end; $$;

grant execute on function public.disconnect_from(uuid) to authenticated;
