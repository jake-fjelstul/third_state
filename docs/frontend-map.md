# Frontend Source Map (`src/`) — Third Space

Comprehensive index of every source file under `src/`, detailing file purpose, exported symbols, imports, dependent files, and architectural refactor candidates exceeding 500 lines.

---

## 1. Architectural Refactor Candidates (>500 Lines)

Files over 500 lines violate single-responsibility principles by mixing multiple presentation, business logic, and UI state concerns.

| File Path | Line Count | Primary Mixed Responsibilities & Refactor Strategy |
| --- | --- | --- |
| [src/pages/Feed.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Feed.jsx) | **2,136** | **Mixed Responsibilities**: Main activity feed rendering, LFG post creation drawer, Swipe Discovery trigger overlay, onboarding card logic, and person/circle filter tabs.<br>**Refactor Strategy**: Extract LFG creation drawer to `components/lfg/LfgCreateModal.jsx` and Feed filter logic to a custom `useFeedFilter()` hook. |
| [src/pages/CircleDetail.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/CircleDetail.jsx) | **1,515** | **Mixed Responsibilities**: Circle header metadata display, member roster management, event creation modal, hoop application review drawer, cover image upload canvas, and chat thread preview.<br>**Refactor Strategy**: Extract member management roster and organizer review drawer into dedicated sub-components. |
| [src/pages/Chat.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Chat.jsx) | **1,324** | **Mixed Responsibilities**: Thread list sidebar navigation, active message stream rendering, game board overlay modals, poll creation, coffee invite card handling, and icebreaker question cards.<br>**Refactor Strategy**: Partition into `ChatThreadList.jsx` and `ActiveChatStream.jsx`. |
| [src/context/AppContext.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/context/AppContext.jsx) | **1,145** | **Mixed Responsibilities**: Auth session state, profile loading, circle membership hydration, chat thread fetching, notification subscriptions, and battery calculation.<br>**Refactor Strategy**: Split into domain-focused contexts (`AuthContext`, `SocialContext`, `NotificationContext`). |
| [src/pages/Settings.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Settings.jsx) | **1,078** | **Mixed Responsibilities**: Account profile edit forms, notification preference toggles, location search radius sliders, Google Calendar OAuth controls, and account deletion confirmation modal.<br>**Refactor Strategy**: Extract preference sections into separate setting panels (`NotificationSettings.jsx`, `SecuritySettings.jsx`). |
| [src/pages/Profile.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Profile.jsx) | **1,055** | **Mixed Responsibilities**: User profile card rendering, battery gauge stats visualization, interest tag editor, connection request list, and avatar upload canvas.<br>**Refactor Strategy**: Extract interest tag editor and battery history breakdown into separate components. |
| [src/components/discovery/SwipeDiscovery.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/components/discovery/SwipeDiscovery.jsx) | **949** | **Mixed Responsibilities**: Touch gesture card deck handling, profile distance calculations, match popup celebration animation, and filter preferences.<br>**Refactor Strategy**: Extract gesture math into a custom `useSwipeDeck()` hook. |
| [src/pages/UserProfile.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/UserProfile.jsx) | **943** | **Mixed Responsibilities**: Remote profile viewing, connection request state handling, mutual circles list, user blocking action sheet, and report modal trigger.<br>**Refactor Strategy**: Extract block/report action sheet and mutual circle list into dedicated modals. |
| [src/pages/Schedule.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Schedule.jsx) | **917** | **Mixed Responsibilities**: Upcoming meetup calendar view, RSVP filter tabs, event creation modal, attendance check-in modal, and Google Calendar export button.<br>**Refactor Strategy**: Extract event creation wizard to `components/EventCreateModal.jsx`. |
| [src/pages/Circles.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Circles.jsx) | **854** | **Mixed Responsibilities**: Circle directory tab navigation, category filtering, search input logic, and circle creation wizard modal.<br>**Refactor Strategy**: Extract circle creation wizard into a separate component. |
| [src/pages/Notifications.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/pages/Notifications.jsx) | **712** | **Mixed Responsibilities**: Notification list rendering, inline connection request acceptance, event check-in action handlers, and quick-reply DM composers.<br>**Refactor Strategy**: Extract notification action item cards (`ConnectionRequestCard.jsx`, `EventReminderCard.jsx`). |

---

## 2. Directory & File Map (`src/`)

### Application Root & Context
- [src/main.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/main.jsx): Application DOM entrypoint. Mounts `<App />` into `#root`. Imports `React`, `ReactDOM`, `App.jsx`, `index.css`.
- [src/App.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/App.jsx): Root layout shell, bottom navigation bar, active page routing, and Assistant modal wrapper. Exports `default`.
- [src/context/AppContext.jsx](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/context/AppContext.jsx): Canonical state store context provider. Exports `AppContext`, `AppProvider`, `useApp`.

