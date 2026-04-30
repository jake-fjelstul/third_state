import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileProgressRing } from '../../lib/profileCompleteness.jsx'

const DISMISS_KEY = 'ts.feed.dismissedProfileCard'

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function ProfileCompletionCard({ completeness }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(readDismissed)

  if (completeness.isComplete || dismissed) return null

  const chips = completeness.missing.slice(0, 1)

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        marginBottom: 16,
        backgroundColor: 'var(--white)',
        borderRadius: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--textLight)',
          padding: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div style={{ flexShrink: 0 }}>
        <ProfileProgressRing percent={completeness.percent} size={44} />
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--textDark)', margin: '0 0 2px 0', lineHeight: 1.2 }}>
          Complete your profile
        </h2>
        <p style={{ fontSize: 12, color: 'var(--textMid)', margin: '0 0 6px 0', lineHeight: 1.35 }}>
          Help others find you and get better matches
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {chips.map(({ key, label }) => (
            <span
              key={key}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--indigo)',
                backgroundColor: 'var(--indigoLt)',
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/profile?edit=1')}
        style={{
          flexShrink: 0,
          marginLeft: 2,
          padding: '8px 12px',
          borderRadius: 999,
          border: 'none',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 100%)',
          boxShadow: '0 4px 14px rgba(91,95,239,0.35)',
        }}
      >
        Complete
      </button>
    </div>
  )
}
