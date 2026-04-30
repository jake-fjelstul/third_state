# Third Space — Implementation Plan

> Living document. Update as decisions are made or scope changes.

## Vision

Third Space is a platform for scheduling, meeting, and joining groups online with the explicit goal of producing **in-person** connections. The app exists to get people off the app and into shared physical experiences. Every feature is evaluated against that goal: *does it make a real-world hangout more likely?*

### Product pillars

- **Circles** — interest-based groups people join (open, or private gated by "hoops" — application questions).
- **Events / Meetups** — concrete real-world gatherings hosted by circles or individuals.
- **Discovery** — surfacing relevant people, circles, and events nearby.
- **Reconnection** — nudging users to maintain in-person ties, not just online ones. Driven by the *reconnect nudge engine* and the *battery* engagement signal that drains with inactivity.
- **Chat** — group + DM messaging that exists primarily to coordinate IRL plans.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend (web) | React 19 + Vite, React Router, Tailwind + inline styles using CSS variables |
| Client state | React Context (`AppContext`) as the canonical store; optimistic UI; Supabase as source of truth |
| Backend | Supabase — Postgres, Auth, Realtime, Storage, Edge Functions |
| Hosting | Vercel (web) |
| Mobile (later) | Capacitor wrapping the same React app for iOS + Android |
| CI/CD | Vercel auto-deploy on `main`; preview deploys for PRs |
| Observability (planned) | Sentry for errors, PostHog for product analytics |

### Key architectural decisions

- **One React codebase for web and mobile.** Capacitor wraps the Vite build into native shells. No React Native fork, no rewrite.
- **AppContext is a stable contract.** Pages call methods like `joinCircle`, `rsvpEvent`, `sendMessage` regardless of whether the data is mock or Supabase-backed. We swap internals one domain at a time without touching the component layer.
- **RLS enforces all access control.** No trusted client logic. A bug in the frontend cannot leak data.
- **Migrations live in the repo.** `supabase/migrations/` is PR-reviewable; `supabase db push` applies them. No clicking around the dashboard to make schema changes.

## Project Structure

```
.
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── .env.local                # local secrets (gitignored)
├── .env.example              # committed template
├── public/
│   ├── favicon.svg
│   └── third_state_icon.png
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 00000000000001_initial_schema.sql
└── src/
    ├── App.css
    ├── App.jsx               # routes + shell layout + nav
    ├── index.css
    ├── main.jsx
    ├── assets/
    ├── lib/                  # Supabase-facing modules
    │   ├── supabase.js       # client
    │   └── auth.js           # signUp, signIn, signOut, getProfile, updateProfile
    ├── components/
    │   ├── chat/             # ChatListItem, MessageBubble, MessageInput
    │   ├── discovery/        # SwipeDiscovery
    │   ├── feed/             # CircleCard, EventCard, PersonCard
    │   ├── hoops/            # HoopApplication, HoopBuilder, OrganizerReview
    │   └── ui/               # Card, PillTag, PrimaryButton, SecondaryButton, SectionHeader
    ├── context/
    │   └── AppContext.jsx    # central store
    ├── hooks/
    │   └── useGoogleCalendar.js  # real web OAuth; mobile variant in Phase 11
    └── pages/
        ├── Auth.jsx          # sign in / sign up / reset
        ├── Feed.jsx
        ├── Circles.jsx
        ├── CircleDetail.jsx
        ├── Schedule.jsx
        ├── Chat.jsx
        ├── ChatThread.jsx
        ├── UserProfile.jsx
        ├── Profile.jsx
        ├── Settings.jsx
        └── Notifications.jsx
```

## Database Schema

Defined in `supabase/migrations/00000000000001_initial_schema.sql`. Every table has RLS enabled.

