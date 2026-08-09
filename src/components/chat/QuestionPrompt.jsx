import { useState, useEffect, useRef } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'

export default function QuestionPrompt({ clr, chat, messages = [] }) {
  const {
    getDailyQuestion,
    answerDailyQuestion,
    dismissDailyQuestion,
    getPendingQuestion,
    answerSpontaneousQuestion,
    cancelSpontaneousQuestion,
    currentUser,
  } = useAppContext()

  const [dailyQ, setDailyQ] = useState(null)
  const [pendingSq, setPendingSq] = useState(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const dropdownRef = useRef(null)

  const isDm = chat?.type === 'dm'

  // Check if chat has at least 1 message from each member
  const hasMessageFromEach = () => {
    if (!isDm || !messages || messages.length < 2) return false
    const senders = new Set(messages.map(m => m.senderId || m.sender_id).filter(Boolean))
    return senders.size >= 2
  }

  useEffect(() => {
    let cancelled = false
    const cleanChatId = (chat?.id || '').split('---')[0]
    if (!isDm || !cleanChatId) return

    // Fetch pending spontaneous question first
    getPendingQuestion(cleanChatId)
      .then(sq => {
        if (!cancelled) {
          setPendingSq(sq || null)
        }
      })
      .catch(err => console.error('[QuestionPrompt] getPendingQuestion error', err))

    // Fetch daily question state
    getDailyQuestion()
      .then(dq => {
        if (!cancelled && dq) {
          setDailyQ(dq)
        }
      })
      .catch(err => console.error('[QuestionPrompt] getDailyQuestion error', err))

    return () => { cancelled = true }
  }, [chat?.id, isDm, messages.length, getDailyQuestion, getPendingQuestion])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [dropdownOpen])

  if (dismissed) return null
  if (!isDm) return null

  // Spontaneous question state
  const isMyAskerSq = pendingSq && pendingSq.askerId === currentUser?.id
  const isRecipientSq = pendingSq && pendingSq.askerId !== currentUser?.id

  const activeDaily = !isRecipientSq && !isMyAskerSq && (
    dailyQ &&
    dailyQ.enabled &&
    !dailyQ.alreadyAnswered &&
    !dailyQ.dismissedToday &&
    hasMessageFromEach()
  )

  if (!isRecipientSq && !isMyAskerSq && !activeDaily) return null

  const cardStyle = {
    margin: '10px 16px 4px',
    padding: '14px 16px',
    borderRadius: 16,
    backgroundColor: clr?.white || '#FFFFFF',
    border: `1.5px solid ${clr?.border || '#E5E7EB'}`,
    boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
    flexShrink: 0,
    zIndex: 15,
    animation: 'slideDown 0.25s ease',
    position: 'relative',
  }

  // Asker view for pending spontaneous question
  if (isMyAskerSq) {
    const handleCancel = async () => {
      if (cancelling) return
      setCancelling(true)
      try {
        await cancelSpontaneousQuestion(pendingSq.id)
        setPendingSq(null)
      } catch (err) {
        console.error('[QuestionPrompt] cancel question failed', err)
      } finally {
        setCancelling(false)
      }
    }

    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: clr?.indigo || '#5B5FEF', backgroundColor: 'var(--indigoLt, #EEF0FF)',
            padding: '3px 8px', borderRadius: 8,
          }}>
            💡 Question pending for {pendingSq.recipientName || 'Connection'}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              fontSize: 12, fontWeight: 600, color: '#DC2626',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
            }}
          >
            {cancelling ? 'Cancelling…' : 'Cancel Question'}
          </button>
        </div>

        <p style={{
          margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: clr?.textDark || '#1F2937',
          lineHeight: 1.4,
        }}>
          "{pendingSq.questionText}"
        </p>

        <p style={{
          margin: 0, fontSize: 12, color: clr?.textMid || '#6B7280',
        }}>
          Waiting for {pendingSq.recipientName || 'Connection'} to answer. Both answers will reveal once answered.
        </p>
      </div>
    )
  }

  // Recipient view or Daily Question view
  const questionText = isRecipientSq ? pendingSq.questionText : dailyQ?.questionText
  const badgeLabel = isRecipientSq
    ? `Question from ${pendingSq.askerName || 'Connection'}`
    : 'Question of the Day'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() || submitting) return
    setSubmitting(true)

    try {
      if (isRecipientSq) {
        await answerSpontaneousQuestion({ id: pendingSq.id, text: text.trim() })
        setPendingSq(null)
      } else {
        await answerDailyQuestion(text.trim())
        setDailyQ(prev => prev ? { ...prev, alreadyAnswered: true } : null)
      }
      setDismissed(true)
    } catch (err) {
      console.error('[QuestionPrompt] submit answer failed', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async (permanent) => {
    setDropdownOpen(false)
    setDismissed(true)
    try {
      await dismissDailyQuestion(permanent)
    } catch (err) {
      console.error('[QuestionPrompt] dismiss failed', err)
    }
  }

  return (
    <div style={cardStyle}>
      {/* Top row: Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: clr?.indigo || '#5B5FEF', backgroundColor: 'var(--indigoLt, #EEF0FF)',
          padding: '3px 8px', borderRadius: 8,
        }}>
          💡 {badgeLabel}
        </span>
      </div>

      {/* Question Text */}
      <p style={{
        margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: clr?.textDark || '#1F2937',
        lineHeight: 1.4,
      }}>
        {questionText}
      </p>

      {/* Answer Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type your answer…"
          disabled={submitting}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 999,
            border: `1.5px solid ${clr?.border || '#E5E7EB'}`,
            backgroundColor: clr?.bg || '#F9FAFB',
            fontSize: 13, color: clr?.textDark || '#1F2937',
            outline: 'none', fontFamily: 'inherit',
          }}
        />

        <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            style={{
              padding: '10px 16px', borderRadius: 999, border: 'none',
              background: `linear-gradient(135deg, ${clr?.indigo || '#5B5FEF'}, #7B6FFF)`,
              color: '#FFFFFF', fontSize: 13, fontWeight: 700,
              cursor: text.trim() && !submitting ? 'pointer' : 'default',
              opacity: text.trim() && !submitting ? 1 : 0.55,
              boxShadow: '0 2px 8px rgba(91,95,239,0.3)',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {submitting ? 'Sending…' : 'Send'}
          </button>

          {!isRecipientSq && (
            <>
              {/* Chevron Dropdown button */}
              <button
                type="button"
                onClick={() => setDropdownOpen(prev => !prev)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: `1px solid ${clr?.border || '#E5E7EB'}`,
                  backgroundColor: clr?.bg || '#F9FAFB', color: clr?.textMid || '#6B7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                }}
                aria-label="Options"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
                  minWidth: 180, backgroundColor: clr?.white || '#FFFFFF',
                  border: `1px solid ${clr?.border || '#E5E7EB'}`,
                  borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  overflow: 'hidden', padding: '4px 0',
                }}>
                  <button
                    type="button"
                    onClick={() => handleDismiss(false)}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                      textAlign: 'left', fontSize: 13, fontWeight: 600, color: clr?.textDark || '#1F2937',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Not today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(true)}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                      textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#DC2626',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Turn off daily questions
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  )
}
