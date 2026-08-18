# Codebase Defect Audit — Third Space

**Verification standard for this document:** every entry below was confirmed by
reading the live file or by querying the production database. Where a claim could
not be fully verified, it is filed under *Unverified* at the bottom rather than
stated as fact. Line numbers were checked against actual file lengths.

Last verified: 2026-08-17 against migrations 01–60 and production project
`cxlzvegqgspuddbrxawr`.

---

## 1. High severity

### 1.1 Any authenticated user can insert notifications for any other user

- **File:** `supabase/migrations/00000000000001_initial_schema.sql:394-395`
- **Verified:** policy reads `create policy "system inserts notifications" on
  public.notifications for insert to authenticated with check (true);`
- **Consequence:** the INSERT policy has no `auth.uid()` constraint, so a client
  holding an anon key can write arbitrary rows into any user's notification
  feed with a forged `type` and `payload`. This bypasses `enqueue_notification`
  entirely, and therefore bypasses every `notification_prefs` gate and block
  check that function enforces.
- **Escalation since migration 59:** a trigger on `notifications` INSERT now
  forwards each row to the `send-push` Edge Function. A forged insert is
  therefore a forged **push notification** delivered to a real device, not just
  a row in a list.
- **Fix direction:** restrict the policy to service-role writes, or add
  `with check (auth.uid() = user_id)` and route all cross-user enqueues through
  the existing security-definer functions, which is already how every legitimate
  caller works.

### 1.2 `poll_created` notifications are not being delivered

- **Evidence:** production contains 2 rows in `polls` (newest 2026-08-16
  03:01 UTC) and 0 notifications of type `poll_created`, while other
  notification types continued to be created until 2026-08-16 20:00 UTC.
- **Emitter location:** `00000000000056_poll_notifications.sql:122`, inside
  `create_chat_poll`, fanning out to `chat_members where user_id <> creator`.
- **Client path confirmed:** `src/lib/polls.js:4` calls
  `supabase.rpc('create_chat_poll', ...)`, so the emitter is on the live path.
- **Root cause: UNDETERMINED.** Two candidates remain:
  1. Migration 56 is not applied in production, meaning local migrations have
     drifted from the deployed database.
  2. Both polls were created in chats where the creator was the only member, so
     the fan-out loop had nothing to iterate.
  Resolve by checking whether `pg_proc.prosrc` for `create_chat_poll` contains
  the string `poll_created`, and by counting non-creator members of each poll's
  chat. Candidate 1 is far more serious and must be ruled out first.

### 1.3 `application_approved` notifications are not being delivered

- **Evidence:** production contains 1 application with `status = 'approved'`
  (reviewed 2026-08-16 02:54 UTC) and 0 notifications of type
  `application_approved`.
- **Emitter location:** `00000000000007_notifications_engine.sql:149`, inside
  `notify_on_application_review`, which selects
  `application_approved` or `application_declined` from `new.status`.
- **Root cause: UNDETERMINED.** Check that the trigger is actually attached in
  production (`pg_trigger`), and that `approve_application` (migration 12)
  performs an `UPDATE` on `applications.status` rather than writing membership
  directly and leaving the row untouched.

---

## 2. Medium severity

### 2.1 `connections.last_hangout` is never written

- **File:** `src/lib/connections.js:29` — `updateLastHangout` is exported.
- **Verified:** zero callers anywhere in the codebase. Production confirms
  0 of 30 `connections` rows have a non-null `last_hangout`.
- **Consequence — three features silently degraded:**
  1. `src/lib/connectionStats.js:38` sets `status = 'Reconnect'` whenever
     `daysConnected > 21` and `daysSinceHangout` is null. Since the column is
     never written, **every connection older than 21 days displays "Reconnect"
     unconditionally.** The badge measures nothing.
  2. The "Last Hangout" block in `src/pages/UserProfile.jsx:390` is gated on
     `connStats.daysSinceHangout != null` and therefore never renders.
  3. `streak` in `connectionStats.js:50` requires a non-null `daysSinceHangout`
     and is therefore always 0.
- **Note:** this is a product gap, not only a bug. Nothing in the app currently
  defines what counts as a hangout.

### 2.2 Scheduled notification emitters have never run

- **File:** `supabase/migrations/00000000000008_scheduled_notifications.sql:105-119`
- **Verified:** `pg_cron` is **not installed** on the production project. The
  scheduling block is wrapped in
  `if exists (select 1 from pg_extension where extname = 'pg_cron')`, so it
  evaluated false and did nothing, silently. Production has 0 `reconnect_nudge`
  and 0 `event_approaching` notifications, all time.
