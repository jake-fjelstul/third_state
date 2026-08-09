import { useState } from 'react'

const SUGGESTED_QUESTIONS = [
  "What's something you keep meaning to do and haven't?",
  "What's the last thing that made you laugh out loud?",
  "What's a small thing that reliably improves your day?",
  "What's a food combination you enjoy that others might find strange?",
  "What's a skill or hobby you'd love to learn if you had extra time?",
  "What's the best piece of advice you've received recently?",
  "What's something you recently bought that was surprisingly worth it?",
  "What's your ultimate comfort meal after a long day?",
  "What's a hidden gem spot in your city or neighborhood?",
  "What's a movie or show you can rewatch without getting tired of it?",
  "What's a topic you could give a 10-minute presentation on with zero prep?",
  "What's your favorite way to spend a quiet Sunday morning?",
  "What's a song that instantly boosts your mood?",
  "What's a habit you picked up recently that stuck?",
  "What's your ideal vacation style: active adventure or total relaxation?",
  "What's something small that always makes you feel nostalgic?",
]

function getRandomPrompt(current) {
  const filtered = SUGGESTED_QUESTIONS.filter(q => q !== current)
  return filtered[Math.floor(Math.random() * filtered.length)]
}

export default function AskQuestionComposer({ clr, onClose, onSend }) {
  const [question, setQuestion] = useState(() => getRandomPrompt())
  const [isCustom, setIsCustom] = useState(false)
  const [myAnswer, setMyAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const valid = question.trim().length > 0 && myAnswer.trim().length > 0

  const handleShuffle = () => {
    setQuestion(getRandomPrompt(question))
  }

  const handleToggleCustom = () => {
    if (!isCustom) {
      setIsCustom(true)
    } else {
      setIsCustom(false)
      setQuestion(getRandomPrompt())
    }
  }

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      await onSend({ question: question.trim(), myAnswer: myAnswer.trim() })
    } catch (err) {
      setError(err?.message || 'Could not send question')
      setBusy(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    borderRadius: 12, border: `1.5px solid ${clr?.border || '#E5E7EB'}`,
    backgroundColor: clr?.bg || '#F9FAFB', color: clr?.textDark || '#1F2937',
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, maxHeight: '80vh', overflowY: 'auto',
          backgroundColor: clr?.white || '#FFFFFF', borderRadius: 20, padding: 18,
        }}
      >
        <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: clr?.textDark || '#1F2937' }}>
          Ask a Question
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: clr?.textMid || '#6B7280' }}>
          Answers are hidden until both of you reply.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: clr?.textMid || '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Question
          </label>
          <span style={{ fontSize: 11, fontWeight: 600, color: clr?.indigo || '#5B5FEF' }}>
            {isCustom ? 'Custom question' : 'App generated'}
          </span>
        </div>

        {isCustom ? (
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Type your custom question…"
            maxLength={200}
            autoFocus
            style={{ ...inputStyle, marginBottom: 8 }}
          />
        ) : (
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            backgroundColor: 'var(--indigoLt, #EEF0FF)',
            border: `1.5px solid ${clr?.indigo || '#5B5FEF'}`,
            fontSize: 14, fontWeight: 700, color: clr?.textDark || '#1F2937',
            lineHeight: 1.4, marginBottom: 8,
          }}>
            {question}
          </div>
        )}

        {/* Action buttons beneath the question */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {!isCustom && (
            <button
              type="button"
              onClick={handleShuffle}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${clr?.border || '#E5E7EB'}`,
                backgroundColor: clr?.bg || '#F9FAFB', color: clr?.textDark || '#1F2937',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              🎲 Shuffle
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleCustom}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: `1px solid ${isCustom ? clr?.indigo || '#5B5FEF' : clr?.border || '#E5E7EB'}`,
              backgroundColor: isCustom ? 'var(--indigoLt, #EEF0FF)' : clr?.bg || '#F9FAFB',
              color: isCustom ? clr?.indigo || '#5B5FEF' : clr?.textDark || '#1F2937',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {isCustom ? '✨ Use suggested' : 'Custom'}
          </button>
        </div>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: clr?.textMid || '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Your Answer
        </label>
        <textarea
          value={myAnswer}
          onChange={e => setMyAnswer(e.target.value)}
          placeholder="Write your answer first…"
          rows={3}
          style={{ ...inputStyle, resize: 'none', marginBottom: 16 }}
        />

        {error && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#FF3B30' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: 12, borderRadius: 999,
              border: `1.5px solid ${clr?.border || '#E5E7EB'}`,
              backgroundColor: clr?.white || '#FFFFFF',
              color: clr?.textMid || '#6B7280', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            style={{
              flex: 2, padding: 12, borderRadius: 999, border: 'none',
              background: (!valid || busy) ? 'var(--indigoLt, #EEF0FF)' : `linear-gradient(135deg, ${clr?.indigo || '#5B5FEF'}, #7B6FFF)`,
              color: (!valid || busy) ? clr?.indigo || '#5B5FEF' : '#FFF',
              fontSize: 14, fontWeight: 800,
              cursor: (!valid || busy) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'Sending…' : 'Send question'}
          </button>
        </div>
      </div>
    </div>
  )
}
