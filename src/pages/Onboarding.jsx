import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'

/* ── tiny helpers ── */
const clr = {
  bg:        'var(--bg)',   // warm off-white that matches the screenshot exactly
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

function Onboarding() {
  const navigate = useNavigate()
  const { completeOnboarding } = useAppContext()
  const [profile, setProfile] = useState({ name:'', age:'', city:'' })

  const canContinue = profile.name.trim() && profile.city.trim()

  const finish = () => {
    if (!canContinue) return
    completeOnboarding({
      name: profile.name.trim(),
      age:  profile.age ? Number(profile.age) : undefined,
      city: profile.city.trim(),
      intents:   [],
      interests: [],
    })
    navigate('/feed', { replace: true })
  }

  const skip = () => { completeOnboarding({}); navigate('/feed', { replace: true }) }

  const handleUseLocation = () => {
    // Basic placeholder handling or real if navigator.geolocation was robust.
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          // Fake reverse geocoding to keep it simple and immediate
          setProfile(p => ({ ...p, city: 'San Francisco, CA' }))
        },
        () => {
          setProfile(p => ({ ...p, city: 'San Francisco, CA' }))
        }
      )
    } else {
      setProfile(p => ({ ...p, city: 'San Francisco, CA' }))
    }
  }

  /* ── shared styles ── */
  const pageStyle = {
    minHeight: '100vh',
    width: '100%',
    backgroundColor: clr.bg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 48,
    paddingLeft: 20,
    paddingRight: 20,
    fontFamily: "'DM Sans', 'Inter', sans-serif",
  }

  const wrapStyle = {
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
  }

  const primaryBtnStyle = (disabled) => ({
    width: '100%',
    padding: '16px 0',
    borderRadius: 999,
    border: 'none',
    background: disabled
      ? clr.indigoLt
      : `linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 100%)`,
    color: disabled ? clr.indigo : '#FFFFFF',
    fontSize: 16,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : `0 8px 24px rgba(91,95,239,0.38)`,
    transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
  })

  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>

        {/* Logo */}
        <div style={{ marginBottom: 12 }}>
          <Logo />
        </div>

        {/* Heading */}
        <div style={{ textAlign:'center', marginBottom: 32, width:'100%' }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            color: clr.textDark,
            lineHeight: 1.25,
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}>
            Join Third Space
          </h1>
          <p style={{ fontSize:15, color: clr.textMid, margin:0 }}>
            Find your people, show up IRL.
          </p>
        </div>

        {/* ── Form fields ── */}
        <div style={{
          width:'100%', marginBottom:32, display:'flex', flexDirection:'column', gap:16,
          backgroundColor: clr.white,
          borderRadius: 20,
          padding: '24px',
          boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
        }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>
              Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="Alex Rivera"
              style={{
                width:'100%', boxSizing:'border-box',
                padding:'12px 16px', borderRadius:12,
                border:`1.5px solid ${clr.border}`,
                backgroundColor: clr.bg,
                fontSize:15, color: clr.textDark,
                outline:'none', transition:'border-color 0.2s',
                fontFamily:'inherit',
              }}
              onFocus={e  => e.target.style.borderColor = clr.indigo}
              onBlur={e   => e.target.style.borderColor = clr.border}
            />
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>
              Age
            </label>
            <input
              type="number"
              value={profile.age}
              onChange={e => setProfile(p => ({ ...p, age: e.target.value }))}
              placeholder="29"
              style={{
                width:'100%', boxSizing:'border-box',
                padding:'12px 16px', borderRadius:12,
                border:`1.5px solid ${clr.border}`,
                backgroundColor: clr.bg,
                fontSize:15, color: clr.textDark,
                outline:'none', transition:'border-color 0.2s',
                fontFamily:'inherit',
              }}
              onFocus={e  => e.target.style.borderColor = clr.indigo}
              onBlur={e   => e.target.style.borderColor = clr.border}
            />
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>
              City
            </label>
            <input
              type="text"
              value={profile.city}
              onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
              placeholder="Austin, TX"
              style={{
                width:'100%', boxSizing:'border-box',
                padding:'12px 16px', borderRadius:12,
                border:`1.5px solid ${clr.border}`,
                backgroundColor: clr.bg,
                fontSize:15, color: clr.textDark,
                outline:'none', transition:'border-color 0.2s',
                fontFamily:'inherit',
              }}
              onFocus={e  => e.target.style.borderColor = clr.indigo}
              onBlur={e   => e.target.style.borderColor = clr.border}
            />
            <button
              type="button"
              onClick={handleUseLocation}
              style={{
                marginTop: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: clr.indigo,
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0'
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              Use my location
            </button>
          </div>
        </div>

        {/* Continue button */}
        <div style={{ width:'100%', marginBottom:16 }}>
          <button
            type="button"
            onClick={finish}
            disabled={!canContinue}
            style={primaryBtnStyle(!canContinue)}
          >
            Let's Go →
          </button>
        </div>

        {/* Skip */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <button type="button" onClick={skip} style={{
            background:'none', border:'none', cursor:'pointer',
            fontSize:14, fontWeight: 500, color: clr.textLight, padding:'8px 0',
          }}>
            Skip for now
          </button>
        </div>

      </div>
    </div>
  )
}

export default Onboarding