- **Consequence — two dormant features:**
  - `emit_reconnect_nudges` has never fired.
  - `emit_event_reminders` has never fired. Every downstream piece built on it
    is therefore untested in production: the `event_approaching` push routing in
    migration 59, and the stale-reminder pruning in `AppContext.jsx`.
- **Hazard when enabling:** turning on `pg_cron` activates both emitters at
  once. Because `emit_reconnect_nudges` falls back to
  `coalesce(last_hangout, created_at)` (migration 27, line 62) and
  `last_hangout` is universally null, the first run would nudge every connection
  older than 21 days simultaneously and re-nudge every 7 days indefinitely.
  Since migration 59 forwards notifications to APNs, these would be real pushes.
  **Resolve issue 2.1 before enabling `pg_cron`.**

### 2.3 `listMessages` loads the oldest messages, not the newest

- **File:** `src/lib/chat.js:119`
- **Verified:** `.order('created_at', { ascending: true }).limit(limit)` with
  `limit = 100`.
- **Consequence:** any chat exceeding 100 messages opens showing the first 100
  ever sent, with recent messages unreachable. It also queries the index
  `idx_messages_chat_created (chat_id, created_at desc)` against its sort order.
- **Current impact: latent.** The largest chat in production holds 33 messages
  and no chat exceeds 100. Becomes user-visible on the first conversation to
  cross the threshold.

### 2.4 Connections are displayed as sorted when they are not

- **File:** `src/pages/Profile.jsx:110` and `:515`
- **Verified:** line 110 is `const recentConnections = connections.slice(0, 5)`
  with no sort. Line 515 renders the label `Sorted by: Most recent interaction`.
  `src/lib/connections.js:20` (`listMyConnections`) has no `.order()` clause, so
  the underlying array is in arbitrary Postgres return order.
- **Consequence:** the label is false. Five arbitrary connections are presented
  as the five most recent.

### 2.5 The connections tab ranks by volume, not recency

- **File:** `src/pages/Circles.jsx:35-60` (`getInteractionScore`)
- **Verified:** the score sums shared circles × 20, DM message count × 10
  (capped at 100), a flat +15 for `dmThread.time` being truthy, +5 for unread,
  and +8 per circle the person posted in. **There is no recency term.**
- **Consequence:** messaging counts toward rank, but only by total volume. A
  contact messaged 200 times a year ago outranks one messaged this morning.
- **Secondary defect:** line 54 detects circle participation with
  `m.sender === person.name`, matching on display-name strings rather than
  sender IDs. Duplicate or changed names break it.

### 2.6 The Network graph is built from circles only, so connections are invisible

- **File:** `src/pages/Circles.jsx:200`
- **Verified:** `if (joinedCircles.length === 0) return { nodes, edges, hiddenCount: 0 }`
  where `nodes` contains only the `you` node. Person nodes are derived
  exclusively from `c.members` of joined circles.
- **Consequence:** a user's actual connections do not appear in the graph unless
  they happen to share a joined circle. A user in no circles sees a single node.
- **Secondary defect (dead ranking):** `getActivityScore` at line 28 reads
  `circle.events` and `circle.chatPreview`. The mapper at
  `src/lib/circles.js:26` hardcodes `events: []` and never sets `chatPreview`.
  Both terms are therefore permanently 0, reducing inner-ring ranking to
  `memberCount / 10` capped at 20.
- **Secondary defect (unused prop):** `people` is destructured in the
  `NetworkGraph` signature at line 172 and never referenced in the body. It is
  also listed in the `rankedConnections` dependency array at line 505, causing
  unnecessary recomputation.

### 2.7 Profile availability reflects in-app events only

- **File:** `src/lib/availability.js:8`
- **Verified:** `getAvailabilityForUser` queries `event_attendees` joined to
  `events` and nothing else. Migration 46, `src/lib/calendar.js`, and
  `src/hooks/useCalendar.js` implement Google Calendar integration that is not
  referenced anywhere in this path.
- **Consequence:** the Availability panel on a user profile means "Third Space
  events they RSVP'd to," not their real availability. A user with a full
  external calendar renders as entirely free.
- **Secondary:** `availability.js:23` assumes a flat 90-minute duration for
  every event because the `events` table has no duration column.

### 2.8 Blank About sections render as empty cards

- **File:** `src/pages/UserProfile.jsx:110` and `:400-404`
- **Verified:** `showBio` is computed as `p.showBio || isSelf` — a privacy check
  only, with no test for whether `person.bio` has content. The section wrapper
  at line 400 gates on `(showBio || showInterests)`.
- **Consequence:** a user with no bio renders an "About" heading over a card
  containing an empty `<p>`.

