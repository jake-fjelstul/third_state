import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useEffect } from 'react'
import { useAppContext } from './context/AppContext.jsx'
import OnboardingPage    from './pages/Onboarding.jsx'
import FeedPage          from './pages/Feed.jsx'
import CirclesPage       from './pages/Circles.jsx'
import CircleDetailPage  from './pages/CircleDetail.jsx'
import SchedulePage      from './pages/Schedule.jsx'
import ChatPage          from './pages/Chat.jsx'
import ChatThreadPage    from './pages/ChatThread.jsx'
import ProfilePage       from './pages/Profile.jsx'
 
const clr = {
  bg:       '#F0F0F5',
  white:    '#FFFFFF',
  indigo:   '#5B5FEF',
  indigoLt: '#EEEEFF',
  textDark: '#1A1A2E',
  textMid:  '#6B7280',
  textLight:'#9CA3AF',
  border:   '#E8E8EE',
}
 
/* ── SVG icons (no lucide dependency in shell) ── */
const Icons = {
  Home: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Circles: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Schedule: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Chat: ({ active }) => (
    <svg width="22" height="22" fill={active ? clr.indigo : 'none'} stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Profile: ({ active }) => (
    <svg width="22" height="22" fill="none" stroke={active ? clr.indigo : clr.textLight} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
}
 
const NAV_ITEMS = [
  { to: '/feed',     label: 'Home',     Icon: Icons.Home     },
  { to: '/circles',  label: 'Circles',  Icon: Icons.Circles  },
  { to: '/schedule', label: 'Schedule', Icon: Icons.Schedule },
  { to: '/chat',     label: 'Chat',     Icon: Icons.Chat     },
  { to: '/profile',  label: 'Profile',  Icon: Icons.Profile  },
]
 
/* ── Bottom tab bar — always fixed ── */
function BottomNav() {
  const location = useNavigate ? useLocation() : { pathname: '' }
  const navigate  = useNavigate()
 
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 100,
      backgroundColor: clr.white,
      borderTop: `1px solid ${clr.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '10px 0 max(10px, env(safe-area-inset-bottom))',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
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
            }}/>
          </button>
        )
      })}
    </nav>
  )
}
 
/* ── Desktop sidebar ── */
function Sidebar() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { currentUser } = useAppContext()
 
  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: 220,
      backgroundColor: clr.white,
      borderRight: `1px solid ${clr.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '28px 16px',
      zIndex: 50,
      boxShadow: '2px 0 20px rgba(0,0,0,0.04)',
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32, padding:'0 8px' }}>
        <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
          <circle cx="22" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
          <circle cx="34" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
        </svg>
        <div>
          <p style={{ fontSize:14, fontWeight:800, color: clr.textDark, margin:0 }}>Third Space</p>
          <p style={{ fontSize:11, color: clr.textLight, margin:0 }}>Meet your people, IRL.</p>
        </div>
      </div>
 
      {/* Nav links */}
      <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const active = location.pathname === to ||
            (to !== '/feed' && location.pathname.startsWith(to))
          return (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 14,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                backgroundColor: active ? clr.indigoLt : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Icon active={active} />
              <span style={{
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? clr.indigo : clr.textMid,
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>
 
      {/* Create Circle CTA */}
      <button type="button" style={{
        width:'100%', padding:'11px 0', borderRadius:999, border:'none',
        background:`linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
        color:'#FFFFFF', fontSize:13, fontWeight:700, cursor:'pointer',
        boxShadow:'0 4px 14px rgba(91,95,239,0.3)',
        marginBottom:16,
      }}>
        + Create Circle
      </button>
 
      {/* User card */}
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        backgroundColor:'#F7F7FB', borderRadius:14, padding:'10px 12px',
      }}>
        <img
          src={currentUser.avatar} alt={currentUser.name}
          style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}
        />
        <div style={{ minWidth:0 }}>
          <p style={{ fontSize:13, fontWeight:700, color: clr.textDark, margin:0,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {currentUser.name}
          </p>
          <p style={{ fontSize:11, color: clr.textLight, margin:0 }}>{currentUser.city}</p>
        </div>
      </div>
    </aside>
  )
}
 
/* ── Shell layout wrapping all authenticated pages ── */
function ShellLayout() {
  return (
    <>
      {/* Desktop sidebar — hidden on mobile via media query trick using visibility */}
      <div style={{ display:'none' }} className="desktop-sidebar-wrapper">
        <Sidebar />
      </div>
 
      {/* Page content — padded so it doesn't hide under fixed nav */}
      <div style={{
        minHeight: '100vh',
        paddingBottom: 80, /* space for bottom tab bar */
        backgroundColor: clr.bg,
      }}>
        <Outlet />
      </div>
 
      {/* Bottom tab bar — always visible */}
      <BottomNav />
 
      {/* Inline responsive style to show sidebar on large screens */}
      <style>{`
        @media (min-width: 1024px) {
          .desktop-sidebar-wrapper {
            display: block !important;
          }
          /* push content right of sidebar */
          .desktop-sidebar-wrapper ~ div {
            margin-left: 220px;
          }
        }
        /* hide bottom nav on large screens */
        @media (min-width: 1024px) {
          nav[data-bottomnav] {
            display: none !important;
          }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>
    </>
  )
}
 
/* ── Onboarding guard ── */
function OnboardingGuard() {
  const { onboardingComplete } = useAppContext()
  const location = useLocation()
 
  useEffect(() => {}, [location.pathname])
 
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
          <Route path="/feed"         element={<FeedPage />}         />
          <Route path="/circles"      element={<CirclesPage />}      />
          <Route path="/circles/:id"  element={<CircleDetailPage />} />
          <Route path="/schedule"     element={<SchedulePage />}     />
          <Route path="/chat"         element={<ChatPage />}         />
          <Route path="/chat/:id"     element={<ChatThreadPage />}   />
          <Route path="/profile"      element={<ProfilePage />}      />
        </Route>
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Route>
    </Routes>
  )
}
 
export default App