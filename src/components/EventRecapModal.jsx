import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { avatarFor } from '../lib/avatar'
import { listEventAttendeesWithStatus } from '../lib/events'
import {
  listEventPhotos,
  uploadEventPhoto,
  deleteEventPhoto,
  listEventReactions,
  addEventReaction,
  removeEventReaction,
} from '../lib/eventRecap'

const EMOJIS = ['👏', '🙏', '🔥', '❤️', '😄']

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
}

export default function EventRecapModal({ event, onClose }) {
  if (!event) return null

  const navigate = useNavigate()
  const { currentUser } = useAppContext()

  const [attendees, setAttendees] = useState([])
  const [photos, setPhotos] = useState([])
  const [reactions, setReactions] = useState([])

  const [uploadingProgress, setUploadingProgress] = useState(null) // { current, total } | null
  const [selectedTargetUser, setSelectedTargetUser] = useState(null)
  const [reactionNote, setReactionNote] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState(null)
  const [sendingReaction, setSendingReaction] = useState(false)

  const isHost = event.createdBy === currentUser?.id

  const reloadData = async () => {
    try {
      const [attList, photoList, reactList] = await Promise.all([
        listEventAttendeesWithStatus(event.id),
        listEventPhotos(event.id),
        listEventReactions(event.id),
      ])
      setAttendees(attList)
      setPhotos(photoList)
      setReactions(reactList)
    } catch (err) {
      console.error('[EventRecapModal] reloadData failed', err)
    }
  }

  useEffect(() => {
    reloadData()
  }, [event.id])

  const confirmedAttendees = attendees.filter(a => a.attended === true || a.attended == null)

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !currentUser?.id) return

    setUploadingProgress({ current: 0, total: files.length })

    for (let i = 0; i < files.length; i++) {
      setUploadingProgress({ current: i + 1, total: files.length })
      try {
        await uploadEventPhoto({ eventId: event.id, userId: currentUser.id, file: files[i] })
      } catch (err) {
        console.error('[EventRecapModal] photo upload error', files[i].name, err)
      }
    }

    setUploadingProgress(null)
    const updatedPhotos = await listEventPhotos(event.id).catch(() => [])
    setPhotos(updatedPhotos)
  }

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm('Delete this photo?')) return
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    try {
      await deleteEventPhoto({ photoId: photo.id, storagePath: photo.storagePath })
    } catch (err) {
      console.error('[EventRecapModal] delete photo failed', err)
      reloadData()
    }
  }

  const handleSendReaction = async (emoji) => {
    if (!currentUser?.id || sendingReaction) return
    setSendingReaction(true)
    try {
      await addEventReaction({
        eventId: event.id,
        userId: currentUser.id,
        targetUserId: selectedTargetUser?.id || null,
        emoji,
        note: reactionNote,
      })
      setReactionNote('')
      setSelectedTargetUser(null)
      setSelectedEmoji(null)
      const updatedReactions = await listEventReactions(event.id).catch(() => [])
      setReactions(updatedReactions)
    } catch (err) {
      console.error('[EventRecapModal] add reaction failed', err)
    } finally {
      setSendingReaction(false)
    }
  }

  const handleDeleteReaction = async (reactionId) => {
    setReactions(prev => prev.filter(r => r.id !== reactionId))
    try {
      await removeEventReaction(reactionId)
    } catch (err) {
      console.error('[EventRecapModal] remove reaction failed', err)
      reloadData()
    }
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: clr.indigo, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {event.circleName || 'Event Recap'}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: clr.textDark, margin: 0 }}>
              {event.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="24" height="24" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section 1: Who came */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 13, fontWeight: 800, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px 0' }}>
            Who Came · {confirmedAttendees.length}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {confirmedAttendees.map(a => {
              const isSelectedTarget = selectedTargetUser?.id === a.id
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    if (selectedTargetUser?.id === a.id) {
                      setSelectedTargetUser(null)
                    } else {
                      setSelectedTargetUser(a)
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                    borderRadius: 999, border: `1.5px solid ${isSelectedTarget ? clr.indigo : clr.border}`,
                    backgroundColor: isSelectedTarget ? clr.indigoLt : clr.bg,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <img src={avatarFor(a)} alt={a.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: isSelectedTarget ? clr.indigo : clr.textDark }}>
                    {a.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClose()
                      navigate(`/user/${a.id}`)
                    }}
                    style={{ background: 'none', border: 'none', color: clr.textMid, cursor: 'pointer', padding: 2, fontSize: 11 }}
                  >
                    ↗
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 2: Photos */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Photos · {photos.length}
            </h4>
            <label style={{
              padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${clr.indigo}`,
              backgroundColor: clr.indigoLt, color: clr.indigo, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'inline-block',
            }}>
              {uploadingProgress ? `Uploading (${uploadingProgress.current}/${uploadingProgress.total})…` : '+ Add Photos'}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={!!uploadingProgress}
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {photos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {photos.map(p => {
                const canDelete = isHost || p.user?.id === currentUser?.id
                return (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', backgroundColor: clr.bg }}>
                    <img src={p.url} alt={p.caption || 'Event photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <img
                      src={avatarFor(p.user)}
                      alt={p.user.name}
                      title={p.user.name}
                      style={{
                        position: 'absolute', bottom: 4, left: 4, width: 22, height: 22,
                        borderRadius: '50%', border: '1.5px solid #FFFFFF', objectFit: 'cover',
                      }}
                    />
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(p)}
                        style={{
                          position: 'absolute', top: 4, right: 4, width: 24, height: 24,
                          borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFFFFF',
                          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>No photos uploaded yet. Be the first to share memories!</p>
          )}
        </div>

        {/* Section 3: Say Thanks & Reactions */}
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 800, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px 0' }}>
            {selectedTargetUser ? `Say Thanks to ${selectedTargetUser.name}` : 'React & Say Thanks'}
          </h4>

          {selectedTargetUser && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: clr.indigoLt, borderRadius: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: clr.indigo }}>
                Targeting: {selectedTargetUser.name}
              </span>
              <button type="button" onClick={() => setSelectedTargetUser(null)} style={{ background: 'none', border: 'none', color: clr.indigo, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                Clear
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendReaction(emoji)}
                disabled={sendingReaction}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 16, border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white, fontSize: 22, cursor: 'pointer',
                  transition: 'transform 0.15s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Add a short note (optional)..."
            value={reactionNote}
            onChange={e => setReactionNote(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12,
              border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 14,
              color: clr.textDark, outline: 'none', marginBottom: 16,
            }}
          />

          {/* Existing reactions list */}
          {reactions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reactions.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: clr.bg, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{r.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: clr.textDark }}>
                      {r.user?.name} {r.targetUserId ? `→ ${attendees.find(a => a.id === r.targetUserId)?.name || 'Attendee'}` : ''}
                    </span>
                    {r.note && <span style={{ fontSize: 12, color: clr.textMid, italic: true }}>"{r.note}"</span>}
                  </div>
                  {r.userId === currentUser?.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteReaction(r.id)}
                      style={{ background: 'none', border: 'none', color: clr.textMid, cursor: 'pointer', fontSize: 12 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
