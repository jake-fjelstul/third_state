import { useState, useEffect } from 'react'
import { REPORT_REASONS, fileReport } from '../../lib/moderation'

const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
}

export default function ReportModal({
  open,
  onClose,
  reportedUserId = null,
  reportedMessageId = null,
  reportedCircleId = null,
  subjectName = '',
  context = null,
  onSubmitted,
}) {
  const [selectedReason, setSelectedReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (open) {
      setSelectedReason('')
      setDetails('')
      setSubmitting(false)
      setSubmitted(false)
      setErrorMsg('')
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedReason || submitting) return
    setSubmitting(true)
    setErrorMsg('')

    try {
      await fileReport({
        reportedUserId,
        reportedMessageId,
        reportedCircleId,
        reason: selectedReason,
        details: details.trim() || null,
        context: context || null,
      })
      setSubmitted(true)
      onSubmitted?.()
      setTimeout(() => {
        onClose?.()
      }, 1800)
    } catch (err) {
      console.error('[ReportModal] fileReport failed', err)
      setErrorMsg(err.message || 'Failed to submit report. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15,15,30,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: "'DM Sans', 'Inter', sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          backgroundColor: clr.white,
          borderRadius: '24px 24px 0 0',
          padding: '24px 20px calc(32px + env(safe-area-inset-bottom))',
          maxHeight: '90dvh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          animation: 'slideUp 0.25s ease-out forwards',
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, backgroundColor: clr.border, borderRadius: 2 }} />
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                margin: '0 auto 16px',
              }}
            >
              ✓
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: clr.textDark }}>
              Report Submitted
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: clr.textMid, lineHeight: 1.5 }}>
              Thank you — our team reviews reports within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: clr.textDark }}>
                Report {subjectName ? subjectName : ''}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: clr.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" fill="none" stroke={clr.textDark} strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: 14, color: clr.textMid }}>
              Why are you reporting this? Select the option that best applies.
            </p>

            {/* Reasons list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {REPORT_REASONS.map((r) => {
                const selected = selectedReason === r.value
                return (
                  <label
                    key={r.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 48,
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: selected ? `2px solid ${clr.indigo}` : `1.5px solid ${clr.border}`,
                      backgroundColor: selected ? clr.indigoLt : clr.white,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r.value}
                      checked={selected}
                      onChange={() => setSelectedReason(r.value)}
                      style={{
                        accentColor: clr.indigo,
                        width: 18,
                        height: 18,
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{ fontSize: 15, fontWeight: selected ? 700 : 500, color: clr.textDark }}>
                      {r.label}
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Details textarea */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: clr.textMid, marginBottom: 6 }}>
                Add details (optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide additional context to help our moderation team..."
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.bg,
                  fontSize: 14,
                  color: clr.textDark,
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'none',
                }}
              />
            </div>

            {/* Inline Error */}
            {errorMsg && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  borderRadius: 12,
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 999,
                  border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white,
                  color: clr.textDark,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedReason || submitting}
                style={{
                  flex: 1.5,
                  minHeight: 48,
                  borderRadius: 999,
                  border: 'none',
                  background: selectedReason && !submitting
                    ? `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`
                    : clr.border,
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: selectedReason && !submitting ? 'pointer' : 'not-allowed',
                  boxShadow: selectedReason && !submitting ? '0 4px 14px rgba(91,95,239,0.3)' : 'none',
                  opacity: selectedReason && !submitting ? 1 : 0.6,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
