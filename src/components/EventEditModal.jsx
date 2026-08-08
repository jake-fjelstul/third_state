import { useState, useEffect } from 'react'
import { updateEvent, deleteEvent } from '../lib/events.js'
import { uploadEventCover } from '../lib/storage.js'
import TimePicker from './TimePicker.jsx'
import LocationAutocomplete from './ui/LocationAutocomplete.jsx'
import { supabase } from '../lib/supabase.js'
import { checkContent } from '../lib/contentFilter.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
  red: '#DC2626',
}

export default function EventEditModal({ event, onClose, onSaved }) {
  if (!event) return null

  const [title, setTitle] = useState(event.title || '')
  const [date, setDate] = useState(event.date || '')
  const [time, setTime] = useState(event.time || '12:00')
  const [notes, setNotes] = useState(event.notes || '')
  const [eventLocation, setEventLocation] = useState(
    event.location
      ? { name: event.location, lat: event.locationLat, lng: event.locationLng, address: event.locationAddress }
      : null
  )
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(event.coverImageUrl || '')
  const [scope, setScope] = useState('this') // 'this' | 'future'
  const [hasRecurringSeries, setHasRecurringSeries] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    const parentId = event.recurrenceParentId || event.id
    if (event.recurrenceParentId || (event.recurrenceRule && event.recurrenceRule !== 'none')) {
      setHasRecurringSeries(true)
    } else {
      // Check if any events reference this event as parent
      supabase
        .from('events')
        .select('id')
        .eq('recurrence_parent_id', parentId)
        .limit(1)
        .then(({ data }) => {
          if (!cancelled && data && data.length > 0) {
            setHasRecurringSeries(true)
          }
        })
        .catch(() => {})
    }
    return () => { cancelled = true }
  }, [event])

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverFile(file)
      setCoverPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (submitting) return

    const check = checkContent(title)
    if (!check.ok) {
      setErrorMsg(check.reason)
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      let coverUrl = event.coverImageUrl
      if (coverFile) {
        try {
          coverUrl = await uploadEventCover({ eventId: event.id, file: coverFile })
        } catch (uploadErr) {
          console.error('[EventEditModal] cover upload failed', uploadErr)
        }
      }

      const updated = await updateEvent({
        eventId: event.id,
        title,
        date,
        time,
        location: eventLocation?.name || '',
        locationLat: eventLocation?.lat ?? null,
        locationLng: eventLocation?.lng ?? null,
        locationAddress: eventLocation?.address || '',
        notes,
        coverImageUrl: coverUrl,
      })

      if (scope === 'future' && hasRecurringSeries && event.startsAt && updated.startsAt) {
        const oldMs = new Date(event.startsAt).getTime()
        const newMs = new Date(updated.startsAt).getTime()
        const deltaMs = newMs - oldMs
        const parentId = event.recurrenceParentId || event.id

        const { data: siblings } = await supabase
          .from('events')
          .select('id, starts_at')
          .or(`recurrence_parent_id.eq.${parentId},id.eq.${parentId}`)
          .gte('starts_at', event.startsAt)

        if (siblings && siblings.length > 0) {
          for (const sib of siblings) {
            if (sib.id === event.id) continue
            const oldSibMs = new Date(sib.starts_at).getTime()
            const newSibIso = new Date(oldSibMs + deltaMs).toISOString()
            await updateEvent({
              eventId: sib.id,
              title,
              location: eventLocation?.name || '',
              locationLat: eventLocation?.lat ?? null,
              locationLng: eventLocation?.lng ?? null,
              locationAddress: eventLocation?.address || '',
              notes,
              coverImageUrl: coverUrl,
              startsAt: newSibIso,
            }).catch(err => console.error('[EventEditModal] sibling update failed', sib.id, err))
          }
        }
      }

      if (onSaved) await onSaved()
      onClose()
    } catch (err) {
      console.error('[EventEditModal] save failed', err)
      setErrorMsg(err.message || 'Could not update event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }
    setDeleting(true)
    try {
      await deleteEvent(event.id)
      if (onSaved) await onSaved()
      onClose()
    } catch (err) {
      console.error('[EventEditModal] delete failed', err)
      setErrorMsg(err.message || 'Could not delete event')
    } finally {
      setDeleting(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16,
    border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 15,
    color: clr.textDark, outline: 'none', fontFamily: 'inherit', marginBottom: 16
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        backgroundColor: 'rgba(15,15,30,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'calc(100% - 24px)', maxWidth: 500, boxSizing: 'border-box',
          backgroundColor: clr.white, borderRadius: '24px 24px 0 0',
          padding: '24px 20px calc(48px + env(safe-area-inset-bottom))',
          maxHeight: '85dvh', overflowY: 'auto', animation: 'slideUp 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: clr.textDark }}>Edit Event</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="24" height="24" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: 12, backgroundColor: '#FEE2E2', color: clr.red, borderRadius: 12, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Cover Photo Picker */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Cover Photo
            </label>
            <label style={{
              display: 'block', position: 'relative', width: '100%', aspectRatio: '16/9',
              borderRadius: 16, border: `1.5px dashed ${clr.border}`, backgroundColor: clr.bg,
              overflow: 'hidden', cursor: 'pointer', textAlign: 'center',
            }}>
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF',
                    fontSize: 14, fontWeight: 700,
                  }}>
                    📷 Change Photo
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: clr.textMid }}>
                  <span style={{ fontSize: 24, marginBottom: 4 }}>📷</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Add a cover photo</span>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Event Title */}
          <input
            required
            placeholder="Event Name"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={inputStyle}
          />

          {/* Date & Time */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Date</label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                onClick={(e) => { try { e.target.showPicker() } catch {} }}
                style={{ ...inputStyle, marginBottom: 0 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Start Time</label>
            <TimePicker value={time} onChange={setTime} />
          </div>

          {/* Location */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Location</label>
            <LocationAutocomplete
              value={eventLocation}
              onChange={setEventLocation}
              clr={clr}
            />
          </div>

          {/* Notes */}
          <textarea
            placeholder="Event details / notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'none' }}
          />

          {/* Recurrence scope option if applicable */}
          {hasRecurringSeries && (
            <div style={{ padding: 16, backgroundColor: clr.indigoLt, borderRadius: 16, marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: clr.indigo }}>Apply changes to:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: clr.textDark, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scope"
                    value="this"
                    checked={scope === 'this'}
                    onChange={() => setScope('this')}
                    style={{ accentColor: clr.indigo }}
                  />
                  This event only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: clr.textDark, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scope"
                    value="future"
                    checked={scope === 'future'}
                    onChange={() => setScope('future')}
                    style={{ accentColor: clr.indigo }}
                  />
                  This and all future occurrences
                </label>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || deleting}
            style={{
              width: '100%', padding: '16px', borderRadius: 999, border: 'none',
              background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
              color: '#FFF', fontSize: 16, fontWeight: 800, cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 6px 20px rgba(91,95,239,0.3)', marginBottom: 12,
            }}
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>

          {/* Delete button */}
          <button
            type="button"
            disabled={submitting || deleting}
            onClick={handleDelete}
            style={{
              width: '100%', padding: '14px', borderRadius: 999,
              border: `1.5px solid #FEE2E2`, backgroundColor: '#FFF5F5',
              color: clr.red, fontSize: 14, fontWeight: 700, cursor: deleting ? 'wait' : 'pointer',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete Event'}
          </button>
        </form>
      </div>
    </div>
  )
}
