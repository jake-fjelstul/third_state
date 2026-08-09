import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../lib/api'

export function AuthGate({ children }) {
  const [authState, setAuthState] = useState('checking') // 'checking' | 'signed-out' | 'denied' | 'allowed'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const verifyAdminStatus = async () => {
    setAuthState('checking')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAuthState('signed-out')
        return
      }

      const admin = await isAdmin()
      if (admin) {
        setAuthState('allowed')
      } else {
        await supabase.auth.signOut()
        setAuthState('denied')
      }
    } catch {
      setAuthState('signed-out')
    }
  }

  useEffect(() => {
    verifyAdminStatus()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        try {
          const admin = await isAdmin()
          if (admin) {
            setAuthState('allowed')
          } else {
            await supabase.auth.signOut()
            setAuthState('denied')
          }
        } catch {
          await supabase.auth.signOut()
          setAuthState('denied')
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthState('signed-out')
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setPending(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setErrorMsg("That email and password don't match.")
        } else {
          setErrorMsg("Couldn't reach the server. Try again.")
        }
        setPending(false)
        return
      }

      if (data?.session) {
        const admin = await isAdmin()
        if (admin) {
          setAuthState('allowed')
        } else {
          await supabase.auth.signOut()
          setErrorMsg("This account doesn't have admin access.")
          setAuthState('denied')
        }
      }
    } catch {
      setErrorMsg("Couldn't reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  const handleUseDifferentAccount = async () => {
    await supabase.auth.signOut()
    setAuthState('signed-out')
    setErrorMsg(null)
  }

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-4">
        <div className="font-mono text-[11px] font-medium tracking-[0.14em] text-faint uppercase animate-pulse">
          Authenticating…
        </div>
      </div>
    )
  }

  if (authState === 'denied') {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-4">
        <div className="w-full max-w-[380px] bg-panel border border-line rounded-xl p-8 text-center space-y-4">
          <div className="font-mono text-[11px] font-medium tracking-[0.14em] text-faint uppercase">
            THIRD SPACE
          </div>
          <h1 className="font-display font-bold text-24px md:text-[24px] text-text">
            No access
          </h1>
          <p className="font-body text-sm text-muted">
            This account doesn't have admin access.
          </p>
          <button
            type="button"
            onClick={handleUseDifferentAccount}
            className="font-body text-sm font-medium text-indigo hover:underline pt-2"
          >
            Use a different account
          </button>
        </div>
      </div>
    )
  }

  if (authState === 'signed-out') {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-4">
        <div className="w-full max-w-[380px] space-y-6">
          <div>
            <div className="font-mono text-[11px] font-medium tracking-[0.14em] text-faint uppercase mb-1">
              THIRD SPACE
            </div>
            <h1 className="font-display font-bold text-28px md:text-[28px] text-text mb-2">
              Admin
            </h1>
            <p className="font-body text-sm text-muted">
              Sign in with your admin account.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] font-medium tracking-[0.14em] text-faint uppercase mb-2">
                EMAIL
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 bg-panel border border-line rounded-lg px-3.5 text-text font-body text-sm focus:outline-none focus:border-indigo"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-medium tracking-[0.14em] text-faint uppercase mb-2">
                PASSWORD
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 bg-panel border border-line rounded-lg px-3.5 text-text font-body text-sm focus:outline-none focus:border-indigo"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-11 bg-indigo text-text font-body font-medium text-sm rounded-lg hover:bg-indigo/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>

            {errorMsg && (
              <p className="font-body text-sm text-rose pt-1">
                {errorMsg}
              </p>
            )}
          </form>
        </div>
      </div>
    )
  }

  return children
}
