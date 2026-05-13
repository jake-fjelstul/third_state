# Project Structure

```text
.
├── .env.example
├── .gitignore
├── README.md
├── eslint.config.js
├── implementation.md
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── project_structure.md
├── run.sh
├── tailwind.config.js
├── vercel.json
├── vite.config.js
├── docs/
│   └── oauth-setup.md
├── public/
│   └── favicon.svg
├── src/
│   ├── App.css
│   ├── App.jsx
│   ├── index.css
│   ├── main.jsx
│   ├── components/
│   │   ├── CreateWheel.jsx
│   │   ├── EventDetailModal.jsx
│   │   ├── TimePicker.jsx
│   │   ├── assistant/
│   │   │   ├── AssistantModal.jsx
│   │   │   └── messages/
│   │   │       ├── CircleForm.jsx
│   │   │       ├── CircleList.jsx
│   │   │       ├── ConfirmCard.jsx
│   │   │       ├── EventForm.jsx
│   │   │       ├── EventList.jsx
│   │   │       ├── HelpMessage.jsx
│   │   │       ├── NavSuggestion.jsx
│   │   │       ├── PeopleStack.jsx
│   │   │       └── TextMessage.jsx
│   │   ├── chat/
│   │   │   ├── ChatListItem.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   └── MessageInput.jsx
│   │   ├── discovery/
│   │   │   └── SwipeDiscovery.jsx
│   │   ├── feed/
│   │   │   ├── AssistantBar.jsx
│   │   │   ├── CircleCard.jsx
│   │   │   ├── EventCard.jsx
│   │   │   ├── OnboardingModal.jsx
│   │   │   ├── PersonCard.jsx
│   │   │   └── ProfileCompletionCard.jsx
│   │   ├── games/
│   │   │   ├── CheckersBoard.jsx
│   │   │   ├── ChessBoard.jsx
│   │   │   ├── ConnectFourBoard.jsx
│   │   │   ├── GameBoard.jsx
│   │   │   ├── GameMessageCard.jsx
│   │   │   ├── GamePicker.jsx
│   │   │   ├── SoloGameModal.jsx
│   │   │   └── TicTacToeBoard.jsx
│   │   ├── hoops/
│   │   │   ├── HoopApplication.jsx
│   │   │   ├── HoopBuilder.jsx
│   │   │   └── OrganizerReview.jsx
│   │   └── ui/
│   │       ├── Card.jsx
│   │       ├── CityAutocomplete.jsx
│   │       ├── ImageUploader.jsx
│   │       ├── LocationAutocomplete.jsx
│   │       ├── PillTag.jsx
│   │       ├── PrimaryButton.jsx
│   │       ├── SecondaryButton.jsx
│   │       └── SectionHeader.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── hooks/
│   │   ├── useCalendar.js
│   │   ├── useChatMessages.js
│   │   └── useGameState.js
│   ├── lib/
│   │   ├── assistant/
│   │   │   ├── conversation.js
│   │   │   ├── handlers.js
│   │   │   └── intents.js
│   │   ├── games/
│   │   │   ├── ai.js
│   │   │   ├── checkers.js
│   │   │   ├── chess.js
│   │   │   ├── connectFour.js
│   │   │   ├── index.js
│   │   │   └── ticTacToe.js
│   │   ├── auth.js
│   │   ├── availability.js
│   │   ├── avatar.js
│   │   ├── battery.js
│   │   ├── calendar.js
│   │   ├── chat.js
│   │   ├── circleCover.js
│   │   ├── circles.js
│   │   ├── connectionStats.js
│   │   ├── connections.js
│   │   ├── events.js
│   │   ├── games.js
│   │   ├── geo.js
│   │   ├── geocoding.js
│   │   ├── intents.js
│   │   ├── invites.js
│   │   ├── notifications.js
│   │   ├── profileCompleteness.jsx
│   │   ├── profiles.js
│   │   ├── storage.js
│   │   └── supabase.js
│   └── pages/
│       ├── Auth.jsx
│       ├── AuthCallback.jsx
│       ├── Chat.jsx
│       ├── CircleDetail.jsx
│       ├── Circles.jsx
│       ├── Feed.jsx
│       ├── GamePlay.jsx
│       ├── InviteLanding.jsx
│       ├── Notifications.jsx
│       ├── Profile.jsx
│       ├── Schedule.jsx
│       ├── Settings.jsx
│       └── UserProfile.jsx
└── supabase/
    ├── .gitignore
    ├── config.toml
    └── migrations/
        ├── 00000000000001_initial_schema.sql
        ├── 00000000000002_seed_circles.sql
        ├── 00000000000003_seed_demo_profiles.sql
        ├── 00000000000004_event_attendance_rewards.sql
        ├── 00000000000005_chat_triggers_and_backfill.sql
        ├── 00000000000006_fix_chat_rls.sql
        ├── 00000000000007_notifications_engine.sql
        ├── 00000000000008_scheduled_notifications.sql
        ├── 00000000000009_fix_onboarding_flag.sql
        ├── 00000000000010_fix_start_dm.sql
        ├── 00000000000012_approve_application_rpc.sql
        ├── 00000000000013_tighten_circle_members_insert.sql
        ├── 00000000000014_dm_display_name_in_summaries.sql
        ├── 00000000000015_demo_seed_purge_marker.sql
        ├── 00000000000016_explicit_security_invoker.sql
        ├── 00000000000017_adjust_battery_rpc.sql
        ├── 00000000000018_storage_buckets.sql
        ├── 00000000000019_circle_cover_image_url.sql
        ├── 00000000000020_handle_new_user_oauth.sql
        ├── 00000000000021_profile_self_insert_rls.sql
        ├── 00000000000022_remove_onboarding_flag.sql
        ├── 00000000000023_profile_location.sql
        ├── 00000000000024_handle_new_user_location.sql
        ├── 00000000000025_invites.sql
        ├── 00000000000026_privacy_and_availability.sql
        ├── 00000000000027_intents_and_notification_prefs.sql
        ├── 00000000000028_location_and_connection_stats.sql
        ├── 00000000000029_in_app_games.sql
        ├── 00000000000030_chess_and_checkers.sql
        ├── 00000000000031_disconnect_rpc.sql
        ├── 00000000000032_battery_drains_and_history.sql
        ├── 00000000000033_connections_integrity.sql
        └── 00000000000034_sync_circle_member_counts.sql
```
