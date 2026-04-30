# OAuth Setup (Supabase + Google)

Set this up once per environment.

## 1) Create Google OAuth credentials

In Google Cloud Console:

- Go to `APIs & Services` -> `Credentials`
- Create OAuth 2.0 Client ID of type **Web application**
- Add authorized redirect URIs:
  - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
  - `http://localhost:3000/auth/callback`
  - `<your-vercel-domain>/auth/callback`
  - `thirdspace://auth/callback` (reserved for native)

## 2) Enable Google provider in Supabase

In Supabase Dashboard:

- `Authentication` -> `Providers` -> `Google`
- Enable provider
- Paste Google **Client ID** and **Client Secret**

## 3) Configure Supabase URL allow-list

In Supabase Dashboard:

- `Authentication` -> `URL Configuration`
- Add the same callback URLs above to the allow-list.

## Notes

- `VITE_GOOGLE_CLIENT_ID` is used by direct Google Calendar OAuth (`calendar.events` scope).
- `VITE_GOOGLE_OAUTH_CLIENT_ID` is kept in `.env.example` for discoverability of the Supabase Google provider setup (`openid email profile` flow), even though the app does not read it directly.
