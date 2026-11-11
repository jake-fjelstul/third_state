import { lazy, useEffect, useRef } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { routeDepth } from './lib/motion.js'
import AppShell from './components/shell/AppShell.jsx'
import { Bell, CalendarDays, Home, MessageCircle, Plus, UserRound, Users } from 'lucide-react'
import { Avatar } from './components/ui/ds.jsx'
import { useMyStatus, requestOpenStatus } from './lib/statusBus.js'
import { HARDWARE_BACK_EVENT } from './lib/hardwareBack.js'
import { useStableNavigate } from './lib/useStableNavigate.js'
import { requestHomeReset } from './lib/homeBus.js'
import { Capacitor } from '@capacitor/core'
import './App.css'
import { useAppContext } from './context/AppContext.jsx'
import { isProfileSessionFatalError } from './lib/auth.js'
import AuthPage from './pages/Auth.jsx'
import FeedPage from './pages/Feed.jsx'
import AuthCallbackPage from './pages/AuthCallback.jsx'
import InviteLandingPage from './pages/InviteLanding.jsx'
import JoinLandingPage from './pages/JoinLanding.jsx'
import ShareLanding from './pages/ShareLanding.jsx'
import PollLanding from './pages/PollLanding.jsx'
import OnboardingModal from './components/feed/OnboardingModal.jsx'
import AppTour from './components/tour/AppTour.jsx'
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

/* ── Tab bar: icons only, ink when active (design v2) ── */
const NAV_ITEMS = [
  { to: '/feed', label: 'Home', Icon: Home, fillActive: true },
  { to: '/circles', label: 'Circles', Icon: Users },
  { to: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { to: '/chat', label: 'Chat', Icon: MessageCircle },
  { to: '/profile', label: 'Profile', Icon: UserRound },
]

function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { chatState } = useAppContext()
  const hasUnreadChat = Object.values(chatState || {}).some(chat => chat.unread > 0)

  return (
    <nav aria-label="Tabs" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
      backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderTop: '0.5px solid var(--border)',
      display: 'flex', justifyContent: 'center',
      paddingTop: 4, paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
    }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'space-around' }}>
        {NAV_ITEMS.map(({ to, label, Icon, fillActive }) => {
          const active = location.pathname === to || (to !== '/feed' && location.pathname.startsWith(to))
          return (
            <button
              key={to}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              data-tour={`tab-${to.slice(1)}`}
              onClick={() => {
                if (location.pathname === to) {
                  if (to === '/feed') requestHomeReset()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                navigate(to)
              }}
              style={{
                flex: 1, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
                color: active ? 'var(--textDark)' : 'var(--textLight)',
              }}
            >
              <Icon size={26} strokeWidth={active ? 2.3 : 1.8} fill={active && fillActive ? 'currentColor' : 'none'} />
              {to === '/chat' && hasUnreadChat && (
                <span style={{
                  position: 'absolute', top: 10, left: 'calc(50% + 8px)', width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--accent)', boxShadow: '0 0 0 2px var(--bg)',
                }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ── "+" in the top bar: set your free-now status, or see it when it's live ── */
function StatusButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAppContext()
  const status = useMyStatus()
  return (
    <button
      type="button"
      data-tour="status"
      aria-label={status ? `Your status: ${status.activity}` : 'Set your status'}
      onClick={() => {
        if (location.pathname !== '/feed') navigate('/feed')
        requestOpenStatus()
      }}
      style={{
        width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--textDark)',
      }}
    >
      {status
        ? <Avatar person={currentUser} size={24} ring />
        : (
          <span style={{
            width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--textDark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Plus size={18} strokeWidth={2.6} /></span>
        )}
    </button>
  )
}

/* ── Top bar: wordmark left; battery ring and bell right ── */
function TopNav() {
  const { notifications } = useAppContext()
  const hasUnread = notifications.some(n => !n.isRead)
  const navigate = useNavigate()
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
      backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      display: 'flex', justifyContent: 'center',
      padding: 'max(8px, env(safe-area-inset-top)) 8px 4px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48 }}>
        <button type="button" onClick={() => { requestHomeReset(); navigate('/feed') }} aria-label="Third Space home" style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-display)',
          fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--textDark)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="28" height="28" viewBox="0 0 56 56" fill="none" aria-hidden="true">
            <circle cx="22" cy="28" r="14" stroke="currentColor" strokeWidth="4" />
            <circle cx="34" cy="28" r="14" stroke="currentColor" strokeWidth="4" />
          </svg>
          <span>third space<span style={{ color: 'var(--accent)' }}>.</span></span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusButton />
          <BatteryWidget />
          <button type="button" onClick={() => navigate('/notifications')} aria-label="Notifications" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', color: 'var(--textDark)',
          }}>
            <Bell size={25} strokeWidth={1.9} />
            {hasUnread && <span style={{
              position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', boxShadow: '0 0 0 2px var(--bg)',
            }} />}
          </button>
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
const SELF_HEADED = ['/chat/', '/game/', '/circles/']

function ShellLayout() {
  return (
    <>
      <AppShell
        tabElements={TAB_ELEMENTS}
        pushedRoutes={PUSHED_ROUTES}
        selfHeadedPrefixes={SELF_HEADED}
        lockedPrefixes={['/chat/', '/game/']}
        topNav={<TopNav />}
        bottomNav={<BottomNav />}
        extras={<><PushPrompt /><AppTour /></>}
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

// Deep-link bookkeeping lives outside React so remounts can't replay it (J7).
let launchUrlHandled = false
let lastDeepLink = { url: null, at: 0 }

/* ── Root app ── */
function App() {
  const { authLoading, session, currentlyOpenChatId } = useAppContext()
  // Stable across route changes, so the listener effects below run once (J7).
  const navigate = useStableNavigate()
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
        if (type === 'daily_question') { navigate(data.chatId ? `/chat/${data.chatId}` : '/chat'); return }
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
      // The same link can arrive from both getLaunchUrl and appUrlOpen.
      const now = Date.now()
      if (lastDeepLink.url === raw && now - lastDeepLink.at < 3000) return
      lastDeepLink = { url: raw, at: now }
      navigate(`${path}${u.search}${u.hash}`)
    }

    let remove = () => {}
    import('@capacitor/app').then(({ App: CapApp }) => {
      // The launch URL belongs to this process start, not to every mount.
      if (!launchUrlHandled) {
        launchUrlHandled = true
        CapApp.getLaunchUrl().then(res => routeFromUrl(res?.url)).catch(() => {})
      }
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
      {/* Shared links (plan Part 4, Layer A) */}
      <Route path="/e/:id" element={<ShareLanding type="event" />} />
      <Route path="/s/:id" element={<ShareLanding type="checkin" />} />
      <Route path="/p/:id" element={<PollLanding />} />
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