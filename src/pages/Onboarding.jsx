import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, Coffee, Heart, Compass, MapPin } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
 
const STEPS = ['What brings you to Third Space?', 'Pick your interests', 'Your profile']
 
const MODES = [
  { id: 'professional', label: 'Professional Networking', subtitle: 'Build your career' },
  { id: 'coffee',       label: 'Coffee Chats',            subtitle: 'Meet for coffee'   },
  { id: 'social',       label: 'Social Life',             subtitle: 'Grow your circle'  },
  { id: 'activity',     label: 'Activity Partners',       subtitle: 'Find a hobbyist'   },
  { id: 'new-town',     label: 'New in Town',             subtitle: 'Discover the city' },
]
 
const INTERESTS = [
  'Rock Climbing','Hiking','Coffee','Startups','Photography','Chess',
  'Running','Yoga','Book Club','Tech','Art','Cooking','Music','Travel','Film','Gaming',
]
 
const MODE_ICONS = {
  professional: BriefcaseBusiness,
  coffee:       Coffee,
  social:       Heart,
  activity:     Compass,
  'new-town':   MapPin,
}
 
/* ── tiny helpers ── */
const clr = {
  bg:        '#F0EFE9',   // warm off-white that matches the screenshot exactly
  white:     '#FFFFFF',
  indigo:    '#5B5FEF',
  indigoLt:  '#EEEEFF',
  textDark:  '#1A1A2E',
  textMid:   '#64748B',
  textLight: '#A0AEC0',
  border:    '#E8E8E8',
}
 
function Logo() {
  return (
    <svg width="48" height="48" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
      <circle cx="34" cy="28" r="14" stroke={clr.indigo} strokeWidth="3.5" fill="none"/>
    </svg>
  )
}
 