### 2.9 Edit Profile modal is unreachable at the top on small screens

- **File:** `src/pages/Profile.jsx:594-612`
- **Verified:** the overlay sets `alignItems: 'flex-start'` with
  `overflowY: 'auto'`; the inner card sets `margin: 'auto'`.
- **Consequence:** `margin: auto` overrides the flex alignment and vertically
  centers the card. In a scrolling flex container this makes overflow above the
  top edge unscrollable — the standard flex-centering overflow defect. On an
  iPhone-height viewport the top of the form is cut off.

### 2.10 Remove-photo button is not centered

- **File:** `src/components/ui/ImageUploader.jsx:76` and `:132-136`
- **Verified:** the component root at line 76 is a bare `<div>` with no style
  prop. The Remove `<button>` at line 133 is an inline-block element with only
  `marginTop: 8`.
- **Consequence:** the button aligns to the left edge of the container beneath a
  centered avatar.

### 2.11 Dead form field silently discards user input

- **File:** `src/pages/Feed.jsx:902`
- **Verified:** `<input type="number" placeholder="Max attendees (optional)" style={inputStyle} />`
  — no `name`, no `value`, no `onChange`, and no corresponding read in the
  submit handler.
- **Consequence:** users can enter a maximum attendee count that is discarded
  without feedback. The `events` table has no column for it.

---

## 3. Low severity — dead code and maintenance

### 3.1 Exported functions with no callers

Verified by cross-referencing every export against all references in `src/`.

| File | Export | Note |
|---|---|---|
| `src/lib/connections.js` | `updateLastHangout` | See 2.1 — the cause of three broken features |
| `src/lib/chat.js` | `getChat` | Superseded by `get_my_chat_summaries` |
| `src/lib/chat.js` | `findExistingDm` | Superseded by the `start_dm` RPC |
| `src/lib/profiles.js` | `searchProfiles` | Server-side search exists but is unused; `Circles.jsx` filters client-side instead |
| `src/lib/profiles.js` | `listProfilesByIds` | — |
| `src/lib/events.js` | `listMyRsvpdEventIds` | — |
| `src/lib/moderation.js` | `isBlockedWith` | Client wrapper unused; the SQL function of the same name is used server-side |
| `src/lib/storage.js` | `deleteEventCover` | Event covers can be replaced but never deleted |
| `src/lib/push.js` | `setBadgeCount` | Matches the known open item: server-side badge counts unimplemented |
| `src/lib/push.js` | `getLastPushToken` | — |
| `src/lib/assistant/conversation.js` | `assistantActionConfirmation` | — |
| `src/lib/assistant/conversation.js` | `assistantDisambiguation` | — |
| `src/lib/assistant/conversation.js` | `resetIdCounter` | — |
| `src/lib/assistant/createActions.js` | `getCreateAction` | Related to 3.2 |
| `src/lib/contentFilter.js` | `containsBlockedContent` | Internal helper only; `checkContent` **is** used by 6 components |

### 3.2 Assistant create intents may route nowhere

- **Files:** `src/lib/assistant/classify.js:54,57`, `engine.js:197-217`,
  `handlers.js:69,76`
- **Verified:** `classify.js` scores `CREATE_EVENT` and `CREATE_CIRCLE` intents.
  `engine.js:11` imports only `handleFindPeople`, `handleFindCircles`,
  `handleFindEvents`, `handleNavigate`, `handleHelp`, and `handleDiscover` — not
  `handleCreateEvent` or `handleCreateCircle`, which are exported from
  `handlers.js` but imported nowhere. `mapIntentToActionId` in `engine.js:210`
  has no case for either create intent.
- **Consequence:** the assistant appears able to classify "create a circle" with
  no handler wired to execute it. **Needs behavioral confirmation** — the
  fall-through path was not traced to its end.

### 3.3 Legacy compatibility shim on the message hot path

- **File:** `src/lib/chat.js:26` (`isMissingGamesColumns`), applied at `:127`
  and `:168`
- **Verified:** the shim catches PostgREST errors mentioning the `kind` or
  `payload` columns and retries with a reduced column set. Those columns were
  added by migration 29 and are permanently present.
- **Consequence:** every message load and every message send is wrapped in a
  try/catch retry for a schema state that can no longer occur.

### 3.4 Missing index for reverse connection lookups

- **Verified:** `connections` has only `connections_pkey` on
  `(user_id, connected_user_id)`. A composite index serves queries constraining
  its leading column, so `where connected_user_id = ?` is unindexed.
- **Consequence:** currently negligible — the table holds 30 rows. Recorded for
  when it does not.

