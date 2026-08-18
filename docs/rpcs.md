# Database RPC & Edge Functions Reference — Third Space

Comprehensive specification of all public PostgreSQL Remote Procedure Calls (RPCs), security settings, migration histories, client JavaScript callers, function overloads, and Edge Functions.

---

## 1. Public Schema RPC Function Reference

All database functions reside in the `public` schema. Functions marked as `SECURITY DEFINER` run with creator privileges (bypassing table RLS policies internally), while `SECURITY INVOKER` functions execute with the privileges of the calling user.

| RPC Function Name | Security Mode | Search Path Set | Introduced | Last Modified | Primary Client Caller(s) | Signature Overload Flag |
| --- | --- | --- | --- | --- | --- | --- |
| `accept_coffee_invite` | `SECURITY DEFINER` | `SET search_path = public` | m41 | m41 | `CoffeeInviteMessageCard.jsx` | Clear |
| `adjust_battery` | `SECURITY DEFINER` | `SET search_path = public` | m17 | m17 | `AppContext.jsx` | Clear |
| `answer_daily_question` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | `src/lib/questions.js` | Clear |
| `answer_spontaneous_question` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | `src/lib/questions.js` | Clear |
| `apply_to_circle` | `SECURITY DEFINER` | `SET search_path = public` | m01 | m01 | `src/lib/circles.js` | Clear |
| `approve_application` | `SECURITY DEFINER` | `SET search_path = public` | m12 | m12 | `src/lib/circles.js` | Clear |
| `ask_spontaneous_question` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m49 | `src/lib/questions.js` | Clear |
| `block_user` | `SECURITY DEFINER` | `SET search_path = public` | m35 | m35 | `src/lib/moderation.js` | Clear |
| `cancel_spontaneous_question` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | `src/lib/questions.js` | Clear |
| `close_poll` | `SECURITY DEFINER` | `SET search_path = public` | m38 | m38 | `src/lib/polls.js` | Clear |
| `commit_game_move` | `SECURITY DEFINER` | `SET search_path = public` | m29 | m30 | `src/lib/games.js` | **FLAGGED OVERLOAD** |
| `create_chat_game` | `SECURITY DEFINER` | `SET search_path = public` | m29 | m29 | `src/lib/games.js` | Clear |
| `create_chat_poll` | `SECURITY DEFINER` | `SET search_path = public` | m38 | m38 | `src/lib/polls.js` | Clear |
| `create_lfg_post` | `SECURITY DEFINER` | `SET search_path = public` | m52 | m57 | `src/lib/lfg.js` | **FLAGGED OVERLOAD** |
| `decline_application` | `SECURITY DEFINER` | `SET search_path = public` | m12 | m12 | `src/lib/circles.js` | Clear |
| `delete_my_account` | `SECURITY DEFINER` | `SET search_path = public` | m36 | m36 | `src/lib/auth.js` | Clear |
| `disconnect_calendar` | `SECURITY DEFINER` | `SET search_path = public` | m46 | m46 | `src/lib/calendar.js` | Clear |
| `disconnect_from` | `SECURITY DEFINER` | `SET search_path = public` | m31 | m31 | `src/lib/connections.js` | Clear |
| `dismiss_daily_question` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | `src/lib/questions.js` | Clear |
| `drain_battery_for_stale_connections` | `SECURITY DEFINER` | `SET search_path = public` | m32 | m32 | NO CALLER FOUND (Scheduled) | Clear |
| `emit_event_reminders` | `SECURITY DEFINER` | `SET search_path = public` | m08 | m08 | NO CALLER FOUND (Scheduled) | Clear |
| `emit_reconnect_nudges` | `SECURITY DEFINER` | `SET search_path = public` | m08 | m27 | NO CALLER FOUND (Scheduled) | Clear |
| `enqueue_notification` | `SECURITY DEFINER` | `SET search_path = public` | m07 | m56 | `src/lib/eventRecap.js` (and triggers) | Clear |
| `ensure_dm_chat` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | Internal Trigger Helper | Clear |
| `file_report` | `SECURITY DEFINER` | `SET search_path = public` | m35 | m35 | `src/lib/moderation.js` | Clear |
| `generate_invite_code` | `SECURITY DEFINER` | `SET search_path = public` | m40 | m40 | `src/lib/invites.js` | Clear |
| `get_daily_question` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | `src/lib/questions.js` | Clear |
| `get_my_chat_summaries` | `SECURITY DEFINER` | `SET search_path = public` | m05 | m37 | `src/lib/chat.js` | Clear |
| `get_pending_question_for_chat` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m49 | `src/lib/questions.js` | Clear |
| `handle_new_user` | `SECURITY DEFINER` | `SET search_path = public` | m01 | m24 | NO CALLER FOUND (DB Trigger) | Clear |
| `has_calendar_connection` | `SECURITY DEFINER` | `SET search_path = public` | m46 | m46 | `src/lib/calendar.js` | Clear |
| `has_demo_users` | `SECURITY DEFINER` | `SET search_path = public` | m15 | m15 | `admin/src/lib/api.js` | Clear |
| `hide_chat` | `SECURITY DEFINER` | `SET search_path = public` | m37 | m37 | `src/lib/chat.js` | Clear |
| `is_admin` | `SECURITY DEFINER` | `SET search_path = public` | m48 | m48 | RLS Helper (`admin_users`) | Clear |
| `is_blocked_with` | `SECURITY DEFINER` | `SET search_path = public` | m35 | m35 | `src/lib/moderation.js` | Clear |
| `is_chat_member` | `SECURITY DEFINER` | `SET search_path = public` | m06 | m06 | RLS Helper (`chat_members`) | Clear |
| `is_circle_admin` | `SECURITY DEFINER` | `SET search_path = public` | m45 | m45 | RLS Helper (`circle_covers`) | Clear |
| `is_circle_member` | `SECURITY DEFINER` | `SET search_path = public` | m55 | m55 | RLS Helper (`circles`) | Clear |
| `is_question_eligible` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | Internal Trigger Helper | Clear |
| `join_lfg_post` | `SECURITY DEFINER` | `SET search_path = public` | m52 | m53 | `src/lib/lfg.js` | Clear |
| `leave_lfg_post` | `SECURITY DEFINER` | `SET search_path = public` | m53 | m53 | `src/lib/lfg.js` | Clear |
| `lfg_post_joiners` | `SECURITY DEFINER` | `SET search_path = public` | m53 | m53 | `src/lib/lfg.js` | Clear |
| `list_friend_groups` | `SECURITY DEFINER` | `SET search_path = public` | m57 | m57 | `src/lib/friendGroups.js` | Clear |
| `mark_event_attendance` | `SECURITY DEFINER` | `SET search_path = public` | m42 | m42 | `src/lib/events.js` | Clear |
| `materialize_connection_on_accept` | `SECURITY DEFINER` | `SET search_path = public` | m07 | m47 | Internal Trigger Helper | Clear |
| `my_blocked_user_ids` | `SECURITY DEFINER` | `SET search_path = public` | m35 | m35 | `src/lib/moderation.js` | Clear |
| `notify_on_application_review` | `SECURITY DEFINER` | `SET search_path = public` | m07 | m07 | Internal Trigger Helper | Clear |
| `notify_on_circle_message` | `SECURITY DEFINER` | `SET search_path = public` | m07 | m07 | Internal Trigger Helper | Clear |
| `notify_on_connection_request` | `SECURITY DEFINER` | `SET search_path = public` | m07 | m07 | Internal Trigger Helper | Clear |
| `push_body_for` | `SECURITY INVOKER` | None | m59 | m59 | Internal Push Helper | Clear |
| `push_on_message` | `SECURITY DEFINER` | `SET search_path = public` | m60 | m60 | DB Trigger (`messages`) | Clear |
| `push_on_notification` | `SECURITY DEFINER` | `SET search_path = public` | m59 | m60 | DB Trigger (`notifications`) | Clear |
| `push_title_for` | `SECURITY INVOKER` | None | m59 | m59 | Internal Push Helper | Clear |
| `question_of_the_day` | `SECURITY INVOKER` | None | m47 | m47 | Internal Question Helper | Clear |
| `redeem_invite` | `SECURITY DEFINER` | `SET search_path = public` | m25 | m25 | `src/lib/invites.js` | Clear |
| `redeem_invite_code` | `SECURITY DEFINER` | `SET search_path = public` | m40 | m40 | `src/lib/invites.js` | Clear |
| `register_device_token` | `SECURITY DEFINER` | `SET search_path = public` | m58 | m58 | `src/lib/push.js` | Clear |
| `resign_game` | `SECURITY DEFINER` | `SET search_path = public` | m29 | m29 | `src/lib/games.js` | Clear |
| `save_friend_group` | `SECURITY DEFINER` | `SET search_path = public` | m57 | m57 | `src/lib/friendGroups.js` | Clear |
| `shared_meetup_count` | `SECURITY DEFINER` | `SET search_path = public` | m28 | m28 | `src/lib/connectionStats.js` | Clear |
| `start_dm` | `SECURITY DEFINER` | `SET search_path = public` | m10 | m47 | `src/lib/chat.js` | Clear |
| `sync_chat_members_with_circle_members` | `SECURITY DEFINER` | `SET search_path = public` | m05 | m05 | DB Trigger (`circles`) | Clear |
| `sync_circle_member_count` | `SECURITY INVOKER` | None | m01 | m01 | DB Trigger (`circle_members`) | Clear |
| `sync_question_reveals` | `SECURITY DEFINER` | `SET search_path = public` | m47 | m47 | `src/lib/questions.js` | Clear |
| `tic_tac_toe_winner` | `SECURITY INVOKER` | None | m29 | m29 | Pure SQL Helper | Clear |
| `toggle_message_reaction` | `SECURITY DEFINER` | `SET search_path = public` | m50 | m50 | `src/lib/chat.js` | Clear |
| `unblock_user` | `SECURITY DEFINER` | `SET search_path = public` | m35 | m35 | `src/lib/moderation.js` | Clear |
| `unhide_chat` | `SECURITY DEFINER` | `SET search_path = public` | m37 | m37 | `src/lib/chat.js` | Clear |
| `unregister_device_token` | `SECURITY DEFINER` | `SET search_path = public` | m58 | m58 | `src/lib/push.js` | Clear |
| `update_message_payload` | `SECURITY DEFINER` | `SET search_path = public` | m41 | m41 | `src/lib/chat.js` | Clear |
| `vote_poll` | `SECURITY DEFINER` | `SET search_path = public` | m38 | m38 | `src/lib/polls.js` | Clear |

