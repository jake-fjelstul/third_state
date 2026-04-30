import { useState, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { getProfileById } from '../../lib/profiles'

const clr = {
  bg: '#F9FAFB',
  white: '#FFFFFF',
  textDark: '#111827',
  textMid: '#4B5563',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  indigo: '#5B5FEF',
  indigoLt: '#F0F0FF',
  green: '#10B981',
  greenLt: '#D1FAE5',
  red: '#EF4444',
  redLt: '#FEE2E2',
}

export default function OrganizerReview({ circle }) {
  const { pendingApplications, approveApplication, declineApplication, startDM, loadApplicationsForCircle } = useAppContext()
  const navigate = useNavigate()
  
  const [filter, setFilter] = useState('pending') // 'all' | 'pending' | 'approved' | 'declined'
  const [actingId, setActingId] = useState(null)

  const apps = pendingApplications.filter(a => a.circleId === circle.id)
  
  const filteredApps = apps.filter(a => {
    if (filter === 'all') return true
    return a.status === filter
  })

  useEffect(() => {
    if (!circle?.id) return
    loadApplicationsForCircle(circle.id).catch(err => console.error('[OrganizerReview] load failed', err))
  }, [circle?.id, loadApplicationsForCircle])

  // Format timestamp safely
  const timeSince = (isoString) => {
    const hours = Math.floor((new Date() - new Date(isoString)) / 3600000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours/24)}d ago`
  }

  const handleMessage = async (e, applicantId) => {
    e.stopPropagation()
    try {
      const person = await getProfileById(applicantId)
      if (person) {
        const chatId = await startDM(person)
        navigate(`/chat/${chatId}`)
      } else {
        console.warn('[OrganizerReview] applicant profile not found', applicantId)
      }
    } catch (err) {
      console.error('[OrganizerReview] startDM failed', err)
    }
  }

  return (
    <div style={{ padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: clr.textDark }}>Applications</h3>
        <div style={{ padding: '4px 12px', borderRadius: 999, backgroundColor: clr.indigoLt, color: clr.indigo, fontSize: 13, fontWeight: 800 }}>
          {apps.filter(a => a.status === 'pending').length} Pending
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {['pending', 'all', 'approved', 'declined'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap',
              backgroundColor: filter === f ? clr.textDark : clr.white,
              color: filter === f ? clr.bg : clr.textMid,
              boxShadow: filter === f ? '0 4px 12px rgba(0,0,0,0.1)' : `0 0 0 1px ${clr.border} inset`,
              transition: 'all 0.2s ease'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {filteredApps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: clr.textMid }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📫</div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>No {filter} applications.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredApps.map(app => (
            <div key={app.id} style={{ backgroundColor: clr.white, borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: `1px solid ${clr.border}` }}>
              {/* Header */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <img src={app.applicantAvatar} alt="avatar" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700, color: clr.textDark }}>{app.applicantName}</p>
                    <span style={{ fontSize: 12, color: clr.textLight, fontWeight: 600 }}>{timeSince(app.submittedAt)}</span>
                  </div>
                  {/* Mock logic for age/city, generally stored on applicant if it's a real schema */}
                  <p style={{ margin: 0, fontSize: 13, color: clr.textMid }}>Austin, TX</p>
                </div>
              </div>

              {/* Status Badge */}
              {app.status !== 'pending' && (
                <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, marginBottom: 16, textTransform: 'uppercase',
                  backgroundColor: app.status === 'approved' ? clr.greenLt : clr.redLt,
                  color: app.status === 'approved' ? clr.green : clr.red
                }}>
                  {app.status}
                </div>
              )}

              {/* Responses Accordion / Layout */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                {app.responses.map((resp, i) => (
                  <div key={i} style={{ backgroundColor: clr.bg, padding: 12, borderRadius: 12 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: clr.textLight, textTransform: 'uppercase' }}>{resp.prompt}</p>
                    <p style={{ margin: 0, fontSize: 14, color: clr.textDark, lineHeight: 1.5 }}>"{resp.response}"</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {app.status === 'pending' ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button disabled={actingId === app.id} onClick={async () => {
                    setActingId(app.id)
                    try { await approveApplication(app.id) }
                    catch(err) { console.error(err) }
                    finally { setActingId(null) }
                  }} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${clr.green}, #0ea5e9)`, color: '#FFF', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span>✓</span> {actingId === app.id ? 'Working…' : 'Approve'}
                  </button>
                  <button disabled={actingId === app.id} onClick={async () => {
                    setActingId(app.id)
                    try { await declineApplication(app.id) }
                    catch(err) { console.error(err) }
                    finally { setActingId(null) }
                  }} style={{ flex: 1, padding: 14, borderRadius: 12, border: `1.5px solid ${clr.red}`, background: 'transparent', color: clr.red, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span>✕</span> {actingId === app.id ? 'Working…' : 'Decline'}
                  </button>
                </div>
              ) : (
                <button onClick={(e) => handleMessage(e, app.applicantId)} style={{ width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${clr.border}`, background: 'transparent', color: clr.textMid, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Message Applicant
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