### 3.5 Emoji used as iconography across 42 files

- **Verified:** roughly 250 literal emoji characters across 42 source files.
  Heaviest: `src/lib/circleIcons.js` (28), `SwipeDiscovery.jsx` (28),
  `Feed.jsx` (22), `CircleDetail.jsx` (20), `Chat.jsx` (13).
- **Two cases need separate decisions:** the chess and checkers boards use
  `♔♕♖♗♘♙♚♛♜♝♞♟` as the actual playing pieces, and `circleIcons.js` is a data
  catalog tied to the `circles.emoji` column.

### 3.6 Known items carried forward

- `src/components/hoops/HoopApplication.jsx` hardcodes a dark palette instead of
  CSS variables, so it renders incorrectly in light mode.
- Two `CircleCard` components exist in `Feed.jsx` and `Circles.jsx` and have
  diverged. Deliberately not merged.
- `circles` has no coordinates, only a `city` text column. Circle distance would
  require geocoding `city` via Nominatim on save.
- `cover_gradient` and `emoji` on `circles` are effectively dead but retained.
- The questions system is anchored to `America/New_York`; per-user timezones are
  not implemented.

---

## 4. Performance

### 4.1 The Circles page issues four sequential round trips

- **Files:** `src/pages/Circles.jsx:465-486`, `src/lib/circles.js:63,125`
- **Verified sequence:** `listMyCircleIds` → `listVisibleCircles` (which calls
  `listMyCircleIds` internally again) → `listJoinedCircleMembers` (which repeats
  the same `circle_members` query a third time) → the members fetch.
- **Not a data-volume problem.** Production holds 44 profiles, 25 circles, 61
  circle memberships, 110 messages, and 29 events. Every query returns in
  under a millisecond. The entire cost is network latency multiplied by
  serialized requests.
- **Contributing factors:** `listVisibleCircles` uses `select('*')`, retrieving
  `description`, `rules`, `vibe`, and `cover_gradient` for cards that display
  none of them; and its `.or()` clause inlines every circle ID as
  `id.in.(uuid,uuid,...)`.
- **Fix direction:** consolidate into one security-definer RPC returning the
  full page payload. `get_my_chat_summaries` (migration 5, last modified 37)
  already proves this pattern in production.

### 4.2 App boot serializes behind the profile fetch

- **File:** `src/context/AppContext.jsx:202-253`
- **Verified:** `fetchProfileForUser` must resolve before `listMyCircleIds`,
  `listMyConnections`, `listMyMeetups`, `listChatsDb`, and `listNotifications`
  are dispatched. Those five then run in parallel.
- **Consequence:** one full round trip of dead time before any content loads.
  Only `listMyCircleIds` genuinely depends on the profile; the rest need only
  the session user ID, which is available earlier.

---

## 5. Unverified — do not act on without checking

- **`CityAutocomplete.jsx` vs `LocationAutocomplete.jsx` duplication.** The two
  files are 150 and 189 lines. A shared origin is plausible but the diff was not
  performed.
- **Assistant create-intent fall-through (3.2).** The absence of a handler
  import is confirmed; the runtime behavior when the intent is classified is
  not.
- **Root causes for 1.2 and 1.3.** The symptoms are confirmed from production
  data; the causes are not.

---

## Appendix — claims from the prior generated audit that did not survive checking

Recorded so they are not reintroduced.

| Prior claim | Finding |
|---|---|
| `commit_game_move` overload bypasses game completion | **False.** Migration 30 line 28 executes `drop function if exists public.commit_game_move(uuid, jsonb);` before creating the 3-arg version. Production reports zero overloaded functions in `public`. |
| `create_lfg_post` overload breaks targeted invites | **False.** Migration 57 line 165 drops the 9-arg signature first, with a comment at line 161 explaining the PostgREST binding hazard. |
| `Feed.jsx:82` checks removed `onboarding_complete` | **False.** The identifier does not appear in `Feed.jsx`. |
| `profiles.location_name` written but never read | **False.** No such column exists in any migration. |
| `Settings.jsx:412` "Export Personal Data" button is inert | **False.** No Export control exists in `Settings.jsx`. |
| `PersonCard.jsx:88` "Add Connection" calls `startDM` | **False.** `PersonCard.jsx` is 38 lines long. |
| `Card.jsx:12` accepts an unused `elevation` prop | **False.** `Card.jsx` is 10 lines and has no such prop. |
| `event_recap` notification type | **False.** The string appears nowhere in the codebase. |
| Bundle identifier `com.thirdspace.app` | **False.** `capacitor.config.json:2` sets `com.thirdspace.social`. |
