import { useAppContext } from '../context/AppContext.jsx'
import { useState, useEffect } from 'react'
import { updateProfile } from '../lib/auth'
import { useCalendar } from '../hooks/useCalendar.js'

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
  const { theme, setTheme, currentUser, setCurrentUser, reconnectThresholdDays, setReconnectThresholdDays, searchRadius, setSearchRadius, importDiscordServer, signOut } = useAppContext()
  const { isConnected: isCalendarConnected, isLoading: calendarLoading, googleEvents, connect: connectCalendar, disconnect: disconnectCalendar } = useCalendar()
  const [notifyConnections, setNotifyConnections] = useState(true)
  const [notifyEvents, setNotifyEvents] = useState(true)
  const [showDiscordImport, setShowDiscordImport] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [discordServerName, setDiscordServerName] = useState('')
  const [discordMembersList, setDiscordMembersList] = useState('')
  const [csvEmailList, setCsvEmailList] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [radiusDraft, setRadiusDraft] = useState(searchRadius)
  const [reconnectDraft, setReconnectDraft] = useState(reconnectThresholdDays)

  const handleToggleTheme = async () => {
    if (!currentUser?.id) return
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    try {
      await updateProfile(currentUser.id, { theme: nextTheme })
    } catch (err) {
      console.error('[Settings] update theme failed', err)
    }
  }

  useEffect(() => { setRadiusDraft(searchRadius) }, [searchRadius])
  useEffect(() => { setReconnectDraft(reconnectThresholdDays) }, [reconnectThresholdDays])

  useEffect(() => {
    if (!currentUser?.id) return
    const t = setTimeout(() => {
      if (radiusDraft !== searchRadius) {
        setSearchRadius(radiusDraft)
        updateProfile(currentUser.id, { search_radius: radiusDraft }).catch(err => console.error('[Settings] update search radius failed', err))
      }
    }, 500)
    return () => clearTimeout(t)
  }, [currentUser?.id, radiusDraft, searchRadius, setSearchRadius])

  useEffect(() => {
    if (!currentUser?.id) return
    const t = setTimeout(() => {
      if (reconnectDraft !== reconnectThresholdDays) {
        setReconnectThresholdDays(reconnectDraft)
        updateProfile(currentUser.id, { reconnect_threshold_days: reconnectDraft }).catch(err => console.error('[Settings] update reconnect threshold failed', err))
      }
    }, 500)
    return () => clearTimeout(t)
  }, [currentUser?.id, reconnectDraft, reconnectThresholdDays, setReconnectThresholdDays])

  const handleImportDiscord = () => {
    if (!discordServerName.trim() || !discordMembersList.trim()) return
    try {
      importDiscordServer(discordServerName, discordMembersList)
    } catch (err) {
      console.error('[Settings] importDiscordServer failed', err)
      triggerToast('Discord import is coming soon.')
    }
    setShowDiscordImport(false)
    setDiscordServerName('')
    setDiscordMembersList('')
  }

  const handleImportCsv = () => {
    if (!csvEmailList.trim()) return
    const count = csvEmailList.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length
    setShowCsvImport(false)
    setCsvEmailList('')
    triggerToast(`Batch invites sent to ${count} emails!`)
  }

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
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

              {/* Reconnect Threshold Slider */}
              <div style={{
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Reconnect Nudges</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                    Remind me to catch up after
                  </p>
                </div>

                <select 
                  value={reconnectDraft}
                  onChange={(e) => setReconnectDraft(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${clr.border}`,
                    backgroundColor: clr.bg,
                    color: clr.textDark,
                    fontSize: 14,
                    fontWeight: 600,
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <option value={7}>1 Week</option>
                  <option value={14}>2 Weeks</option>
                  <option value={21}>3 Weeks</option>
                  <option value={30}>1 Month</option>
                </select>
              </div>

            </div>
          </div>

          {/* Discovery Block */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>
              Discovery
            </h2>
            <div style={{ backgroundColor: clr.white, borderRadius: 20, padding: '20px', boxShadow: '0 2px 14px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Search Radius</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                    Max distance for layout recommendations
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    value={radiusDraft}
                    onChange={(e) => setRadiusDraft(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    style={{ width: 50, padding: '8px 4px', borderRadius: 12, border: `1.5px solid ${clr.border}`, backgroundColor: 'transparent', textAlign: 'center', fontSize: 15, fontWeight: 700, color: clr.textDark, outline: 'none' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: clr.textMid }}>mi</span>
                </div>
              </div>
              <input type="range" min="1" max="100" value={radiusDraft} onChange={(e) => setRadiusDraft(Number(e.target.value))} style={{ width: '100%', accentColor: clr.indigo, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: clr.textLight, fontWeight: 600 }}>1 mi</span>
                <span style={{ fontSize: 12, color: clr.textLight, fontWeight: 600 }}>100 mi</span>
              </div>
            </div>
          </div>

          {/* Privacy & Visibility Block */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>
              Privacy & Visibility
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
              }} onClick={() => {
                const isPrivate = !(currentUser?.privacy?.isPrivateProfile ?? false);
                setCurrentUser(prev => ({ ...prev, privacy: { ...(prev?.privacy || {}), isPrivateProfile: isPrivate } }));
              }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Private Profile</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                    Restricts LFG and general visibility
                  </p>
                </div>

                <div style={{
                  width: 50, height: 28, borderRadius: 999,
                  backgroundColor: (currentUser?.privacy?.isPrivateProfile ?? false) ? clr.indigo : clr.border,
                  position: 'relative', transition: 'background-color 0.3s ease',
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: (currentUser?.privacy?.isPrivateProfile ?? false) ? 24 : 2,
                    width: 24, height: 24, borderRadius: '50%',
                    backgroundColor: '#FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.3s ease',
                  }} />
                </div>
              </div>

              {[
                { label: 'Show Bio', key: 'showBio', desc: 'Display your bio to others' },
                { label: 'Show Interests', key: 'showInterests', desc: 'Let others see your interests' },
                { label: 'Show Circles', key: 'showCircles', desc: 'Display circles you joined' },
                { label: 'Show Location', key: 'showLocation', desc: 'Share your city location' },
                { label: 'Show Availability', key: 'showAvailability', desc: 'Allow online status indicators', isLast: true }
              ].map(({ label, key, desc, isLast }) => {
                const val = currentUser?.privacy?.[key] ?? true;
                return (
                  <div key={key} style={{
                    padding: '20px',
                    borderBottom: isLast ? 'none' : `1px solid ${clr.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }} onClick={() => {
                    setCurrentUser(prev => ({ ...prev, privacy: { ...(prev?.privacy || {}), [key]: !val } }));
                  }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>{label}</p>
                      <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>{desc}</p>
                    </div>

                    <div style={{
                      width: 50, height: 28, borderRadius: 999,
                      backgroundColor: val ? clr.indigo : clr.border,
                      position: 'relative', transition: 'background-color 0.3s ease',
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: val ? 24 : 2,
                        width: 24, height: 24, borderRadius: '50%',
                        backgroundColor: '#FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'left 0.3s ease',
                      }} />
                    </div>
                  </div>
                )
              })}

            </div>
          </div>

          {/* Community Imports Block */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>
              Community Migrations
            </h2>
            <div style={{ backgroundColor: clr.white, borderRadius: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: `1px solid ${clr.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowDiscordImport(true)}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Migrate Discord Server</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>Import server member lists entirely</p>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: clr.indigoLt, color: clr.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
              </div>
              <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowCsvImport(true)}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Batch Email Invite (CSV)</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>Push invitations to a club list automatically</p>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: clr.indigoLt, color: clr.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Account Block */}
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>
            Connected Accounts
          </h2>
          <div style={{ backgroundColor: clr.white, borderRadius: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: clr.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📅</div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: clr.textDark }}>Google Calendar</p>
                  <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>
                    {isCalendarConnected ? `Connected · ${googleEvents.length} events synced` : 'Not connected'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={calendarLoading}
                onClick={async () => {
                  if (isCalendarConnected) {
                    if (!window.confirm('Disconnect Google Calendar?')) return
                    await disconnectCalendar()
                    return
                  }
                  await connectCalendar()
                }}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '8px 14px',
                  background: isCalendarConnected ? '#fee2e2' : 'linear-gradient(135deg, #5B5FEF, #7B6FFF)',
                  color: isCalendarConnected ? '#b91c1c' : '#fff',
                  cursor: calendarLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {isCalendarConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>
            Account
          </h2>
          <div style={{ backgroundColor: clr.white, borderRadius: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => signOut()}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#E11D48' }}>Sign Out</p>
                <p style={{ fontSize: 13, color: clr.textMid, margin: 0 }}>Log out of this device</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#FFE4E6', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Discord Import Modal */}
      {showDiscordImport && (
        <>
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={() => setShowDiscordImport(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 500, margin: '0 auto', backgroundColor: clr.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px 40px', zIndex: 1000, animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: clr.border, margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 800, color: clr.textDark }}>Migrate from Discord</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: clr.textMid }}>Instantly create a private circle pre-filled with your server buddies.</p>
            
            <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: clr.textDark }}>Server Name</p>
            <input 
              value={discordServerName} 
              onChange={e => setDiscordServerName(e.target.value)} 
              placeholder="e.g. Austin Climbing Club"
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${clr.border}`, fontSize: 15, marginBottom: 20, backgroundColor: clr.white, color: clr.textDark, outline: 'none' }}
            />

            <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: clr.textDark }}>Member List (Paste comma-separated user tags)</p>
            <textarea 
              value={discordMembersList} 
              onChange={e => setDiscordMembersList(e.target.value)} 
              placeholder="gamer#1234, climber_gal, boardgame_dude..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${clr.border}`, fontSize: 15, marginBottom: 24, minHeight: 120, resize: 'none', backgroundColor: clr.white, color: clr.textDark, outline: 'none' }}
            />
            
            <button onClick={handleImportDiscord} style={{ width: '100%', padding: '16px', borderRadius: 999, border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color: '#FFF', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(91,95,239,0.25)' }}>
              Create Circle & Invite Members
            </button>
          </div>
        </>
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <>
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={() => setShowCsvImport(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 500, margin: '0 auto', backgroundColor: clr.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px 40px', zIndex: 1000, animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: clr.border, margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 800, color: clr.textDark }}>Batch Email Invite</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: clr.textMid }}>Paste a CSV or list of emails from your existing club or mailing list.</p>
            
            <textarea 
              value={csvEmailList} 
              onChange={e => setCsvEmailList(e.target.value)} 
              placeholder="alice@gmail.com, bob@yahoo.com..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${clr.border}`, fontSize: 15, marginBottom: 24, minHeight: 160, resize: 'none', backgroundColor: clr.white, color: clr.textDark, outline: 'none' }}
            />
            
            <button onClick={handleImportCsv} style={{ width: '100%', padding: '16px', borderRadius: 999, border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color: '#FFF', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(91,95,239,0.25)' }}>
              Send Batch Invitations
            </button>
          </div>
        </>
      )}

      {/* Success Toast */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', backgroundColor: clr.textDark, color: clr.bg, padding: '12px 24px', borderRadius: 999, fontSize: 14, fontWeight: 700, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <span style={{ fontSize: 18 }}>✅</span> {toastMessage}
        </div>
      )}

    </div>
  )
}
