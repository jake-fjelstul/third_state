import { avatarFor } from '../../lib/avatar'
import { HelpCircle } from 'lucide-react'

export default function QuestionMessageCard({ clr, payload, viewerId }) {
  if (!payload) return null

  const { variant, questionText, answers = [] } = payload

  return (
    <div style={{
      maxWidth: 300, width: '100%', padding: 14, borderRadius: 16,
      backgroundColor: clr?.white || '#FFFFFF',
      border: `1px solid ${clr?.border || '#E5E7EB'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Question Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <HelpCircle size={14} color={clr?.indigo || '#5B5FEF'} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: clr?.indigo || '#5B5FEF' }}>
          {variant === 'spontaneous' ? 'Connection Question' : 'Daily Question'}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: clr?.textDark || '#1F2937', lineHeight: 1.4 }}>
        {questionText}
      </p>

      {/* Stacked Answers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
        {answers.map((ans, idx) => {
          const isMe = ans.userId === viewerId
          const displayName = isMe ? 'You' : ans.name || 'Connection'
          const avatarUrl = ans.avatar || ''
          const initials = (displayName || '?')[0].toUpperCase()

          return (
            <div key={ans.userId || idx} style={{
              padding: '10px 12px', borderRadius: 12,
              backgroundColor: isMe ? 'var(--indigoLt, #EEF0FF)' : clr?.bg || '#F9FAFB',
              border: `1px solid ${isMe ? 'var(--indigo, #5B5FEF)' : clr?.border || '#E5E7EB'}`,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    backgroundColor: isMe ? clr?.indigo || '#5B5FEF' : '#D1D5DB',
                    color: '#FFFFFF', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {initials}
                  </div>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: isMe ? clr?.indigo || '#5B5FEF' : clr?.textDark || '#1F2937' }}>
                  {displayName}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: clr?.textDark || '#1F2937', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {ans.text}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
