import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity,
  TrendingUp,
  UserPlus,
  Users,
  Calendar,
  Link2,
  Flag,
  LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Shell({ children }) {
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email)
      }
    })
  }, [])

  const handleSignOut = () => {
    supabase.auth.signOut()
  }

  const navItems = [
    { path: '/', label: 'Overview', icon: Activity },
    { path: '/growth', label: 'Growth', icon: TrendingUp },
    { path: '/onboarding', label: 'Onboarding', icon: UserPlus },
    { path: '/circles', label: 'Circles', icon: Users },
    { path: '/events', label: 'Events', icon: Calendar },
    { path: '/connections', label: 'Connections', icon: Link2 },
    { path: '/moderation', label: 'Moderation', icon: Flag },
  ]

  return (
    <div className="min-h-screen bg-ink flex">
      {/* Left rail */}
      <aside className="fixed top-0 left-0 bottom-0 z-30 w-[64px] min-[900px]:w-[220px] bg-panel border-r border-line flex flex-col transition-all duration-200">
        {/* Top Header */}
        <div className="p-4 min-[900px]:p-6 border-b border-line flex flex-col justify-center">
          <div className="font-display font-semibold text-[15px] text-text leading-tight hidden min-[900px]:block">
            Third Space
          </div>
          <div className="font-mono text-[11px] font-medium tracking-[0.14em] text-indigo uppercase hidden min-[900px]:block">
            ADMIN
          </div>
          <div className="font-display font-bold text-sm text-indigo min-[900px]:hidden text-center">
            TS
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `relative flex items-center h-10 px-4 transition-colors group ${
                    isActive
                      ? 'text-text bg-raised'
                      : 'text-muted hover:text-text hover:bg-raised/50'
                  }`
                }
                title={item.label}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo" />
                    )}
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="ml-3 font-body text-[13px] font-medium hidden min-[900px]:inline">
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom Rail User & Sign out */}
        <div className="p-4 border-t border-line space-y-2">
          <div className="font-mono text-[11px] text-faint truncate hidden min-[900px]:block" title={userEmail}>
            {userEmail}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center text-muted hover:text-text font-body text-xs transition-colors w-full"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0 min-[900px]:mr-2" />
            <span className="hidden min-[900px]:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <main className="flex-1 ml-[64px] min-[900px]:ml-[220px] min-h-screen p-6 min-[900px]:p-8 max-w-[1400px]">
        {children}
      </main>
    </div>
  )
}
