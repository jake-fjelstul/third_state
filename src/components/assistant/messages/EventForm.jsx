import { useState } from 'react'
import { assistantText, assistantNavigate } from '../../../lib/assistant/conversation.js'
import LocationAutocomplete from '../../ui/LocationAutocomplete.jsx'
import TimePicker from '../../TimePicker.jsx'
import { useAppContext } from '../../../context/AppContext.jsx'

export default function EventForm({ message, clr, onComplete }) {
  const ctx = useAppContext()
  const prefill = message.payload?.prefill || {}
  const [title, setTitle] = useState(prefill.title || '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('18:00')
  const [location, setLocation] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const biasNear = ctx.currentUser?.latitude != null
    ? { lat: ctx.currentUser.latitude, lng: ctx.currentUser.longitude }
    : undefined

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
    if (!title.trim() || !date) return
    setBusy(true)
    setError(null)
    try {
      const event = await ctx.createEventAndRsvp({
        circleId: null,
        title: title.trim(),
        date,
        time,
        location: location?.name || '',
        locationLat: location?.lat ?? null,
        locationLng: location?.lng ?? null,
        locationAddress: location?.address || '',
        notes,
      })
      onComplete([
        assistantText(`Event created! "${title.trim()}" is on the books. 🎉`),
        assistantNavigate('See it on your Schedule', '/schedule', 'Schedule'),
      ])
    } catch (err) {
      console.error('[EventForm] createEventAndRsvp failed', err)
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
        📅 {message.text}
      </p>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Event Name *</label>
        <input
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Yoga in the park"
          style={inputStyle}
        />
        <label style={labelStyle}>Date *</label>
        <input
          required
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          onClick={e => { try { e.target.showPicker() } catch (_) {} }}
          style={{ ...inputStyle }}
        />
        <label style={labelStyle}>Start Time</label>
        <TimePicker value={time} onChange={setTime} />
        <div style={{ marginBottom: 10, marginTop: 10 }}>
          <label style={labelStyle}>Location</label>
          <LocationAutocomplete
            value={location}
            onChange={setLocation}
            biasNear={biasNear}
            clr={clr}
          />
        </div>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything else to know?"
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
        {error && (
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#E11D48' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !title.trim() || !date}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 999, border: 'none',
            background: (busy || !title.trim() || !date)
              ? '#A5B4FC'
              : `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
            color: '#FFF', fontSize: 14, fontWeight: 800,
            cursor: busy ? 'wait' : 'pointer',
            boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
          }}
        >
          {busy ? 'Creating…' : 'Create Event →'}
        </button>
      </form>
    </div>
  )
}
