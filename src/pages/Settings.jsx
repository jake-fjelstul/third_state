import { useAppContext } from '../context/AppContext.jsx'
import { useState } from 'react'

const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
}

export default function Settings() {
  const { theme, setTheme } = useAppContext()
  const [notifyConnections, setNotifyConnections] = useState(true)
  const [notifyEvents, setNotifyEvents] = useState(true)

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

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
          Settings
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Default Block */}
          <div style={{
            backgroundColor: clr.white,
            borderRadius: 20,
            padding: '20px',
            boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }} onClick={handleToggleTheme}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Appearance</p>
              <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                Toggle light and dark mode
              </p>
            </div>

            {/* Toggle Switch */}
            <div style={{
              width: 50,
              height: 28,
              borderRadius: 999,
              backgroundColor: theme === 'dark' ? clr.indigo : clr.border,
              position: 'relative',
              transition: 'background-color 0.3s ease',
            }}>
              <div style={{
                position: 'absolute',
                top: 2,
                left: theme === 'dark' ? 24 : 2,
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'left 0.3s ease',
              }} />
            </div>
          </div>

          {/* Notifications Block */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>
              Notifications
            </h2>
            <div style={{
              backgroundColor: clr.white,
              borderRadius: 20,
              boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
              overflow: 'hidden',
            }}>
              
              <div style={{
                padding: '20px',
                borderBottom: `1px solid ${clr.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }} onClick={() => setNotifyConnections(!notifyConnections)}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Connection Requests</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                    Get notified when someone wants to connect
                  </p>
                </div>

                {/* Toggle Switch */}
                <div style={{
                  width: 50,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: notifyConnections ? clr.indigo : clr.border,
                  position: 'relative',
                  transition: 'background-color 0.3s ease',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: notifyConnections ? 24 : 2,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.3s ease',
                  }} />
                </div>
              </div>

              <div style={{
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }} onClick={() => setNotifyEvents(!notifyEvents)}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Events Approaching</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                    Reminders before an event starts
                  </p>
                </div>

                {/* Toggle Switch */}
                <div style={{
                  width: 50,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: notifyEvents ? clr.indigo : clr.border,
                  position: 'relative',
                  transition: 'background-color 0.3s ease',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: notifyEvents ? 24 : 2,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.3s ease',
                  }} />
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
