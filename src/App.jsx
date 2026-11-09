import { lazy, useEffect, useRef } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { routeDepth } from './lib/motion.js'
import AppShell from './components/shell/AppShell.jsx'
import { HARDWARE_BACK_EVENT } from './lib/hardwareBack.js'
import { Capacitor } from '@capacitor/core'
import './App.css'
import { useAppContext } from './context/AppContext.jsx'
import { isProfileSessionFatalError } from './lib/auth.js'
import AuthPage from './pages/Auth.jsx'
import FeedPage from './pages/Feed.jsx'
import AuthCallbackPage from './pages/AuthCallback.jsx'
import InviteLandingPage from './pages/InviteLanding.jsx'
import JoinLandingPage from './pages/JoinLanding.jsx'
import OnboardingModal from './components/feed/OnboardingModal.jsx'
import { PrivacyPolicy, Terms, Support } from './pages/Legal.jsx'
import LandingPage from './pages/Landing.jsx'
import ResetPasswordPage from './pages/ResetPassword.jsx'
import PushPrompt from './components/push/PushPrompt.jsx'
import BatteryWidget from './components/battery/BatteryWidget.jsx'
import { supabase } from './lib/supabase'

// Code-split pages (issue 5). Feed ships in the main bundle; the rest load
// on demand and are preloaded once the app is idle.
const PAGE_LOADERS = {
  CirclesPage: () => import('./pages/Circles.jsx'),
  CircleDetailPage: () => import('./pages/CircleDetail.jsx'),
  SchedulePage: () => import('./pages/Schedule.jsx'),
  ChatPage: () => import('./pages/Chat.jsx'),
  GamePlay: () => import('./pages/GamePlay.jsx'),
  ProfilePage: () => import('./pages/Profile.jsx'),
  UserProfilePage: () => import('./pages/UserProfile.jsx'),
  SettingsPage: () => import('./pages/Settings.jsx'),
  NotificationsPage: () => import('./pages/Notifications.jsx'),
  MemoriesPage: () => import('./pages/Memories.jsx'),
}
const CirclesPage = lazy(PAGE_LOADERS.CirclesPage)
const CircleDetailPage = lazy(PAGE_LOADERS.CircleDetailPage)
const SchedulePage = lazy(PAGE_LOADERS.SchedulePage)
const ChatPage = lazy(PAGE_LOADERS.ChatPage)
const GamePlay = lazy(PAGE_LOADERS.GamePlay)
const ProfilePage = lazy(PAGE_LOADERS.ProfilePage)
const UserProfilePage = lazy(PAGE_LOADERS.UserProfilePage)
const SettingsPage = lazy(PAGE_LOADERS.SettingsPage)
const NotificationsPage = lazy(PAGE_LOADERS.NotificationsPage)
const MemoriesPage = lazy(PAGE_LOADERS.MemoriesPage)
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
  const location = useLocation()
  const navigate = useNavigate()
  const { chatState } = useAppContext()
  const hasUnreadChat = Object.values(chatState || {}).some(chat => chat.unread > 0)

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 100,
      backgroundColor: clr.white,
      borderTop: `1px solid ${clr.border}`,
      display: 'flex',
      justifyContent: 'center',
      paddingTop: '10px',
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
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
              onClick={() => {
                if (location.pathname === to) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
                navigate(to)
              }}
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
                position: 'relative',
              }}>
                <Icon active={active} />
                {to === '/chat' && hasUnreadChat && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: '#EF4444', border: `1.5px solid ${active ? clr.indigoLt : clr.white}`
                  }} />
                )}
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
  const { notifications } = useAppContext()
  const hasUnread = notifications.some(n => !n.isRead)
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
      padding: 'max(8px, env(safe-area-inset-top)) 12px 8px 20px',
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
        <button type="button" onClick={() => navigate('/feed')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 56 56" fill="none"><circle cx="22" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/><circle cx="34" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/></svg>
          <span style={{ fontSize: 17, fontWeight: 800, color: clr.textDark }}>Third Space</span>
        </button>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <BatteryWidget />
          <button type="button" onClick={() => navigate('/notifications')} aria-label="Notifications" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          {hasUnread && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', pointerEvents: 'none' }}/>}
        </div>
      </div>
    </nav>
  )
}

