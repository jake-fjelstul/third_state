import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { redeemInviteCode } from '../lib/invites.js'
import { supabase } from '../lib/supabase.js'

const PENDING_JOIN_KEY = 'ts.pendingJoinCode'

export default function JoinLanding() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { session, refreshConnections } = useAppContext()
  const [status, setStatus] = useState('checking')
  const [targetName, setTargetName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code) {
      navigate('/feed', { replace: true })
      return
    }

    let cancelled = false

    // Fetch public preview info before auth check
    supabase
      .from('invites')
      .select('*, circles(name)')
      .eq('code', code)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        if (data.circles?.name) {
          setTargetName(`Joining ${data.circles.name}...`)
        } else if (data.kind === 'personal') {
          setTargetName('Connecting...')
        }
      })
      .catch(() => {})

    if (!session?.user) {
      try { window.localStorage.setItem(PENDING_JOIN_KEY, code) } catch {}
      setStatus('redirecting')
      navigate('/auth?invited=1', { replace: true })
      return () => { cancelled = true }
    }

    setStatus('redeeming')
    redeemInviteCode(code)
      .then(async (res) => {
        try { window.localStorage.removeItem(PENDING_JOIN_KEY) } catch {}
        if (refreshConnections) await refreshConnections().catch(() => {})
        if (cancelled) return

        setStatus('done')
        const targetUrl = res?.circle_id
          ? `/circles/${res.circle_id}`
          : '/feed?invited=1'

        if (res?.self) {
          navigate(targetUrl, { replace: true })
        } else {
          window.setTimeout(() => navigate(targetUrl, { replace: true }), 600)
        }
      })
      .catch((err) => {
        console.error('[JoinLanding] redeemInviteCode failed', err)
        if (cancelled) return
        setErrorMsg(err.message || 'Could not redeem invite')
        setStatus('error')
        window.setTimeout(() => navigate('/feed', { replace: true }), 2500)
      })

    return () => { cancelled = true }
  }, [code, session, navigate, refreshConnections])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        {status === 'checking' && <p>{targetName || 'Checking invite code...'}</p>}
        {status === 'redirecting' && <p>Sign in or sign up to join.</p>}
        {status === 'redeeming' && <p>{targetName || 'Activating your invite...'}</p>}
        {status === 'done' && <p>You're in! Redirecting...</p>}
        {status === 'error' && <p style={{ color: '#DC2626' }}>{errorMsg}</p>}
      </div>
    </div>
  )
}