| Table | Purpose |
| --- | --- |
| `profiles` | 1:1 with `auth.users`. Bio, interests, intents, theme, battery_points, reconnect_threshold_days, search_radius. Auto-created via `on_auth_user_created` trigger. |
| `circles` | Interest groups. Organizer, type (`open` / `private`), category, vibe, rules, cover gradient. |
| `circle_members` | Junction. Trigger `trg_circle_member_count` keeps `circles.member_count` in sync. |
| `hoops` | Application questions for private circles. Type is `written` or `multiplechoice`. |
| `applications` | One per (circle, applicant). Status: `pending` / `approved` / `declined`. |
| `application_answers` | One row per hoop within an application. |
| `events` | Concrete meetups attached to a circle. Has `starts_at` and `location`. |
| `event_attendees` | RSVPs. |
| `chats` | Either `group` (tied to a circle) or `dm`. |
| `chat_members` | Membership. `last_read_at` drives unread counts. |
| `chat_channels` | Sub-channels in a group chat (`general`, `planning`, `photos`, `meetups`). |
| `messages` | Single message; tied to a chat and optionally a channel. |
| `connections` | Directed user-to-user. `last_hangout` powers the reconnect nudge engine. |
| `notifications` | Per-user feed. `payload` is `jsonb` so notification types can evolve without migrations. |
| `battery_history` | Append-only log of battery point changes. |

### RLS philosophy

- **Authenticated read** for discoverable content (profiles, circles, hoops, events).
- **Self-only writes** for personal records (own profile, own RSVP, own connections, own notification mark-as-read).
- **Organizer-only mutations** for circle-owned content (hoops, application reviews, circle metadata).
- **Chat access is gated to chat membership** for both reads and writes.

### Triggers

- `on_auth_user_created` — auto-creates a `profiles` row on signup, seeded with the user's name from `raw_user_meta_data`.
- `trg_circle_member_count` — increments/decrements `circles.member_count` on member insert/delete.

## State Management — AppContext

`AppContext` is the single client-side store. Its **method surface is the contract**; pages don't care where the data comes from underneath.

### Domains it owns

- Auth session + current user profile
- Joined circles
- Meetups (RSVPs)
- Chat state (chats, channels, messages, unread)
- Connections + reconnect nudges
- Notifications
- Battery (engagement currency, with inactivity drain)
- Discovery swipe counters
- App preferences (theme, reconnect threshold, search radius)
- Pending applications (hoops flow)

### Migration strategy per domain

For each domain (circles, events, chat, …):

1. Add Supabase queries behind the existing context methods.
2. Replace mock seed reads with live queries; keep loading/error state locally.
3. Swap optimistic local-only `setX` calls with `mutate → refetch`.
4. Add realtime subscriptions where applicable.
5. Remove the corresponding section from `mockData.js`.

The component layer is mostly untouched throughout migration.

## Implementation Roadmap

Phases are sequential. Each phase ends with a working app — never a half-broken intermediate state.

### Phase 1 — Supabase scaffolding ✅ COMPLETE

- Installed `@supabase/supabase-js` and Supabase CLI.
- Added `.env.local` and `.env.example` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Created `src/lib/supabase.js` client.
- Initialized `supabase/` directory and migrations.
- Authored full initial schema migration with RLS + triggers.
- Applied migration to remote Supabase project via `supabase db push`.

### Phase 2 — Real auth + profile loading ✅ COMPLETE

- Added `src/lib/auth.js` (`signUp`, `signIn`, `signOut`, `resetPassword`, `getProfile`, `updateProfile`).
- Built `src/pages/Auth.jsx` with sign-in / sign-up / password-reset modes.
- Wired `AppContext` to Supabase auth: subscribes to session changes, loads profile on session, clears state on sign-out.
- Auth routing: not signed in → `/auth`; signed in → app (`/feed` and shell routes). No gated onboarding step.
- Added Sign Out button to Settings.
- Removed `currentUser` from localStorage cache (now sourced from Supabase).
- **Note:** Onboarding was originally a multi-step gated flow (`Onboarding.jsx` + `onboarding_complete`); it was removed in favor of an inline pattern (Feed completion card + Profile progress ring). The same profile fields are collected; only timing and presentation changed (see Design decisions).

