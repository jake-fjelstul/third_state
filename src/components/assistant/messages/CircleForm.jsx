import { useState } from 'react'
import { assistantText, assistantNavigate } from '../../../lib/assistant/conversation.js'
import { useAppContext } from '../../../context/AppContext.jsx'

const COMMON_EMOJIS = ['✨', '⭕', '🔥', '🎨', '📸', '⚽', '🏃', '☕', '📚', '🎵', '🎮', '🍕', '🧗', '🚲', '🧘', '🎬', '🐶', '✈️', '💡', '🌱', '🏀', '🎤', '🎲', '❤️']

export default function CircleForm({ message, clr, onComplete }) {
  const ctx = useAppContext()
  const prefill = message.payload?.prefill || {}
  const [name, setName] = useState(prefill.name || '')
  const [emoji, setEmoji] = useState(prefill.emoji || '✨')
  const [category, setCategory] = useState(prefill.category || '')
  const [description, setDescription] = useState('')
  const [vibe, setVibe] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 12,
    border: `1.5px solid ${clr.border}`,
    backgroundColor: clr.bg, color: clr.textDark,
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
    marginBottom: 10,
  }
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: 4,
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await ctx.createCircle({
        name: name.trim(),
        emoji,
        city: ctx.currentUser?.city || '',
        type: 'open',
        category: category.trim() || 'social',
        interestTag: category.trim() || name.trim(),
        coverGradient: 'from-indigo-500 via-sky-500 to-emerald-400',
        description: description.trim(),
        vibe: vibe.trim() || 'Everyone welcome!',
        rules: [],
        hoops: [],
      })
      onComplete([
        assistantText(`Circle "${name.trim()}" is live! ${emoji}`),
        assistantNavigate('Go to your new circle', `/circles/${created.id}`, created.name),
      ])
    } catch (err) {
      console.error('[CircleForm] createCircle failed', err)
      setError('Something went wrong. Check your details and try again.')
      setBusy(false)
    }
  }

  return (
    <div style={{
      backgroundColor: clr.white, borderRadius: 18, padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: clr.textDark }}>
        ⭕ {message.text}
      </p>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Circle Icon</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, backgroundColor: clr.indigoLt,
            border: `1.5px solid ${clr.indigo}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 22, flexShrink: 0,
          }}>
            {emoji}
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {COMMON_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                style={{
                  width: 34, height: 34, borderRadius: 10, border: emoji === e ? `2px solid ${clr.indigo}` : `1px solid ${clr.border}`,
                  backgroundColor: emoji === e ? clr.indigoLt : clr.bg,
                  fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <label style={labelStyle}>Circle Name *</label>
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Photography Crew"
          style={inputStyle}
        />
        <label style={labelStyle}>Category / Interest</label>
        <input
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="Photography, Running, Coffee…"
          style={inputStyle}
        />
        <label style={labelStyle}>Description (optional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this circle all about?"
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
        <label style={labelStyle}>Vibe (optional)</label>
        <input
          value={vibe}
          onChange={e => setVibe(e.target.value)}
          placeholder="Casual, beginner-friendly, weekly meetups…"
          style={inputStyle}
        />
        {error && (
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#E11D48' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !name.trim()}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 999, border: 'none',
            background: (busy || !name.trim())
              ? '#A5B4FC'
              : `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
            color: '#FFF', fontSize: 14, fontWeight: 800,
            cursor: busy ? 'wait' : 'pointer',
            boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
          }}
        >
          {busy ? 'Creating…' : 'Create Circle →'}
        </button>
      </form>
    </div>
  )
}