### Custom Hooks (`src/hooks/`)
- [src/hooks/useCalendar.js](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/hooks/useCalendar.js): Hook managing Google Calendar OAuth connection status and event export utilities. Exports `useCalendar`.
- [src/hooks/useChatMessages.js](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/hooks/useChatMessages.js): Realtime chat message stream hook with Supabase WebSocket listener. Exports `useChatMessages`.
- [src/hooks/useGameState.js](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/hooks/useGameState.js): In-app game session realtime state listener and turn handler hook. Exports `useGameState`.
- [src/hooks/usePoll.js](file:///Users/jake/Documents/Github%20Projects/Third_Space/src/hooks/usePoll.js): Realtime poll state, vote casting, and closing hook. Exports `usePoll`.

### Page Views (`src/pages/`)
- `Auth.jsx`: Authentication login, signup, and password reset form view.
- `AuthCallback.jsx`: OAuth redirect callback handler extracting URL tokens and setting session.
- `Chat.jsx`: Main realtime messaging hub, thread list sidebar, and active chat stream.
- `CircleDetail.jsx`: Individual circle details view, member roster, event list, and cover photo upload.
- `Circles.jsx`: Explore interest circles directory, category filters, and circle creation wizard.
- `Feed.jsx`: Main activity feed displaying local people, circles, upcoming events, and LFG posts.
- `GamePlay.jsx`: Standalone game board view for full-screen game sessions.
- `InviteLanding.jsx`: Reusable invite link landing page for joining circles via link.
- `JoinLanding.jsx`: Direct circle join landing page.
- `Landing.jsx`: Public landing page marketing view.
- `Legal.jsx`: Privacy policy and terms of service legal view.
- `Memories.jsx`: Past attended events and photo recap gallery.
- `Notifications.jsx`: User notification feed, connection requests, and event reminders.
- `Profile.jsx`: Current user profile editor, battery gauge, and avatar uploader.
- `Schedule.jsx`: Personal event schedule, upcoming meetups, and Google Calendar sync button.
- `Settings.jsx`: App preferences, notification settings, search radius, and account deletion.
- `UserProfile.jsx`: Public profile view for other users, connect request trigger, block, and report.

### Reusable UI Primitives (`src/components/ui/`)
- `Card.jsx`: Reusable glassmorphic container card component.
- `CircleIcon.jsx`: Category icon renderer for circles with custom colors.
- `CityAutocomplete.jsx`: Location autocomplete input selector for cities.
- `ImageUploader.jsx`: Canvas image crop and upload component for avatars and covers.
- `LocationAutocomplete.jsx`: Full address and geolocation autocomplete input.
- `PillTag.jsx`: Interest tag and category badge component.
- `PrimaryButton.jsx`: Styled primary CTA button component.
- `QRCard.jsx`: QR code generator component for profile and circle sharing.
- `SecondaryButton.jsx`: Styled secondary outline button component.
- `SectionHeader.jsx`: Section header title component with optional action link.

### Feature Sub-Components (`src/components/`)
- `assistant/`: AI assistant modal (`AssistantModal.jsx`) and message cards (`CircleList.jsx`, `EventForm.jsx`, `ConfirmCard.jsx`, etc.).
- `chat/`: Chat thread list item (`ChatListItem.jsx`), composers (`MessageInput.jsx`, `PollComposer.jsx`), and message cards (`PollMessageCard.jsx`, `CoffeeInviteMessageCard.jsx`, `QuestionMessageCard.jsx`).
- `discovery/`: Swipe discovery card deck component (`SwipeDiscovery.jsx`).
- `feed/`: Feed cards (`CircleCard.jsx`, `EventCard.jsx`, `PersonCard.jsx`, `ProfileCompletionCard.jsx`) and onboarding modal (`OnboardingModal.jsx`).
- `games/`: In-app game boards (`ChessBoard.jsx`, `CheckersBoard.jsx`, `ConnectFourBoard.jsx`, `TicTacToeBoard.jsx`), picker (`GamePicker.jsx`), and solo modal (`SoloGameModal.jsx`).
- `hoops/`: Application question builder (`HoopBuilder.jsx`), application modal (`HoopApplication.jsx`), and organizer review drawer (`OrganizerReview.jsx`).
- `lfg/`: Looking-For-Group recipient picker component (`LfgRecipientPicker.jsx`).
- `moderation/`: Content/user flagging report modal (`ReportModal.jsx`).

### Domain Logic & Libraries (`src/lib/`)
- `assistant/`: Natural language intent classification, entity extraction, slot filling, and action handlers (`engine.js`, `intents.js`, `actions.js`, `handlers.js`).
- `games/`: JavaScript game logic engines (`chess.js`, `checkers.js`, `connectFour.js`, `ticTacToe.js`, `ai.js`).
- API Helpers: `auth.js`, `circles.js`, `events.js`, `chat.js`, `connections.js`, `notifications.js`, `polls.js`, `lfg.js`, `questions.js`, `push.js`, `moderation.js`, `invites.js`, `calendar.js`, `storage.js`, `supabase.js`.
