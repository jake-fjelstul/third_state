# Project Structure — Third Space

Comprehensive directory tree of the repository as it exists now. Annotations describe the purpose of each directory and top-level file.

```text
.
├── .env.example                          # Committed environment variable template for client & local Supabase
├── .gitignore                             # Git ignore rules for node_modules, build artifacts, env local files
├── README.md                             # Project overview and high-level setup instructions
├── capacitor.config.json                 # Native Capacitor 8 iOS container configuration (app ID, web dir, plugins)
├── eslint.config.js                      # Flat ESLint configuration for React & JS code style
├── index.html                            # Main web application HTML entrypoint
├── package-lock.json                     # Locked dependency tree for root project
├── package.json                          # Main dependencies, scripts (dev, build, preview), and metadata
├── postcss.config.js                     # PostCSS config with Tailwind CSS and Autoprefixer
├── project_structure.md                  # Legacy project tree (regenerated copy mirrored from docs/project-structure.md)
├── run.sh                                # Local development startup script launching dev servers
├── tailwind.config.js                    # Tailwind CSS configuration (theme extensions, colors, content paths)
├── vercel.json                           # Vercel deployment routes, headers, and SPA rewrite rules
├── vite.config.js                        # Vite bundler configuration (React plugin, alias resolution, server settings)
│
├── admin/                                # Independent React + Vite Admin Dashboard sub-project
│   ├── .env.local                        # Local environment variables for admin dashboard (gitignored)
│   ├── dist/                             # Compiled static build artifacts for admin deployment
│   ├── index.html                        # HTML entrypoint for admin dashboard
│   ├── package-lock.json                 # Locked dependency tree for admin sub-project
│   ├── package.json                      # Admin dependencies (Supabase, Lucide icons, Recharts) & scripts
│   ├── postcss.config.js                 # Admin PostCSS configuration
│   ├── public/                           # Static assets for admin (robots.txt, favicon)
│   ├── src/                              # Admin dashboard React source code
│   │   ├── App.jsx                       # Main admin router, navigation shell, and auth gate wrapper
│   │   ├── index.css                     # Admin global styles and Tailwind imports
│   │   ├── main.jsx                      # Admin React DOM render entrypoint
│   │   ├── components/                   # Admin UI panels, charts, tables, and auth protection components
│   │   │   └── ui/                       # Reusable admin UI primitives (Stat, Panel, DataTable, Delta, Chip)
│   │   ├── lib/                          # Admin API layer, Supabase admin client, and formatting helpers
│   │   └── pages/                        # Admin dashboard views (Overview, Growth, Circles, Events, Connections, Moderation, Onboarding)
│   ├── vercel.json                       # Vercel deployment configuration for admin sub-project
│   └── vite.config.js                    # Vite bundler configuration for admin dashboard
│
├── assets/                               # Source branding, app icon, and splash screen raw images
│   ├── icon.png                          # App icon source asset
│   └── splash-dark.png                   # Splash screen asset
│
├── docs/                                 # Centralized codebase documentation repository
│   ├── README.md                         # Documentation index mapping all docs/ files
│   ├── architecture.md                   # System architecture, deployment topology, state management, auth, and realtime
│   ├── database.md                       # Consolidated live PostgreSQL database schema, RLS policies, indexes, and triggers
│   ├── features.md                       # Complete audit of user-facing features, implementation chains, and statuses
│   ├── frontend-map.md                   # Source directory map for src/, file purposes, exports/imports, and refactor candidates
│   ├── issues.md                         # Severe-ordered codebase audit of bugs, dead code, unused props/columns, and security gaps
│   ├── notifications.md                  # Notification & push pipeline spec, payload shape conventions, and suppression rules
│   ├── project-structure.md              # Regenerated complete project directory tree (this file)
│   └── rpcs.md                           # Database RPC reference, security definer settings, migration histories, and callers
│
├── ios/                                  # Xcode project and iOS-native integration (Capacitor 8)
│   ├── App/                              # Core iOS App target directory
│   │   ├── App/                          # Native Swift source (AppDelegate.swift), Info.plist, entitlements, and assets
│   │   ├── App.xcodeproj/                # Xcode project bundle configuration and build schemes
│   │   ├── App.xcworkspace/                # Xcode workspace referencing project and Swift Package Manager dependencies
│   │   ├── Base.lproj/                   # Native launch screen and main storyboard files
│   │   ├── CapApp-SPM/                   # Swift Package Manager package declaring Capacitor SPM dependencies
│   │   ├── PrivacyInfo.xcprivacy         # iOS Privacy Manifest detailing API usage and data types
│   │   ├── capacitor.config.json         # iOS target copy of Capacitor configuration
│   │   └── public/                       # Synchronized web build output copied into Xcode bundle by Capacitor
│   ├── capacitor-cordova-ios-plugins/    # Cordova plugin compatibility bridge resources and podspec
│   └── debug.xcconfig                    # Xcode build configuration overrides for local debug builds
│
├── public/                               # Public static web assets served by Vite (favicons, branding logos)
│   └── favicon.svg                       # Web favicon SVG asset
│
├── scripts/                              # Maintenance and operations Node.js utility scripts
│   └── set-admin-password.mjs            # Utility script to set or update admin user passwords in Supabase Auth
│
├── src/                                  # Main Third Space React client application source
│   ├── App.css                           # Legacy application component-level CSS styles
│   ├── App.jsx                           # Main application layout shell, bottom navigation, active tab routing, and modals
│   ├── index.css                         # Core CSS design system, Tailwind directives, dark mode tokens, and global utilities
│   ├── main.jsx                      # React DOM initialization and root App mount entrypoint
│   ├── assets/                           # React component static image imports
│   ├── components/                       # Feature-specific and reusable React components
│   │   ├── assistant/                    # AI assistant chat interface, modal, and action response message cards
│   │   ├── chat/                         # Realtime chat thread, list items, poll cards, coffee invite cards, and composers
│   │   ├── discovery/                    # Swipe discovery card deck for profiles and circles nearby
│   │   ├── feed/                         # Feed cards (circles, events, people, profile completion) and onboarding modal
│   │   ├── games/                        # In-app game boards (Chess, Checkers, Connect Four, Tic-Tac-Toe), picker, and solo modal
│   │   ├── hoops/                        # Application hoop question builder, application modal, and organizer review UI
│   │   ├── lfg/                          # Looking-For-Group post recipient and target group selector
│   │   ├── moderation/                   # Report modal for user/content flagging
│   │   └── ui/                           # Base UI component library (Cards, Buttons, Autocompletes, QR code, PillTags)
│   ├── context/                          # Global application state React context
│   │   └── AppContext.jsx                # Canonical state store (auth, profile, circles, chats, notifications, battery, realtime)
│   ├── hooks/                            # Custom React hooks
│   │   ├── useCalendar.js                # Hook wrapping Google Calendar token status and sync utilities
│   │   ├── useChatMessages.js            # Realtime chat message fetching and subscription hook
│   │   ├── useGameState.js               # Realtime game session state listener and move handler hook
│   │   └── usePoll.js                    # Chat poll state, voting, and closing hook
│   ├── lib/                              # Core application domain logic, Supabase API helpers, and game engines
│   │   ├── assistant/                    # AI assistant intent parser, entity extractor, slot filler, and action execution engine
│   │   ├── db/                           # Specialized database query abstractions (e.g. polls)
│   │   └── games/                        # Pure JavaScript game logic engines (chess, checkers, connectFour, ticTacToe, AI solver)
│   └── pages/                            # SPA route views (Auth, Feed, Circles, CircleDetail, Chat, Profile, Settings, etc.)
│
└── supabase/                             # Supabase backend configuration, Edge Functions, and database migrations
    ├── config.toml                       # Supabase local development configuration (ports, auth, api settings)
    ├── functions/                        # Supabase Edge Functions (Deno / TypeScript)
    │   ├── google-calendar/              # Edge function managing Google Calendar OAuth token exchange and sync
    │   └── send-push/                    # Edge function dispatching Apple APNs push notifications via APNs HTTP/2 API
    └── migrations/                       # 59 sequential SQL migration scripts (00000000000001 through 00000000000060)
```
