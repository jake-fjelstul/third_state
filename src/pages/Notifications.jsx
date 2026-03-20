import { useNavigate } from 'react-router-dom'
import { notifications } from '../data/mockData.js'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

export default function Notifications() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      {/* ── Main Container ── */}
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: '24px 20px 80px',
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, marginBottom: 24, paddingLeft: 4 }}>
          Notifications
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notifications.map((notif) => (
            <div key={notif.id} style={{
              backgroundColor: clr.white,
              borderRadius: 16,
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              border: `1px solid ${clr.border}`,
              display: 'flex',
              gap: 16,
              position: 'relative',
              opacity: notif.isRead ? 0.7 : 1,
            }}>
              {!notif.isRead && (
                <div style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#F59E0B',
                }} />
              )}
              
              {/* Icon / Avatar */}
              {notif.type === 'connection_request' ? (
                <img
                  src={notif.user.avatar}
                  alt={notif.user.name}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: clr.indigoLt,
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  backgroundColor: clr.indigoLt,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '24px' }}>📅</span>
                </div>
              )}

              {/* Content */}
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: 15, color: clr.textDark, lineHeight: 1.4 }}>
                  {notif.type === 'connection_request' ? (
                    <>
                      <span style={{ fontWeight: 700 }}>{notif.user.name}</span> {notif.message}
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700 }}>{notif.event.title}</span> {notif.message}
                    </>
                  )}
                </p>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: clr.textLight }}>
                  {notif.timestamp}
                </p>

                {/* Actions */}
                {notif.type === 'connection_request' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{
                      flex: 1,
                      backgroundColor: clr.indigo,
                      color: '#FFF',
                      border: 'none',
                      padding: '8px 0',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}>
                      Accept
                    </button>
                    <button style={{
                      flex: 1,
                      backgroundColor: clr.bg,
                      color: clr.textDark,
                      border: `1px solid ${clr.border}`,
                      padding: '8px 0',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}>
                      Decline
                    </button>
                  </div>
                )}
                {notif.type === 'event_approaching' && (
                  <button onClick={() => navigate('/schedule')} style={{
                    backgroundColor: clr.bg,
                    color: clr.textDark,
                    border: `1px solid ${clr.border}`,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}>
                    View Schedule
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
