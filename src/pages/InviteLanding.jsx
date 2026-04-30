import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { redeemInvite } from '../lib/invites.js'

const PENDING_KEY = 'ts.pendingInviteToken'

export default function InviteLanding() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { session, refreshConnections } = useAppContext()
  const [status, setStatus] = useState('checking')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/feed', { replace: true })
      return
    }

    if (!session?.user) {
      try { window.localStorage.setItem(PENDING_KEY, token) } catch {}
      setStatus('redirecting')
      navigate('/auth?invited=1', { replace: true })
      return
    }

    setStatus('redeeming')
    redeemInvite(token)
      .then(async () => {
        try { window.localStorage.removeItem(PENDING_KEY) } catch {}
        if (refreshConnections) await refreshConnections()
        setStatus('done')
        window.setTimeout(() => navigate('/feed?invited=1', { replace: true }), 600)
      })
      .catch((err) => {
        console.error('[InviteLanding] redeem failed', err)
        setErrorMsg(err.message || 'Could not redeem invite')
        setStatus('error')
        window.setTimeout(() => navigate('/feed', { replace: true }), 2500)
      })
  }, [token, session, navigate, refreshConnections])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        {status === 'checking' && <p>Checking invite...</p>}
        {status === 'redirecting' && <p>Sign in or sign up to accept your invite.</p>}
        {status === 'redeeming' && <p>Activating your invite...</p>}
        {status === 'done' && <p>You're connected! Redirecting...</p>}
        {status === 'error' && <p style={{ color: '#DC2626' }}>{errorMsg}</p>}
      </div>
    </div>
  )
}
