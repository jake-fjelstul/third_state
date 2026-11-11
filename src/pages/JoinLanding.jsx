import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStableNavigate } from '../lib/useStableNavigate.js'
import { useAppContext } from '../context/AppContext.jsx'
import { previewInvite, redeemInviteCode } from '../lib/invites.js'

const PENDING_JOIN_KEY = 'ts.pendingJoinCode'

export default function JoinLanding() {
  const { code } = useParams()
  const navigate = useStableNavigate()
  const { session, authLoading, refreshConnections } = useAppContext()
  const userId = session?.user?.id || null
  const redeemedRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const [status, setStatus] = useState('checking')
  const [targetName, setTargetName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code) {
      navigate('/feed', { replace: true })
      return
    }

    let cancelled = false

    // Public preview of this one code (works signed out)
    previewInvite(code)
      .then((data) => {
        if (cancelled || !data) return
        if (data.circle_name) {
          setTargetName(`Joining ${data.circle_name}...`)
        } else if (data.kind === 'personal') {
          setTargetName(data.inviter_name ? `Connecting with ${data.inviter_name}...` : 'Connecting...')
        }
      })
      .catch((err) => console.error('[JoinLanding] previewInvite failed', err))

    // Wait for the session to restore before deciding we're signed out.
    if (authLoading) return () => { cancelled = true }

    if (!userId) {
      try { window.localStorage.setItem(PENDING_JOIN_KEY, code) } catch {}
      setStatus('redirecting')
      navigate('/auth?invited=1', { replace: true })
      return () => { cancelled = true }
    }

    // Token refreshes re-run this effect; redeem only once.
    if (redeemedRef.current) return () => { cancelled = true }
    redeemedRef.current = true

    // Already redeemed this code in this app session (e.g. the link was
    // delivered twice): go straight to where it led last time (J7).
    let remembered = null
    try { remembered = window.sessionStorage.getItem(`ts.redeemed.${code}`) } catch { /* private mode */ }
    if (remembered) {
      navigate(remembered, { replace: true })
      return () => { cancelled = true }
    }

    setStatus('redeeming')
    redeemInviteCode(code)
      .then(async (res) => {
        try { window.localStorage.removeItem(PENDING_JOIN_KEY) } catch {}
        if (refreshConnections) await refreshConnections().catch(() => {})
        if (!mountedRef.current) return

        setStatus('done')
        const targetUrl = res?.circle_id
          ? `/circles/${res.circle_id}`
          : '/feed?invited=1'
        try { window.sessionStorage.setItem(`ts.redeemed.${code}`, targetUrl) } catch { /* private mode */ }

        if (res?.self) {
          navigate(targetUrl, { replace: true })
        } else {
          window.setTimeout(() => navigate(targetUrl, { replace: true }), 600)
        }
      })
      .catch((err) => {
        console.error('[JoinLanding] redeemInviteCode failed', err)
        if (!mountedRef.current) return
        setErrorMsg(err.message || 'Could not redeem invite')
        setStatus('error')
        window.setTimeout(() => navigate('/feed', { replace: true }), 2500)
      })

    return () => { cancelled = true }
  }, [code, userId, authLoading, navigate, refreshConnections])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 'var(--safe-top) 24px var(--safe-bottom)' }}>
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
