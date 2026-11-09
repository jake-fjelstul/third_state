import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Lock } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import { respondCircleInvite } from '../../lib/circles.js'

/** Rich "join my circle" card in a DM, with Join / Decline for the invitee. */
export default function CircleInviteMessageCard({ message, viewerId, clr }) {
  const navigate = useNavigate()
  const { refreshJoinedCircles } = useAppContext()
  const payload = message.payload || {}
  const [status, setStatus] = useState(payload.status || 'pending')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isInvitee = viewerId && viewerId === payload.inviteeId

  useEffect(() => {
    if (payload.status) setStatus(payload.status)
  }, [payload.status])

  const respond = async (accept) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await respondCircleInvite(payload.inviteId, accept)
      setStatus(res?.status || (accept ? 'accepted' : 'declined'))
      if (accept) {
        await refreshJoinedCircles?.()
        navigate(`/circles/${payload.circleId}`)
      }
    } catch (err) {
      console.error('[CircleInviteMessageCard] respond failed', err)
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const btn = (primary) => ({
    flex: 1, minHeight: 40, padding: '9px 0', borderRadius: 12, border: primary ? 'none' : `1.5px solid ${clr.border}`,
    background: primary ? 'linear-gradient(135deg, #5B5FEF, #7B6FFF)' : 'transparent',
    color: primary ? '#FFFFFF' : clr.textDark, fontSize: 13, fontWeight: 700,
    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit',
  })

  return (
    <div style={{
      maxWidth: 300, width: '100%', borderRadius: 20, overflow: 'hidden',
      backgroundColor: clr.white, border: `1.5px solid ${clr.border}`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    }}>
      <button type="button" onClick={() => navigate(`/circles/${payload.circleId}`)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0, backgroundColor: clr.indigoLt || 'var(--indigoLt)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Users size={22} color="var(--indigo)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: clr.textMid }}>
            Circle invite
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: clr.textDark, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload.circleName || 'A circle'}</span>
            {payload.circleType === 'private' && <Lock size={13} color={clr.textMid} />}
          </p>
        </div>
      </button>

      <div style={{ padding: '0 14px 14px' }}>
        {status === 'pending' && isInvitee && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy} onClick={() => respond(false)} style={btn(false)}>Decline</button>
            <button type="button" disabled={busy} onClick={() => respond(true)} style={btn(true)}>Join</button>
          </div>
        )}
        {status === 'pending' && !isInvitee && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: clr.textMid, textAlign: 'center' }}>Waiting for a response</p>
        )}
        {status === 'accepted' && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#15803D', textAlign: 'center' }}>✓ Joined</p>
        )}
        {status === 'declined' && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: clr.textMid, textAlign: 'center' }}>Invite declined</p>
        )}
        {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#DC2626', textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  )
}