### Phase 3 — Circles, memberships, and seed data 🔜 NEXT

- Seed migration with realistic circles + hoops so first-run users see a populated app.
- `src/lib/circles.js` exposing `listCircles`, `getCircle`, `createCircle`, `updateCircle`, `joinCircle`, `leaveCircle`, `applyToCircle`, `listMyCircles`.
- Circle creation was already implemented in `lib/circles.js`; this refactor wires it into the actual Feed UI flow.
- Replace `circles` reads in `Feed.jsx`, `Circles.jsx`, `CircleDetail.jsx` with Supabase queries (hand-rolled `useEffect` hooks; we'll evaluate React Query later if the manual approach gets noisy).
- Replace `joinCircle` / `leaveCircle` in AppContext with mutations + optimistic updates.
- Hoops application flow: writes to `applications` + `application_answers`. Organizer review reads `applications` for circles they own.
- `joinedCircles` is derived from `circle_members` rather than inferred from mock data.
- Remove `circles` and `people` from `mockData.js`.

### Phase 4 — Events, meetups, and RSVPs

- `src/lib/events.js` with `listUpcomingEvents`, `getEvent`, `createEvent`, `rsvp`, `cancelRsvp`, `listMyMeetups`.
- `Schedule.jsx` reads from `events` + `event_attendees` joined on current user.
- `EventDetailModal` reads real attendee data.
- AppContext `rsvpEvent` / `cancelRsvp` / `isRsvpd` become Supabase-backed.
- Battery rewards (`+20 attending an event`) move server-side via Edge Function or DB trigger so they can't be spoofed client-side.
- Remove `meetups` from `mockData.js`.

### Phase 5 — Chat (realtime)

- `src/lib/chat.js` with `listChats`, `getChat`, `listMessages`, `sendMessage`, `markRead`, `startDM`, `listChannels`.
- Replace `chatState` in AppContext with a hook that subscribes to `messages` via Supabase Realtime.
- Add a `chat_members` realtime subscription so newly joined chats appear immediately.
- Track `currentlyOpenChatId` in AppContext to avoid unread-count bumps while inside the active thread.
- Auto-create a group chat + default channels (`general`, `planning`, `photos`, `meetups`) when a circle is created (Edge Function or trigger).
- DMs auto-created on first message.
- `last_read_at` on `chat_members` drives unread counts.
- Remove `chats` from `mockData.js`.

### Phase 6 — Notifications + reconnect engine

- `src/lib/notifications.js` with `listNotifications`, `markRead`, `markAllRead`.
- Realtime subscription on `notifications` for the current user.
- Move reconnect-nudge generation server-side: a scheduled Edge Function (daily) checks `connections.last_hangout` against each user's `reconnect_threshold_days` and inserts notifications.
- Connection requests, application status changes, event reminders → all become server-inserted notifications.
- Remove `seedNotifications` from `mockData.js`.

### Phase 7 — Storage (avatars + circle covers)

- ✅ Supabase Storage buckets + storage RLS policies landed in migrations for `avatars` (public read, owner write) and `circle-covers` (public read, organizer write).
- ✅ `cover_image_url` column added on `circles`; gradient fallback (`cover_gradient`) remains in place.
- ✅ Upload flows wired in Profile (avatar) and CircleDetail (organizer-only cover updates/removal).
- ✅ Dicebear fallback centralized in `src/lib/avatar.js`; uploaded avatars/covers render app-wide when present.
- _Footnote_: we chose client-side canvas resize + deterministic object paths with cache-busting (`?v=`) for cost/control. Revisit Supabase image transformations if traffic grows or if we need multiple responsive variants.

### Phase 8 — Google Calendar (mobile-native)

- ✅ Added Supabase Google OAuth sign-in (`signInWithGoogle`) and dedicated callback route (`/auth/callback`).
- ✅ OAuth users land on `/feed` like everyone else; profile nudges use the same inline completion pattern as email signups.
- ✅ Replaced direct hook implementation with a calendar facade (`src/lib/calendar.js`) + thin reactive wrapper (`src/hooks/useCalendar.js`).
- ✅ "Add to Calendar" is now available in event modal surfaces, not only Schedule cards.
- ✅ Added OAuth setup runbook in `docs/oauth-setup.md`.
- Native Capacitor scaffolding remains deferred to Phase 11 in this pass.

### Phase 9 — Production hardening

- Error boundaries at route level + a `RootErrorBoundary` around `<App>`.
- Sentry for error tracking; PostHog (or Plausible) for product analytics.
- Toast / snackbar component for non-fatal user-facing errors.
- Replace ad-hoc `console.error` calls with structured logging.
- Lighthouse pass: route-level code splitting, image optimization, bundle analysis.
- Playwright E2E smoke test: signup → feed → join circle → RSVP → message.

### Phase 10 — Vercel deploy

- Vercel project linked to GitHub repo, auto-deploy on `main`.
- Env vars in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Custom domain + HTTPS.
- Supabase auth URL allow-list updated with the production origin.
- Re-enable email confirmation in Supabase before public launch.
- Preview deploys for branch PRs — use a separate Supabase project (or tighter RLS scoping) for preview environments.

### Phase 11 — Capacitor for iOS + Android

- `npm install @capacitor/core @capacitor/cli` + add iOS/Android platforms.
- `npx cap init`; configure `capacitor.config.ts` to point at the Vite build output.
- Native plugins: Push (notifications), Camera (avatar capture), Geolocation (location-aware feed), Calendar (replaces web Google Calendar OAuth on mobile).
- Adjust auth redirect for native (custom URL scheme).
- Submit to App Store + Play Store.

## Design decisions

**Profile completion vs. gated onboarding.** We first shipped a dedicated multi-step onboarding screen and `onboarding_complete` flag so every field was filled before the main app. That hurt activation: users bounced before experiencing value. We removed the gate and switched to an inline model—a dismissible card on Feed plus a progress ring and soft “Suggested” highlights on Profile—so people enter the app immediately and fill details when they are ready. The data model is unchanged; only UX timing changed.

## Open Questions / Decisions Pending

- **Realtime cost at scale.** When we cross a Supabase free-tier threshold, do we move chat to a dedicated provider (Soketi, Ably) or stay on Supabase Realtime?
- **Battery visibility.** Is the battery score visible to other users, or strictly self-facing? (Current build is self-facing.)
- **Hoops review actions.** Can the organizer only approve/decline, or also send a follow-up question?
- **Circle creation gating.** Open to any signed-in user, or gated by email verification / minimum profile completeness?

## Conventions

- **Migrations are append-only.** New schema changes go in a new timestamped file in `supabase/migrations/`. Never edit a migration that's already been applied to a shared environment.
- **All tables get RLS enabled by default.** A migration that creates a table without RLS is a bug.
- **AppContext methods return promises** where it matters, so pages can `await` and show loading states.
- **`mockData.js` shrinks each phase.** The day it's empty, we delete it.
- **Components stay presentational.** Data fetching goes through `src/lib/*.js` modules called from AppContext or page-level hooks.
- **Env var naming.** Frontend env vars are prefixed `VITE_`. Secrets that must never reach the client live in Edge Function environment, not `.env.local`.

## Glossary

- **Circle** — an interest-based group. Has members, an organizer, events, and a chat.
- **Hoop** — an application question gating entry to a private circle.
- **Meetup / Event** — a concrete real-world gathering at a time and place.
- **Battery** — per-user engagement score (0–100) that increases on positive actions and drains on inactivity.
- **Reconnect nudge** — a notification triggered when a user hasn't seen a connection in N days.
- **Third Space** — the term itself: places that aren't home (first place) or work (second place) where community forms. The product is named after this idea.
