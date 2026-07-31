import { useState } from 'react'

export default function PollComposer({ clr, onClose, onCreate }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const filled = options.map(o => o.trim()).filter(Boolean)
  const valid = question.trim().length > 0 && filled.length >= 2

  const setOption = (i, v) => setOptions(prev => prev.map((o, idx) => idx === i ? v : o))
  const addOption = () => setOptions(prev => prev.length >= 10 ? prev : [...prev, ''])
  const removeOption = (i) => setOptions(prev => prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      await onCreate({ question: question.trim(), options: filled, allowMultiple })
    } catch (err) {
      setError(err?.message || 'Could not create the poll')
      setBusy(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    borderRadius: 12, border: `1.5px solid ${clr.border}`,
    backgroundColor: clr.bg, color: clr.textDark,
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
          backgroundColor: clr.white, borderRadius: 20, padding: 18,
        }}
      >
        <p style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: clr.textDark }}>
          New poll
        </p>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Question
        </label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="What should we do Saturday?"
          maxLength={200}
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Options
        </label>
        {options.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={o}
                onChange={e => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                maxLength={80}
                style={inputStyle}
              />
            </div>
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                aria-label={`Remove option ${i + 1}`}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: clr.textLight, fontSize: 18, padding: 4 }}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {options.length < 10 && (
          <button
            type="button"
            onClick={addOption}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: clr.indigo, fontSize: 13, fontWeight: 700,
              padding: '4px 0', marginBottom: 12, fontFamily: 'inherit',
            }}
          >
            + Add option
          </button>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={e => setAllowMultiple(e.target.checked)}
          />
          <span style={{ fontSize: 13, color: clr.textMid }}>Allow picking more than one</span>
        </label>

        {error && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#FF3B30' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: 12, borderRadius: 999,
              border: `1.5px solid ${clr.border}`, backgroundColor: clr.white,
              color: clr.textMid, fontSize: 14, fontWeight: 700,
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
              background: (!valid || busy) ? clr.indigoLt : `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
              color: (!valid || busy) ? clr.indigo : '#FFF',
              fontSize: 14, fontWeight: 800,
              cursor: (!valid || busy) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'Sending…' : 'Send poll'}
          </button>
        </div>
      </div>
    </div>
  )
}
