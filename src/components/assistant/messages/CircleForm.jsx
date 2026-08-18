import { useState } from 'react'
import { assistantText, assistantNavigate } from '../../../lib/assistant/conversation.js'
import { useAppContext } from '../../../context/AppContext.jsx'
import { CIRCLE_ICONS, DEFAULT_CIRCLE_ICON, KEY_TO_EMOJI } from '../../../lib/circleIcons'
import CircleIcon from '../../ui/CircleIcon.jsx'

export default function CircleForm({ message, clr, onComplete }) {
  const ctx = useAppContext()
  const prefill = message.payload?.prefill || {}
  const [name, setName] = useState(prefill.name || '')
  const [selectedIcon, setSelectedIcon] = useState(prefill.icon || DEFAULT_CIRCLE_ICON)
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
        icon: selectedIcon,
        emoji: KEY_TO_EMOJI[selectedIcon] || '👥',
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
        assistantText(`Circle "${name.trim()}" is live!`),
        assistantNavigate('Go to your new circle', `/circles/${created.id}`, created.name),
      ])
    } catch (err) {
      console.error('[CircleForm] createCircle failed', err)
      setError('Something went wrong. Check your details and try again.')
      setBusy(false)
    }
  }

  const SelectedComp = CIRCLE_ICONS.find(i => i.key === selectedIcon)?.Comp || CIRCLE_ICONS[0].Comp

  return (
    <div style={{
      backgroundColor: clr.white, borderRadius: 18, padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: clr.textDark }}>
        <SelectedComp size={16} color={clr.indigo} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} /> {message.text}
      </p>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Circle Icon</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, backgroundColor: clr.indigoLt,
            border: `1.5px solid ${clr.indigo}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <SelectedComp size={22} color={clr.indigo} strokeWidth={2} />
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {CIRCLE_ICONS.map(({ key, Comp, label }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                onClick={() => setSelectedIcon(key)}
                style={{
                  width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: selectedIcon === key ? '1.5px solid var(--indigo)' : '1.5px solid var(--border)',
                  backgroundColor: selectedIcon === key ? 'var(--indigoLt)' : 'var(--white)',
                }}
              >
                <Comp size={20} color={selectedIcon === key ? 'var(--indigo)' : 'var(--textMid)'} strokeWidth={2} />
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
