import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUp, signIn, resetPassword, signInWithGoogle } from '../lib/auth'

const clr = {
  bg:        'var(--bg)',
  white:     'var(--white)',
  indigo:    'var(--indigo)',
  indigoLt:  'var(--indigoLt)',
  textDark:  'var(--textDark)',
  textMid:   'var(--textMid)',
  textLight: 'var(--textLight)',
  border:    'var(--border)',
}

function Logo() {
  return (
    <svg width="48" height="48" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
      <circle cx="34" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M255.9 133.5c0-10.8-.9-18.9-2.8-27.3H130.6v48.7h72c-1.5 12.1-9.5 30.3-27.3 42.5l-.2 1.6 39.7 30.8 2.7.3c24.8-22.9 39.4-56.7 39.4-96.6"/>
      <path fill="#34A853" d="M130.6 261.1c35.2 0 64.8-11.6 86.5-31.5l-41.2-31.9c-11 7.7-25.8 13.1-45.3 13.1-34.5 0-63.9-22.8-74.3-54.3l-1.5.1-41.3 32-.5 1.4c21.5 42.6 65.5 71.1 117.6 71.1"/>
      <path fill="#FBBC05" d="M56.3 156.5c-2.7-8.1-4.3-16.7-4.3-25.5s1.6-17.5 4.2-25.5l-.1-1.7-41.8-32.5-1.4.7C4.6 88.4 0 108.7 0 131s4.6 42.6 12.9 59l43.4-33.5"/>
      <path fill="#EB4335" d="M130.6 51.2c24.6 0 41.1 10.6 50.5 19.5l36.9-36C195.3 13.7 165.8 0 130.6 0 78.5 0 34.5 28.5 13 71.1l43.3 33.5c10.5-31.5 39.8-53.4 74.3-53.4"/>
    </svg>
  )
}

function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin', 'signup', 'reset'
  
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in')
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const emailTrimmed = email.trim()

    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Name is required')
        if (!city.trim()) throw new Error('City is required')
        await signUp({
          email: emailTrimmed,
          password,
          name: name.trim(),
          age: age ? Number(age) : undefined,
          city: city.trim(),
        })
        navigate('/feed')
      } else if (mode === 'signin') {
        await signIn({ email: emailTrimmed, password })
        navigate('/feed')
      } else if (mode === 'reset') {
        await resetPassword(emailTrimmed)
        setResetSent(true)
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.')
    } finally {
      setLoading(false)
    }
  }

  const pageStyle = {
    minHeight: '100vh', width: '100%', backgroundColor: clr.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 48, paddingLeft: 20, paddingRight: 20, fontFamily: "'DM Sans', 'Inter', sans-serif",
  }
  const wrapStyle = { width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }
  
  const inputStyle = {
    width:'100%', boxSizing:'border-box', padding:'12px 16px', borderRadius:12, border:`1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize:15, color: clr.textDark, outline:'none', transition:'border-color 0.2s', fontFamily:'inherit',
  }

  const primaryBtnStyle = (disabled) => ({
    width: '100%', padding: '16px 0', borderRadius: 999, border: 'none',
    background: disabled ? clr.indigoLt : `linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 100%)`,
    color: disabled ? clr.indigo : '#FFFFFF', fontSize: 16, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : `0 8px 24px rgba(91,95,239,0.38)`,
    transition: 'all 0.2s ease', letterSpacing: '0.01em',
  })

  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>
        <div style={{ marginBottom: 12 }}>
          <Logo />
        </div>

        <div style={{ textAlign:'center', marginBottom: 32, width:'100%' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, lineHeight: 1.25, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            {mode === 'signin' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h1>
          <p style={{ fontSize:15, color: clr.textMid, margin:0 }}>
            {mode === 'signin' ? 'Sign in to access your Third Space' : mode === 'signup' ? 'Find your people, show up IRL.' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          width:'100%', marginBottom:16, display:'flex', flexDirection:'column', gap:16,
          backgroundColor: clr.white, borderRadius: 20, padding: '24px', boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
        }}>
          {error && <div style={{ color: '#E11D48', fontSize: 14, fontWeight: 600, padding: '12px', backgroundColor: '#FFE4E6', borderRadius: 8 }}>{error}</div>}
          {resetSent && <div style={{ color: '#059669', fontSize: 14, fontWeight: 600, padding: '12px', backgroundColor: '#D1FAE5', borderRadius: 8 }}>Check your email for the reset link!</div>}
          
          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white,
                  color: clr.textDark,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <GoogleIcon /> Continue with Google
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ height: 1, flex: 1, backgroundColor: clr.border }} />
                <span style={{ color: clr.textLight, fontSize: 12, fontWeight: 600 }}>or</span>
                <div style={{ height: 1, flex: 1, backgroundColor: clr.border }} />
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Rivera"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = clr.indigo} onBlur={e => e.target.style.borderColor = clr.border}
                />
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>Age</label>
                <input
                  type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="29"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = clr.indigo} onBlur={e => e.target.style.borderColor = clr.border}
                />
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>City</label>
                <input
                  type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Austin, TX"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = clr.indigo} onBlur={e => e.target.style.borderColor = clr.border}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@example.com"
              style={inputStyle} onFocus={e => e.target.style.borderColor = clr.indigo} onBlur={e => e.target.style.borderColor = clr.border}
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                style={inputStyle} onFocus={e => e.target.style.borderColor = clr.indigo} onBlur={e => e.target.style.borderColor = clr.border}
              />
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <button type="submit" disabled={loading} style={primaryBtnStyle(loading)}>
              {loading ? 'Processing...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
            </button>
          </div>
        </form>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          {mode === 'signin' && (
            <>
              <button type="button" onClick={() => setMode('signup')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight: 500, color: clr.indigo }}>
                Don't have an account? Sign up
              </button>
              <button type="button" onClick={() => setMode('reset')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: 500, color: clr.textLight }}>
                Forgot your password?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" onClick={() => setMode('signin')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight: 500, color: clr.indigo }}>
              Already have an account? Sign in
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" onClick={() => setMode('signin')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight: 500, color: clr.textMid }}>
              Back to sign in
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

export default AuthPage