---

## 2. Flagged RPC Signature Overloads

PostgreSQL creates function overloads when a `CREATE OR REPLACE FUNCTION` statement introduces a signature with different parameter types or parameter counts without executing an explicit `DROP FUNCTION` first.

### 1. `commit_game_move`
- **Migration 29 Signature**: `commit_game_move(p_game_id uuid, p_new_state jsonb)`
- **Migration 30 Signature**: `commit_game_move(p_game_id uuid, p_new_state jsonb, p_declared_winner text DEFAULT NULL)`
- **Consequence**: Migration 30 created a 3-parameter overload while leaving the 2-parameter function live. Client calls passing 2 arguments execute the legacy m29 implementation, bypassing the optional `p_declared_winner` logic.

### 2. `create_lfg_post`
- **Migration 52 Signature**: 9 parameters `(p_activity, p_expires_at, p_visibility, p_notify_connections, p_place_name, p_place_address, p_latitude, p_longitude, p_starts_at)`
- **Migration 57 Signature**: 10 parameters `(..., p_invitee_ids uuid[] DEFAULT NULL)`
- **Consequence**: Both signatures exist in PostgreSQL. Positional argument calls with 9 parameters will invoke the m52 definition, ignoring targeted friend group invites (`p_invitee_ids`).

---

