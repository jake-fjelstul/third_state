# Feature Implementation Catalog — Third Space

Comprehensive specification of every user-facing feature in Third Space, detailing user experience descriptions, complete implementation chains, and empirical status assessments.

---

## Feature Matrix Summary

| Feature Name | Primary Entrypoint | Implementation Chain | Status |
| --- | --- | --- | --- |
| **Authentication & Auth Callback** | `src/pages/Auth.jsx` | `Auth.jsx` → `AppContext.jsx` → `src/lib/auth.js` → `handle_new_user` RPC → `profiles` | **WORKING** |
| **Circle Discovery & Detail** | `src/pages/Circles.jsx` | `Circles.jsx` → `CircleCard.jsx` → `src/lib/circles.js` → RLS policies → `circles`, `circle_members` | **WORKING** |
| **Swipe Discovery Deck** | `src/pages/Feed.jsx` | `Feed.jsx` → `SwipeDiscovery.jsx` → `src/lib/circles.js`, `src/lib/profiles.js` → DB Selects → `circles`, `profiles` | **WORKING** |
| **Hoops Application System** | `src/pages/CircleDetail.jsx` | `CircleDetail.jsx` → `HoopApplication.jsx` / `OrganizerReview.jsx` → `src/lib/circles.js` → `apply_to_circle`, `approve_application` RPCs → `hoops`, `applications` | **WORKING** |
| **Events & RSVPs** | `src/pages/Schedule.jsx` | `Schedule.jsx` → `EventCard.jsx`, `EventDetailModal.jsx` → `src/lib/events.js` → `mark_event_attendance` RPC → `events`, `event_attendees` | **WORKING** |
| **Realtime Group & DM Chat** | `src/pages/Chat.jsx` | `Chat.jsx` → `ChatListItem.jsx`, `MessageInput.jsx`, `useChatMessages.js` → `src/lib/chat.js` → `get_my_chat_summaries`, `start_dm` RPCs → `chats`, `messages` | **WORKING** |
| **In-App Multiplayer Games** | `src/pages/GamePlay.jsx` | `Chat.jsx` / `GamePlay.jsx` → `GamePicker.jsx`, `useGameState.js` → `src/lib/games.js` → `commit_game_move` RPC → `games` | **PARTIAL** |
| **Interactive Chat Polls** | `src/pages/Chat.jsx` | `Chat.jsx` → `PollComposer.jsx`, `PollMessageCard.jsx`, `usePoll.js` → `src/lib/polls.js` → `create_chat_poll`, `vote_poll` RPCs → `polls`, `poll_votes` | **WORKING** |
| **Spontaneous Coffee Invites** | `src/pages/Chat.jsx` | `Chat.jsx` → `CoffeeInviteMessageCard.jsx` → `src/lib/chat.js` → `accept_coffee_invite` RPC → `messages` | **WORKING** |
| **LFG Posts & Targeted Groups** | `src/pages/Feed.jsx` | `Feed.jsx` → `LfgRecipientPicker.jsx` → `src/lib/lfg.js`, `src/lib/friendGroups.js` → `create_lfg_post`, `save_friend_group` RPCs → `lfg_posts` | **PARTIAL** |
| **Icebreaker Questions** | `src/pages/Chat.jsx` | `Chat.jsx` → `QuestionPrompt.jsx`, `AskQuestionComposer.jsx` → `src/lib/questions.js` → `get_daily_question`, `answer_daily_question` RPCs → `questions` | **WORKING** |
| **Battery & Reconnect Signal** | `src/pages/Profile.jsx` | `Profile.jsx` → Battery gauge → `src/lib/battery.js`, `AppContext.jsx` → `adjust_battery` RPC → `profiles`, `battery_history` | **WORKING** |
| **Google Calendar Sync** | `src/pages/Schedule.jsx` | `Schedule.jsx` → `useCalendar.js` → `src/lib/calendar.js` → Edge Function `google-calendar` → `google_calendar_tokens` | **WORKING** |
| **Push Notifications** | `src/pages/Notifications.jsx`| `Notifications.jsx` → `src/lib/push.js` → `register_device_token` RPC → Edge Function `send-push` → APNs | **WORKING** |
| **Moderation (Block & Report)** | `src/pages/UserProfile.jsx` | `UserProfile.jsx` → `ReportModal.jsx` → `src/lib/moderation.js` → `block_user`, `file_report` RPCs → `blocks`, `reports` | **WORKING** |
| **Admin Analytics Dashboard** | `admin/src/App.jsx` | `admin/src/pages/` → `admin/src/lib/api.js` → `has_demo_users`, `is_admin` RPCs → `admin_users` | **WORKING** |

---

## Detailed Feature Specifications & Evidence

### 1. In-App Multiplayer Games — Status: `PARTIAL`
- **User Perspective**: Users in a chat thread can launch interactive board games (Chess, Checkers, Connect Four, Tic-Tac-Toe) and play turns asynchronously or in real time directly within the chat bubble interface.
- **Implementation Chain**: [Chat.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Chat.jsx#L800-L850) → [GamePicker.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/components/games/GamePicker.jsx#L1-L80) → [useGameState.js](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/hooks/useGameState.js#L1-L60) → [src/lib/games.js](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/lib/games.js#L1-L90) → `commit_game_move` RPC → `games` table.
- **Evidence for PARTIAL**:
  - In [src/lib/games.js:34](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/lib/games.js#L34), `commitMove()` calls `supabase.rpc('commit_game_move', { p_game_id: gameId, p_new_state: newState })`.
  - Migration `00000000000030_chess_and_checkers.sql` updated `commit_game_move` to accept an optional third parameter `p_declared_winner text DEFAULT NULL` without dropping the old 2-parameter signature.
  - Because `src/lib/games.js:34` does not pass `p_declared_winner` when a game reaches checkmate or victory condition, the RPC executes the legacy 2-parameter overload, failing to update `winner_id` and `status = 'completed'` in the `games` database table. Happy path board move syncing works, but automatic victory finalization in DB fails.

---

### 2. Looking-For-Group (LFG) Posts & Targeted Audience — Status: `PARTIAL`
- **User Perspective**: Users can broadcast spontaneous real-world hangout activities ("Looking for 2 people for tennis at 5 PM") to all local users, specific circles, or custom friend groups.
- **Implementation Chain**: [Feed.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Feed.jsx#L1200-L1350) → [LfgRecipientPicker.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/components/lfg/LfgRecipientPicker.jsx#L1-L100) → [src/lib/lfg.js](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/lib/lfg.js#L1-L50) → `create_lfg_post` RPC → `lfg_posts`, `lfg_joins` tables.
- **Evidence for PARTIAL**:
  - In [src/lib/lfg.js:14](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/lib/lfg.js#L14), `createLfgPost()` passes 9 parameters to `create_lfg_post`.
  - Migration `00000000000057_friend_groups_and_lfg_targeting.sql` added a 10th parameter `p_invitee_ids uuid[] DEFAULT NULL` to populate the `lfg_post_invites` table for targeted friend group broadcasts.
  - Because `src/lib/lfg.js:14` was not updated to pass `p_invitee_ids`, friend group targeted LFG broadcasts invoke the legacy 9-parameter RPC overload, leaving `lfg_post_invites` empty and falling back to a global broadcast. Public LFG posts work, but targeted friend group restriction fails.
