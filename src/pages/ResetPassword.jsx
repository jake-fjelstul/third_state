import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updatePassword } from '../lib/auth'
import { useKeyboardAvoidance } from '../hooks/useKeyboardHeight.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
}

/**
 * Landing page for the password-reset email (H4). On web, supabase-js reads
 * the recovery tokens from the URL itself. On native, the universal-link
 * handler navigates here with the same hash/query, which we apply manually.
 */
export default function ResetPassword() {
  const kbHeight = useKeyboardAvoidance()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const establish = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
        const errDesc = url.searchParams.get('error_description') || hash.get('error_description')
        if (errDesc) throw new Error(errDesc)

        if (code) {
          await supabase.auth.exchangeCodeForSession(code).catch(() => {})
        } else if (hash.get('access_token') && hash.get('refresh_token')) {
          await supabase.auth.setSession({
            access_token: hash.get('access_token'),
            refresh_token: hash.get('refresh_token'),
          })
        }
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (!data?.session) throw new Error('This reset link is invalid or has expired.')
        setReady(true)
      } catch (err) {
        if (!cancelled) setLinkError(err.message || 'This reset link is invalid or has expired.')
      }
    }
    establish()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords don\'t match.'); return }
    setSaving(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/feed', { replace: true }), 1200)
    } catch (err) {
      setError(err.message || 'Could not update your password.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: 12,
    border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 15,
    color: clr.textDark, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: clr.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: `var(--safe-top) 20px calc(var(--safe-bottom) + ${kbHeight}px)`, fontFamily: 'inherit',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: clr.textDark, textAlign: 'center', margin: '0 0 8px' }}>
          Set a new password
        </h1>
        {linkError ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#E11D48', fontSize: 14, fontWeight: 600 }}>{linkError}</p>
            <button type="button" onClick={() => navigate('/auth', { replace: true })}
              style={{ marginTop: 12, border: 'none', borderRadius: 999, padding: '10px 18px', cursor: 'pointer', fontWeight: 700 }}>
              Back to sign in
            </button>
          </div>
        ) : !ready ? (
          <p style={{ textAlign: 'center', color: clr.textMid }}>Checking your link…</p>
        ) : done ? (
          <p style={{ textAlign: 'center', color: '#059669', fontWeight: 700 }}>Password updated. Signing you in…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{
            display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20,
            backgroundColor: clr.white, borderRadius: 20, padding: 24, boxShadow: '0 0 0 1px var(--border)',
          }}>
            {error && <div style={{ color: '#E11D48', fontSize: 14, fontWeight: 600, padding: 12, backgroundColor: '#FFE4E6', borderRadius: 8 }}>{error}</div>}
            <input type="password" autoComplete="new-password" placeholder="New password"
              value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            <input type="password" autoComplete="new-password" placeholder="Confirm new password"
              value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} />
            <button type="submit" disabled={saving} style={{
              width: '100%', padding: '14px 0', borderRadius: 999, border: 'none',
              background: 'var(--indigo)', color: 'var(--on-ink)',
              fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