/* ── Shell: kept-alive tabs + a stack of pushed screens (see AppShell) ── */
const TAB_ELEMENTS = {
  '/feed': <FeedPage />,
  '/circles': <CirclesPage />,
  '/schedule': <SchedulePage />,
  '/chat': <ChatPage />,
  '/profile': <ProfilePage />,
}
const PUSHED_ROUTES = [
  <Route key="chat" path="/chat/:id" element={<ChatPage />} />,
  <Route key="circle" path="/circles/:id" element={<CircleDetailPage />} />,
  <Route key="game" path="/game/:gameId" element={<GamePlay />} />,
  <Route key="user" path="/user/:id" element={<UserProfilePage />} />,
  <Route key="settings" path="/settings" element={<SettingsPage />} />,
  <Route key="notifications" path="/notifications" element={<NotificationsPage />} />,
  <Route key="memories" path="/memories" element={<MemoriesPage />} />,
]
// These draw their own header and handle the safe areas themselves.
const SELF_HEADED = ['/chat/', '/game/']

function ShellLayout() {
  return (
    <>
      <AppShell
        tabElements={TAB_ELEMENTS}
        pushedRoutes={PUSHED_ROUTES}
        selfHeadedPrefixes={SELF_HEADED}
        topNav={<TopNav />}
        bottomNav={<BottomNav />}
        extras={<PushPrompt />}
      />
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}
      </style>
    </>
  )
}

