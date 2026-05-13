-- =============================================================================
-- THIRD SPACE — Connections integrity hardening
-- =============================================================================
-- The original initial_schema gave authenticated clients an open INSERT policy
-- on public.connections, allowing direct row creation without going through the
-- connection_request accept handshake. This caused non-connected users to leak
-- into the connections list. Both legitimate creation paths (the materialize
-- trigger on accept, and redeem_invite) run as SECURITY DEFINER and bypass RLS,
-- so dropping the client INSERT policy doesn't affect them.
--
-- This migration:
--   1. Drops the open INSERT policy on connections.
--   2. Deletes any existing orphan rows (no matching accepted connection_request).
-- =============================================================================

-- 1) Close the hole
drop policy if exists "user creates own connection" on public.connections;

-- 2) Clean up orphans. Both legitimate paths produce an accepted
--    connection_request before the connection row, so its absence means the
--    connection was inserted via the now-removed open policy.
delete from public.connections c
where not exists (
  select 1
  from public.connection_requests cr
  where cr.status = 'accepted'
    and (
      (cr.requester_id = c.user_id        and cr.recipient_id = c.connected_user_id)
       or
      (cr.requester_id = c.connected_user_id and cr.recipient_id = c.user_id)
    )
);

-- Confirm count for the migration log (Supabase will display the row count).
-- After this runs, every row in public.connections has a verifiable handshake.
