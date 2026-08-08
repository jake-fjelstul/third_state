import { useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import { rsvp } from '../../lib/events.js'
import { updateMessagePayload } from '../../lib/chat.js'
import { buildMapsUrl } from '../../lib/geocoding.js'
import { supabase } from '../../lib/supabase.js'

export default function CoffeeInviteMessageCard({ message, viewerId, clr }) {
  const payload = message.payload || {}
  const { createEventAndRsvp, currentUser, refreshProfile } = useAppContext()
  const [status, setStatus] = useState(payload.status || 'pending')
  const [loading, setLoading] = useState(false)

  const inviterId = payload.inviterId || message.senderId || message.sender_id
  const isInviter = viewerId === inviterId

  const whenStr = payload.whenFormatted || (payload.date ? `${payload.date} ${payload.time || ''}` : '')
  const locationName = payload.location || ''

  const handleAccept = async () => {
    if (loading || status !== 'pending') return
    setLoading(true)
    try {
      const title = `Coffee Chat: ${payload.inviterName || 'Connection'} & ${currentUser?.name?.split(' ')[0] || 'Me'}`
      
      let eventId = null
      // Try atomic RPC function first
      try {
        const { data, error } = await supabase.rpc('accept_coffee_invite', {
          p_message_id: message.id,
          p_title: title,
          p_date: payload.date,
          p_time: payload.time || '10:00',
          p_location: locationName || null,
          p_location_lat: payload.locationLat ?? null,
          p_location_lng: payload.locationLng ?? null,
          p_location_address: payload.locationAddress || null,
          p_notes: payload.note || null,
        })
        if (!error && data) {
          eventId = data
        }
      } catch (e) {
        console.warn('[CoffeeInviteMessageCard] accept_coffee_invite RPC failed, falling back', e)
      }

      if (!eventId) {
        // Fallback: client-side event creation
        const event = await createEventAndRsvp({
          circleId: null,
          title,
          date: payload.date,
          time: payload.time || '10:00',
          location: locationName,
          locationLat: payload.locationLat ?? null,
          locationLng: payload.locationLng ?? null,
          locationAddress: payload.locationAddress || '',
          notes: payload.note || '',
        })
        eventId = event.id

        if (inviterId && inviterId !== viewerId) {
          await rsvp({ userId: inviterId, eventId: event.id }).catch(err => {
            console.warn('[CoffeeInviteMessageCard] rsvp inviter fallback warning', err)
          })
        }

        const updatedPayload = {
          ...payload,
          status: 'accepted',
          eventId: event.id,
          acceptedAt: new Date().toISOString(),
          acceptedBy: viewerId,
        }

        await updateMessagePayload(message.id, updatedPayload)
      }

      await refreshProfile?.().catch(() => {})
      setStatus('accepted')
    } catch (err) {
      console.error('[CoffeeInviteMessageCard] handleAccept failed', err)
      alert('Could not accept invite. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    if (loading || status !== 'pending') return
    setLoading(true)
    try {
      const updatedPayload = {
        ...payload,
        status: 'declined',
        declinedAt: new Date().toISOString(),
        declinedBy: viewerId,
      }
      await updateMessagePayload(message.id, updatedPayload)
      setStatus('declined')
    } catch (err) {
      console.error('[CoffeeInviteMessageCard] handleDecline failed', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: 310, width: '100%', borderRadius: 20,
      backgroundColor: clr.white, border: `1.5px solid ${clr.border}`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      overflow: 'hidden', fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #E11D48, #FB7185)',
        padding: '12px 16px', color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>☕</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Coffee Chat Invite</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700,
          backgroundColor: 'rgba(255,255,255,0.25)',
          padding: '2px 8px', borderRadius: 999,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          1:1 Meetup
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {whenStr && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 15 }}>🗓️</span>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>When</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: clr.textDark }}>{whenStr}</span>
            </div>
          </div>
        )}

        {locationName && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 15 }}>📍</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Where</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: clr.textDark, display: 'block' }}>{locationName}</span>
              {payload.locationAddress && (
                <span style={{ fontSize: 11, color: clr.textMid, display: 'block' }}>{payload.locationAddress}</span>
              )}
              {payload.locationLat != null && (
                <a
                  href={buildMapsUrl({ name: locationName, address: payload.locationAddress, lat: payload.locationLat, lng: payload.locationLng })}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: clr.indigo, textDecoration: 'none', fontWeight: 600, marginTop: 2, display: 'inline-block' }}
                >
                  View on Maps →
                </a>
              )}
            </div>
          </div>
        )}

        {payload.note && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, backgroundColor: clr.bg, padding: 10, borderRadius: 12 }}>
            <span style={{ fontSize: 14 }}>💬</span>
            <span style={{ fontSize: 12, color: clr.textDark, fontStyle: 'italic', lineHeight: 1.4 }}>
              "{payload.note}"
            </span>
          </div>
        )}

        {/* Footer Actions / Status */}
        <div style={{ marginTop: 4 }}>
          {status === 'pending' && !isInviter && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleAccept}
                disabled={loading}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 999, border: 'none',
                  background: 'linear-gradient(135deg, #5B5FEF, #7B6FFF)',
                  color: '#FFFFFF', fontSize: 13, fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(91,95,239,0.3)',
                  opacity: loading ? 0.7 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {loading ? 'Adding...' : 'Accept Invite'}
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={loading}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 999,
                  border: `1.5px solid ${clr.border}`,
                  backgroundColor: clr.white,
                  color: clr.textMid, fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Decline
              </button>
            </div>
          )}

          {status === 'pending' && isInviter && (
            <div style={{
              textAlign: 'center', padding: '8px 12px', borderRadius: 12,
              backgroundColor: '#FEF3C7', color: '#D97706',
              fontSize: 12, fontWeight: 700,
            }}>
              ⏳ Pending response
            </div>
          )}

          {status === 'accepted' && (
            <div style={{
              textAlign: 'center', padding: '10px 12px', borderRadius: 12,
              backgroundColor: '#DCFCE7', color: '#15803D',
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span>✓ Accepted</span>
              <span>·</span>
              <span>Added to Calendar 📅</span>
            </div>
          )}

          {status === 'declined' && (
            <div style={{
              textAlign: 'center', padding: '8px 12px', borderRadius: 12,
              backgroundColor: '#F3F4F6', color: clr.textMid,
              fontSize: 12, fontWeight: 600,
            }}>
              ✕ Invite declined
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