/* ── Auth Guard & Refresh Redirect ── */
function AuthGuard() {
  const navigate = useNavigate()
  const { session, authLoading, currentUser, profileError, refreshProfile, signOut } = useAppContext()
  const location = useLocation()
  const onAuthRoute = location.pathname === '/auth' || location.pathname === '/auth/callback'
  const onPublicInviteRoute = location.pathname.startsWith('/invite/') || location.pathname.startsWith('/j/')

  const handleProfileRetry = async () => {
    if (profileError && isProfileSessionFatalError(profileError)) {
      await signOut().catch(() => {})
      navigate('/auth', { replace: true })
      return
    }
    await refreshProfile().catch(() => {})
  }

  if (authLoading || (session && !currentUser)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: clr.bg,
        color: clr.textMid,
        fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0 }}>{profileError ? "Couldn't load your profile." : 'Loading…'}</p>
          {profileError && (
            <button type="button" onClick={() => handleProfileRetry()} style={{ marginTop: 12, border: 'none', borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}>
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!session && !onAuthRoute && !onPublicInviteRoute) {
    return <Navigate to="/auth" replace />
  }
  if (session && onAuthRoute) {
    return <Navigate to="/feed" replace />
  }

  return <Outlet />
}

/* ── Root app ── */
function App() {
  const { authLoading, session, currentlyOpenChatId } = useAppContext()
  const navigate = useNavigate()
  const currentlyOpenChatIdRef = useRef(currentlyOpenChatId)

  useEffect(() => {
    currentlyOpenChatIdRef.current = currentlyOpenChatId
  }, [currentlyOpenChatId])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let hidden = false
    const hide = () => {
      if (hidden) return
      hidden = true
      import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}))
        .catch(() => {})
    }

    // Failsafe: never leave the splash up forever if auth hangs.
    const failsafe = setTimeout(hide, 6000)
    if (!authLoading) hide()

    return () => clearTimeout(failsafe)
  }, [authLoading])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!session?.user) return
    let cleanup = () => {}
    let cancelled = false

    const routeTap = (notification) => {
      setTimeout(() => {
        const data = notification?.data || {}
        const type = data.type
        if (type === 'message') {
          if (data.chatId) navigate(`/chat/${data.chatId}`)
          return
        }
        if (type === 'lfg_post' || type === 'lfg_join') { navigate('/feed'); return }
        if (data.chatId) { navigate(`/chat/${data.chatId}`); return }
        navigate('/notifications')
      }, 0)
    }

    const onForeground = (notification) => {
      const data = notification?.data || {}
      if (data.type === 'message' && data.chatId === currentlyOpenChatIdRef.current) return
    }

    import('./lib/push')
      .then(({ initPush }) => initPush({
        onTapped: routeTap,
        onForeground,
      }))
      .then(fn => { if (cancelled) fn?.(); else cleanup = fn || (() => {}) })
      .catch(err => console.error('[push] initPush failed', err))

    return () => { cancelled = true; cleanup() }
  }, [session?.user?.id, navigate])

  // Preload the code-split pages once signed in and idle.
  useEffect(() => {
    if (!session?.user) return
    const run = () => Object.values(PAGE_LOADERS).forEach(load => load().catch(() => {}))
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 2500 }) : setTimeout(run, 1200)
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : clearTimeout(id))
  }, [session?.user])

  // Password-reset links on web land with a recovery session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password', { replace: true })
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  // Android hardware back: sheet first, then history, then exit from Home.
  const locationRef = useRef(null)
  const loc = useLocation()
  useEffect(() => { locationRef.current = loc.pathname }, [loc.pathname])
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let remove = () => {}
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('backButton', () => {
        const ev = new CustomEvent(HARDWARE_BACK_EVENT, { cancelable: true })
        if (!window.dispatchEvent(ev)) return // a sheet handled it
        const path = locationRef.current || '/'
        if (path === '/feed' || path === '/' || path === '/auth') { CapApp.exitApp(); return }
        if (routeDepth(path) === 0) { navigate('/feed'); return }
        navigate(-1)
      }).then(h => { remove = () => h.remove() })
    }).catch(() => {})
    return () => remove()
  }, [navigate])

  // Universal Links (https://third-space-app.com/...) and thirdspace:// links
  // that aren't OAuth callbacks open the matching in-app route (H3, item 14).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const routeFromUrl = (raw) => {
      if (!raw) return
      let u
      try { u = new URL(raw) } catch { return }
      let path
      if (u.protocol === 'https:' && /(^|\.)third-space-app\.com$/.test(u.hostname)) {
        path = u.pathname
      } else if (u.protocol === 'thirdspace:' || u.protocol === 'com.thirdspace.social:') {
        // thirdspace://j/CODE parses host='j', pathname='/CODE'
        path = `/${u.hostname}${u.pathname}`.replace(/\/+$/, '')
        if (path.startsWith('/auth') || path.startsWith('/calendar-callback')) return // handled elsewhere
      } else {
        return
      }
      if (!path || path === '/') return
      navigate(`${path}${u.search}${u.hash}`)
    }

    let remove = () => {}
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.getLaunchUrl().then(res => routeFromUrl(res?.url)).catch(() => {})
      CapApp.addListener('appUrlOpen', ({ url }) => routeFromUrl(url))
        .then(h => { remove = () => h.remove() })
    }).catch(() => {})
    return () => remove()
  }, [navigate])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let remove = () => {}
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return
        import('./lib/push').then(({ clearDeliveredNotifications }) =>
          clearDeliveredNotifications())
      }).then(h => { remove = () => h.remove() })
    }).catch(() => {})
    return () => remove()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/invite/:token" element={<InviteLandingPage />} />
      <Route path="/j/:code" element={<JoinLandingPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/support" element={<Support />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<AuthGuard />}>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Matched here, rendered by AppShell (tabs stay mounted, pushed screens stack).
            No named params on purpose: React Router hands a parent route's params
            to every nested <Routes>, so "/chat/:id" here made the hidden Chat tab
            also render a thread, which crashed on a duplicate realtime channel. */}
        <Route element={<ShellLayout />}>
          <Route path="/feed" element={null} />
          <Route path="/circles" element={null} />
          <Route path="/circles/*" element={null} />
          <Route path="/schedule" element={null} />
          <Route path="/memories" element={null} />
          <Route path="/chat" element={null} />
          <Route path="/chat/*" element={null} />
          <Route path="/game/*" element={null} />
          <Route path="/user/*" element={null} />
          <Route path="/profile" element={null} />
          <Route path="/settings" element={null} />
          <Route path="/notifications" element={null} />
        </Route>
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Route>
    </Routes>
  )
}

export default App