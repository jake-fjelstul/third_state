import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useEffect } from 'react'
import { useAppContext } from './context/AppContext.jsx'
import OnboardingPage from './pages/Onboarding.jsx'
import FeedPage from './pages/Feed.jsx'
import CirclesPage from './pages/Circles.jsx'
import CircleDetailPage from './pages/CircleDetail.jsx'
import SchedulePage from './pages/Schedule.jsx'
import ChatPage from './pages/Chat.jsx'
import ProfilePage from './pages/Profile.jsx'
import UserProfilePage from './pages/UserProfile.jsx'
import SettingsPage from './pages/Settings.jsx'
import NotificationsPage from './pages/Notifications.jsx'
const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

/* ── SVG icons (no lucide dependency in shell) ── */
const Icons = {
  Home: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Circles: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Schedule: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Chat: ({ active }) => (
    <svg width="22" height="22" fill={active ? clr.indigo : 'none'} stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Profile: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Settings: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
}

const NAV_ITEMS = [
  { to: '/feed', label: 'Home', Icon: Icons.Home },
  { to: '/circles', label: 'Circles', Icon: Icons.Circles },
  { to: '/schedule', label: 'Schedule', Icon: Icons.Schedule },
  { to: '/chat', label: 'Chat', Icon: Icons.Chat },
  { to: '/profile', label: 'Profile', Icon: Icons.Profile },
]

/* ── Bottom tab bar — always fixed ── */
function BottomNav() {
  const location = useNavigate ? useLocation() : { pathname: '' }
  const navigate = useNavigate()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 100,
      backgroundColor: clr.white,
      borderTop: `1px solid ${clr.border}`,
      display: 'flex',
      justifyContent: 'center',
      padding: '10px 0 max(10px, env(safe-area-inset-bottom))',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}>
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const active = location.pathname === to ||
            (to !== '/feed' && location.pathname.startsWith(to))
          return (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                backgroundColor: active ? clr.indigoLt : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.15s ease',
              }}>
                <Icon active={active} />
              </div>
              {/* Active dot */}
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                backgroundColor: active ? clr.indigo : 'transparent',
                transition: 'background-color 0.15s ease',
              }} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ── Top nav bar — always fixed at top ── */
function TopNav() {
  const navigate = useNavigate()
  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      backgroundColor: clr.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '14px 20px max(14px, env(safe-area-inset-top))',
      borderBottom: `1px solid ${clr.border}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 56 56" fill="none"><circle cx="22" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/><circle cx="34" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/></svg>
          <span style={{ fontSize: 17, fontWeight: 800, color: clr.textDark }}>Third Space</span>
        </button>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => navigate('/notifications')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <div style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B' }}/>
        </div>
      </div>
    </nav>
  )
}

/* ── Shell layout wrapping all authenticated pages ── */
function ShellLayout() {
  const location = useLocation()
  // Hide top/bottom nav when inside a chat thread (e.g. /chat/some-id)
  const isChatThread = /^\/chat\/.+/.test(location.pathname)

  return (
    <>
      {/* Top nav bar — hidden in chat threads */}
      {!isChatThread && <TopNav />}

      <div style={{
        minHeight: '100vh',
        paddingTop: isChatThread ? 0 : 60, /* space for top nav bar */
        paddingBottom: 80, /* space for bottom tab bar */
        backgroundColor: clr.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          <Outlet />
        </div>
      </div>

      {/* Bottom tab bar — always visible */}
      <BottomNav />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}
      </style>
    </>
  )
}

/* ── Onboarding guard ── */
function OnboardingGuard() {
  const { onboardingComplete } = useAppContext()
  const location = useLocation()

  useEffect(() => { }, [location.pathname])

  if (!onboardingComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  if (onboardingComplete && location.pathname === '/onboarding') {
    return <Navigate to="/feed" replace />
  }
  return <Outlet />
}

/* ── Root app ── */
function App() {
  return (
    <Routes>
      <Route element={<OnboardingGuard />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<ShellLayout />}>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/circles" element={<CirclesPage />} />
          <Route path="/circles/:id" element={<CircleDetailPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/user/:id" element={<UserProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Route>
    </Routes>
  )
}

export default App