function StepIndicator({ step }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
      {[0,1,2].map((i) => (
        <React.Fragment key={i}>
          <div style={{
            width:  i === step ? 10 : 8,
            height: i === step ? 10 : 8,
            borderRadius: '50%',
            backgroundColor: i === step ? clr.indigo : '#C8C8D8',
            boxShadow: i === step ? `0 0 0 3px ${clr.indigoLt}` : 'none',
            transition: 'all 0.25s ease',
          }}/>
          {i < 2 && (
            <div style={{ width:24, height:2, backgroundColor:'#DDDDE8', borderRadius:1 }}/>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
 
function Onboarding() {
  const navigate = useNavigate()
  const { completeOnboarding } = useAppContext()
  const [step, setStep] = useState(0)
  const [selectedModes, setSelectedModes] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])
  const [profile, setProfile] = useState({ name:'', age:'', city:'', bio:'' })
 
  const toggleMode     = (id)    => setSelectedModes(p     => p.includes(id)    ? p.filter(v=>v!==id)    : [...p,id])
  const toggleInterest = (label) => setSelectedInterests(p => p.includes(label) ? p.filter(v=>v!==label) : [...p,label])
 
  const canContinue =
    (step === 0 && selectedModes.length > 0) ||
    (step === 1 && selectedInterests.length > 0) ||
    (step === 2 && profile.name.trim() && profile.city.trim())
 
  const handleNext = () => { if (step < 2 && canContinue) setStep(s => s+1) }
  const handleBack = () => { if (step > 0) setStep(s => s-1) }
 
  const finish = () => {
    if (!canContinue) return
    completeOnboarding({
      name: profile.name.trim(),
      age:  profile.age ? Number(profile.age) : undefined,
      city: profile.city.trim(),
      bio:  profile.bio.trim(),
      intents:   MODES.filter(m => selectedModes.includes(m.id)).map(m => m.label),
      interests: selectedInterests,
    })
    navigate('/feed', { replace: true })
  }
 
  const skip = () => { completeOnboarding({}); navigate('/feed', { replace: true }) }
 
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
 
  const cardStyle = (active) => ({
    width: '100%',
    backgroundColor: clr.white,
    borderRadius: 20,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    border: active ? `2px solid ${clr.indigo}` : `2px solid transparent`,
    boxShadow: active
      ? `0 4px 20px rgba(91,95,239,0.18)`
      : `0 2px 12px rgba(0,0,0,0.06)`,
    transition: 'all 0.2s ease',
    outline: 'none',
  })
 
  const iconCircleStyle = (active) => ({
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor: active ? clr.indigo : clr.indigoLt,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    transition: 'background-color 0.2s ease',
  })
 
  const primaryBtnStyle = (disabled) => ({
    width: '100%',
    padding: '16px 0',
    borderRadius: 999,
    border: 'none',
    background: disabled
      ? '#CBD5E1'
      : `linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 100%)`,
    color: '#FFFFFF',
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
 
        {/* Step dots */}
        <div style={{ marginBottom: 28 }}>
          <StepIndicator step={step} />
        </div>
 
        {/* Heading */}
        <div style={{ textAlign:'center', marginBottom: 28, width:'100%' }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            color: clr.textDark,
            lineHeight: 1.25,
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}>
            {STEPS[step]}
          </h1>
          <p style={{ fontSize:15, color: clr.textMid, margin:0 }}>
            {step === 0 && "We'll personalize your experience."}
            {step === 1 && "Choose a few interests to find better circles."}
            {step === 2 && "Let people know who you are."}
          </p>
        </div>
 
        {/* ── STEP 0: Mode cards ── */}
        {step === 0 && (
          <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:16, marginBottom:32 }}>
            {MODES.map((mode) => {
              const Icon   = MODE_ICONS[mode.id]
              const active = selectedModes.includes(mode.id)
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => toggleMode(mode.id)}
                  style={cardStyle(active)}
                >
                  <div style={iconCircleStyle(active)}>
                    <Icon
                      size={26}
                      strokeWidth={1.75}
                      color={active ? '#FFFFFF' : clr.indigo}
                    />
                  </div>
                  <span style={{ fontSize:17, fontWeight:700, color: clr.textDark, display:'block' }}>
                    {mode.label}
                  </span>
                  <span style={{ fontSize:13, color: clr.textMid, marginTop:4, display:'block' }}>
                    {mode.subtitle}
                  </span>
                </button>
              )
            })}
          </div>
        )}
 
        {/* ── STEP 1: Interest chips ── */}
        {step === 1 && (
          <div style={{ width:'100%', marginBottom:32 }}>
            <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:10 }}>
              {INTERESTS.map((label) => {
                const active = selectedInterests.includes(label)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleInterest(label)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 999,
                      border: `1.5px solid ${active ? clr.indigo : clr.border}`,
                      backgroundColor: active ? clr.indigoLt : clr.white,
                      color: active ? clr.indigo : '#475569',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      boxShadow: active ? `0 2px 8px rgba(91,95,239,0.15)` : 'none',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
 
        {/* ── STEP 2: Profile form ── */}
        {step === 2 && (
          <div style={{ width:'100%', marginBottom:32, display:'flex', flexDirection:'column', gap:16 }}>
            {/* Avatar upload */}
            <div style={{
              backgroundColor: clr.white,
              borderRadius: 20,
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
            }}>
              <div style={{
                width:80, height:80, borderRadius:'50%',
                backgroundColor: clr.indigoLt,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28, fontWeight:700, color: clr.indigo,
                marginBottom:12,
              }}>
                {profile.name ? profile.name[0].toUpperCase() : 'A'}
              </div>
              <p style={{ fontSize:15, fontWeight:700, color: clr.textDark, margin:'0 0 4px 0' }}>
                Add a friendly face
              </p>
              <p style={{ fontSize:13, color: clr.textMid, textAlign:'center', margin:'0 0 16px 0' }}>
                You can upload a photo later.
              </p>
              <button type="button" style={{
                padding:'8px 20px', borderRadius:999,
                border:`1.5px solid ${clr.border}`,
                backgroundColor: clr.white,
                fontSize:13, fontWeight:500, color:'#475569', cursor:'pointer',
              }}>
                Upload photo
              </button>
            </div>
 
            {/* Form fields */}
            <div style={{
              backgroundColor: clr.white,
              borderRadius: 20,
              padding: '24px',
              boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
              display:'flex', flexDirection:'column', gap:16,
            }}>
              {[
                { label:'Name',  key:'name', type:'text',   placeholder:'Alex Rivera' },
                { label:'Age',   key:'age',  type:'number', placeholder:'29'          },
                { label:'City',  key:'city', type:'text',   placeholder:'Austin, TX'  },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={profile[key]}
                    onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      width:'100%', boxSizing:'border-box',
                      padding:'12px 16px', borderRadius:12,
                      border:`1.5px solid ${clr.border}`,
                      fontSize:15, color: clr.textDark,
                      outline:'none', transition:'border-color 0.2s',
                      fontFamily:'inherit',
                    }}
                    onFocus={e  => e.target.style.borderColor = clr.indigo}
                    onBlur={e   => e.target.style.borderColor = clr.border}
                  />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#475569', marginBottom:6 }}>
                  Short bio
                </label>
                <textarea
                  rows={4}
                  value={profile.bio}
                  onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Share a few lines about what you're into..."
                  style={{
                    width:'100%', boxSizing:'border-box',
                    padding:'12px 16px', borderRadius:12,
                    border:`1.5px solid ${clr.border}`,
                    fontSize:15, color: clr.textDark,
                    outline:'none', resize:'none',
                    transition:'border-color 0.2s',
                    fontFamily:'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>
            </div>
          </div>
        )}
 
        {/* Continue button */}
        <div style={{ width:'100%', marginBottom:12 }}>
          <button
            type="button"
            onClick={step < 2 ? handleNext : finish}
            disabled={!canContinue}
            style={primaryBtnStyle(!canContinue)}
          >
            {step < 2 ? 'Continue' : 'Finish & Explore'}
          </button>
        </div>
 
        {/* Back / Skip */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          {step > 0 && (
            <button type="button" onClick={handleBack} style={{
              background:'none', border:'none', cursor:'pointer',
              fontSize:14, fontWeight:500, color: clr.textLight, padding:'8px 0',
            }}>
              Go Back
            </button>
          )}
          {step === 0 && (
            <button type="button" onClick={skip} style={{
              background:'none', border:'none', cursor:'pointer',
              fontSize:13, color: clr.textLight, padding:'8px 0',
            }}>
              Skip for now
            </button>
          )}
        </div>
 
      </div>
    </div>
  )
}
 
export default Onboarding