## 3. Edge Functions Reference

Supabase Edge Functions execute on the Deno serverless runtime.

### 1. `send-push` (`supabase/functions/send-push/index.ts`)
- **Caller / Trigger**: Triggered automatically from PostgreSQL DB triggers `push_on_notification` (m59) and `push_on_message` (m60) via the `pg_net` extension when new notifications or messages are inserted.
- **Function**: Constructs APNs JWT bearer payload and dispatches push notifications directly to Apple Push Notification service (APNs) HTTP/2 endpoints for all registered iOS device tokens in `device_tokens`.
- **Required Environment Secrets**:
  - `APNS_TOPIC`: iOS Bundle Identifier (`com.thirdspace.app`)
  - `APNS_KEY_ID`: Apple APNs Key ID
  - `APNS_TEAM_ID`: Apple Developer Team ID
  - `APNS_PRIVATE_KEY`: Base64-encoded or raw Auth Key `.p8` string

### 2. `google-calendar` (`supabase/functions/google-calendar/index.ts`)
- **Caller / Trigger**: Invoked directly from client-side JavaScript (`src/lib/calendar.js`) via `supabase.functions.invoke('google-calendar', ...)`.
- **Function**: Handles OAuth authorization code exchange, refresh token rotation, and sync of event meetups to user Google Calendars. Stores encrypted tokens in `google_calendar_tokens`.
- **Required Environment Secrets**:
  - `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Client ID
  - `GOOGLE_CLIENT_SECRET`: Google OAuth 2.0 Client Secret
