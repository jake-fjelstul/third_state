import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { listChannels } from '../lib/chat'
import { avatarFor } from '../lib/avatar'

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
  const {
    notifications,
    dismissNotification,
    markNotificationRead,
    markAllNotificationsRead,
    acceptConnection,
    declineConnection,
    startDM,
    sendMessage,
    currentUser,
  } = useAppContext()
  
  const [drafts, setDrafts] = useState({})
  const [sentStates, setSentStates] = useState({})
  const [activityReplyId, setActivityReplyId] = useState(null)
  const [actionStates, setActionStates] = useState({})

  const connectionRequests = notifications.filter(n => n.type === 'connection_request' || n.type === 'connection_accepted')
  const eventReminders = notifications.filter(n => n.type === 'event_approaching')
  const reconnectNudges = notifications.filter(n => n.type === 'reconnect_nudge')
  const circleActivity = notifications.filter(n => n.type === 'circle_activity' || n.type === 'application_approved' || n.type === 'application_declined')

  const setActionState = (id, state) => {
    setActionStates(prev => ({ ...prev, [id]: state }))
  }

  const renderNotifCard = (notif) => {
    const actionState = actionStates[notif.id] ?? null
    return (
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
        transition: 'opacity 0.3s ease'
      }}>
        {!notif.isRead && (
          <div style={{
            position: 'absolute', top: 16, right: 16, width: 8, height: 8,
            borderRadius: '50%', backgroundColor: '#F59E0B',
          }} />
        )}
        
        {/* Icon / Avatar */}
        {notif.type === 'event_approaching' ? (
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            backgroundColor: clr.indigoLt, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '24px' }}>📅</span>
          </div>
        ) : (notif.type === 'application_approved' || notif.type === 'application_declined') ? (
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            backgroundColor: clr.indigoLt, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '24px' }}>{notif.circle?.emoji || (notif.type === 'application_approved' ? '✅' : '❌')}</span>
          </div>
        ) : notif.type === 'circle_activity' ? (
          <div style={{
            width: 48, height: 48, borderRadius: '12px', overflow: 'hidden', position: 'relative'
          }}>
            <img src={avatarFor(notif.user)} alt={notif.user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, background: clr.white, borderRadius: '50%', padding: 2 }}>
              <span style={{ fontSize: 10 }}>💬</span>
            </div>
          </div>
        ) : notif.user ? (
          <img
            src={avatarFor(notif.user)}
            alt={notif.user?.name}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              backgroundColor: clr.indigoLt, objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: clr.indigoLt, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '24px' }}>👤</span>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: 15, color: clr.textDark, lineHeight: 1.4, wordBreak: 'break-word' }}>
            {notif.type === 'connection_request' ? (
              <><span style={{ fontWeight: 700 }}>{notif.user?.name}</span> {notif.message}</>
            ) : notif.type === 'connection_accepted' ? (
              <><span style={{ fontWeight: 700 }}>{notif.user?.name}</span> {notif.message}</>
            ) : notif.type === 'reconnect_nudge' ? (
              <>
                <span style={{ fontWeight: 700 }}>Catch up with {notif.user?.name?.split(' ')[0]}</span>
                <span style={{ display: 'block', marginTop: 4 }}>{notif.message}</span>
              </>
            ) : notif.type === 'circle_activity' ? (
              <><span style={{ fontWeight: 700 }}>{notif.user?.name}</span> {notif.message}</>
            ) : notif.type === 'application_approved' || notif.type === 'application_declined' ? (
              <><span style={{ fontWeight: 700 }}>{notif.circle?.name}</span> {notif.message}</>
            ) : notif.type === 'event_approaching' ? (
              <><span style={{ fontWeight: 700 }}>{notif.event?.title}</span> {notif.message}</>
            ) : (
              <>{notif.message}</>
            )}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: clr.textLight }}>
            {notif.timestamp} {notif.circle && `in ${notif.circle.name}`}
          </p>

          {/* Inline Actions */}
          
          {notif.type === 'connection_request' && actionState === 'accepted' && (
            <div style={{ backgroundColor: '#ECFDF5', color: '#059669', borderRadius: 8, padding: '8px 0', fontWeight: 600, textAlign: 'center' }}>
              ✓ Accepted
            </div>
          )}

          {notif.type === 'connection_request' && actionState === 'declined' && (
            <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '8px 0', fontWeight: 600, textAlign: 'center' }}>
              Declined
            </div>
          )}

          {notif.type === 'connection_request' && actionState !== 'accepted' && actionState !== 'declined' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  setActionState(notif.id, 'accepting')
                  try {
                    await acceptConnection(notif.requestId, notif.id)
                    setActionState(notif.id, 'accepted')
                  } catch (err) {
                    console.error(err)
                    setActionState(notif.id, null)
                  }
                }}
                disabled={actionState === 'accepting' || actionState === 'declining'}
                style={{
                  flex: 1, backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 0',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: actionState === 'accepting' || actionState === 'declining' ? 'not-allowed' : 'pointer', opacity: actionState === 'accepting' || actionState === 'declining' ? 0.7 : 1,
                }}>
                {actionState === 'accepting' ? 'Accepting...' : 'Accept'}
              </button>
              <button
                onClick={async () => {
                  setActionState(notif.id, 'declining')
                  try {
                    await declineConnection(notif.requestId, notif.id)
                    setActionState(notif.id, 'declined')
                  } catch (err) {
                    console.error(err)
                    setActionState(notif.id, null)
                  }
                }}
                disabled={actionState === 'accepting' || actionState === 'declining'}
                style={{
                  flex: 1, backgroundColor: clr.bg, color: clr.textDark, border: `1px solid ${clr.border}`, padding: '8px 0',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: actionState === 'accepting' || actionState === 'declining' ? 'not-allowed' : 'pointer', opacity: actionState === 'accepting' || actionState === 'declining' ? 0.7 : 1,
                }}>
                {actionState === 'declining' ? 'Declining...' : 'Decline'}
              </button>
            </div>
          )}

          {notif.type === 'connection_accepted' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => dismissNotification(notif.id)}
                style={{
                  backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 16px',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                }}>
                Dismiss
              </button>
            </div>
          )}

          {notif.type === 'event_approaching' && actionState === 'checked_in' && (
            <div style={{ backgroundColor: '#ECFDF5', color: '#059669', borderRadius: 8, padding: '8px 0', fontWeight: 600, textAlign: 'center' }}>
              Got it
            </div>
          )}

          {notif.type === 'event_approaching' && actionState === 'cant_make_it' && (
            <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '8px 0', fontWeight: 600, textAlign: 'center' }}>
              Got it
            </div>
          )}

          {notif.type === 'event_approaching' && actionState !== 'checked_in' && actionState !== 'cant_make_it' && (
             <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => {
                  setActionState(notif.id, 'checking_in')
                  setActionState(notif.id, 'checked_in')
                  setTimeout(() => { dismissNotification(notif.id) }, 120)
                }}
                  disabled={actionState === 'checking_in' || actionState === 'declining_event'}
                  style={{
                    backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 16px',
                    borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                  }}>
                  {actionState === 'checking_in' ? 'Saving...' : 'Check In'}
                </button>
                <button onClick={async () => {
                  setActionState(notif.id, 'declining_event')
                  setActionState(notif.id, 'cant_make_it')
                  setTimeout(() => { dismissNotification(notif.id) }, 120)
                }}
                  disabled={actionState === 'checking_in' || actionState === 'declining_event'}
                  style={{
                    backgroundColor: clr.bg, color: clr.textDark, border: `1px solid ${clr.border}`, padding: '8px 16px',
                    borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                  }}>
                  {actionState === 'declining_event' ? 'Saving...' : "Can't Make It"}
                </button>
             </div>
          )}

          {notif.type === 'reconnect_nudge' && notif.suggestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: clr.textDark }}>Suggested openers:</p>
              <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 8, paddingBottom: 4, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                {notif.suggestions.map((sig, idx) => (
                  <button key={idx} onClick={() => setDrafts(prev => ({ ...prev, [notif.id]: sig }))}
                    style={{
                      flexShrink: 0, backgroundColor: clr.bg, color: clr.textDark, border: `1px solid ${clr.border}`,
                      padding: '8px 12px', borderRadius: '16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap'
                    }}>
                    {sig}
                  </button>
                ))}
              </div>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault()
                  const text = drafts[notif.id]
                  if (!text?.trim()) return
                  try {
                    const chatId = await startDM({ id: notif.targetId, name: notif.user.name, avatar: notif.user.avatar })
                    await sendMessage(chatId, text.trim(), null)
                    setSentStates(prev => ({ ...prev, [notif.id]: true }))
                    setTimeout(() => dismissNotification(notif.id), 1200)
                  } catch (err) {
                    console.error('[Notifications] reconnect reply failed', err)
                  }
                }} 
                style={{ display: 'flex', gap: 8, marginTop: 4 }}
              >
                <input 
                  type="text" placeholder="Write a message..." value={drafts[notif.id] || ''}
                  onChange={(e) => setDrafts(prev => ({ ...prev, [notif.id]: e.target.value }))}
                  disabled={sentStates[notif.id]}
                  style={{
                    flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 999, border: `1px solid ${clr.border}`,
                    backgroundColor: clr.bg, fontSize: 13, outline: 'none', fontFamily: 'inherit', color: clr.textDark
                  }}
                />
                <button type="submit" disabled={!drafts[notif.id]?.trim() || sentStates[notif.id]}
                  style={{
                    background: sentStates[notif.id] ? '#10B981' : drafts[notif.id]?.trim() ? clr.indigo : clr.indigoLt,
                    color: drafts[notif.id]?.trim() || sentStates[notif.id] ? '#FFF' : clr.textLight,
                    border: 'none', borderRadius: 999, padding: '0 16px',
                    fontSize: 13, fontWeight: 700, cursor: drafts[notif.id]?.trim() ? 'pointer' : 'default', transition: 'background 0.2s', fontFamily: 'inherit'
                  }}>
                  {sentStates[notif.id] ? '✓ Sent' : 'Send'}
                </button>
              </form>
            </div>
          )}

          {notif.type === 'circle_activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
               <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => dismissNotification(notif.id)}
                    style={{
                      background: clr.bg, border: `1px solid ${clr.border}`, borderRadius: 16, padding: '6px 14px',
                      fontSize: 13, fontWeight: 600, color: clr.textDark, cursor: 'pointer'
                    }}>
                    👍 Like
                  </button>
                  <button onClick={() => setActivityReplyId(activityReplyId === notif.id ? null : notif.id)}
                    style={{
                      background: activityReplyId === notif.id ? clr.indigoLt : clr.bg, border: `1px solid ${clr.border}`, borderRadius: 16, padding: '6px 14px',
                      fontSize: 13, fontWeight: 600, color: activityReplyId === notif.id ? clr.indigo : clr.textDark, cursor: 'pointer'
                    }}>
                    💬 Quick Reply
                  </button>
               </div>

               {activityReplyId === notif.id && (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!drafts[notif.id]?.trim()) return
                      try {
                        const chatId = notif.chatId
                        if (!chatId) return
                        const channels = await listChannels(chatId)
                        const general = channels.find(c => c.name === 'general')
                        await sendMessage(chatId, drafts[notif.id].trim(), general?.id || null)
                        setSentStates(prev => ({ ...prev, [notif.id]: true }))
                        setTimeout(() => dismissNotification(notif.id), 1200)
                      } catch (err) {
                        console.error('[Notifications] circle reply failed', err)
                      }
                    }} 
                    style={{ display: 'flex', gap: 8, marginTop: 4 }}
                  >
                    <input 
                      type="text" placeholder="Reply to Activity..." value={drafts[notif.id] || ''} autoFocus
                      onChange={(e) => setDrafts(prev => ({ ...prev, [notif.id]: e.target.value }))}
                      disabled={sentStates[notif.id]}
                      style={{
                        flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 999, border: `1px solid ${clr.border}`,
                        backgroundColor: clr.bg, fontSize: 13, outline: 'none', fontFamily: 'inherit', color: clr.textDark
                      }}
                    />
                    <button type="submit" disabled={!drafts[notif.id]?.trim() || sentStates[notif.id]}
                      style={{
                        background: sentStates[notif.id] ? '#10B981' : drafts[notif.id]?.trim() ? clr.indigo : clr.indigoLt,
                        color: drafts[notif.id]?.trim() || sentStates[notif.id] ? '#FFF' : clr.textLight,
                        border: 'none', borderRadius: 999, padding: '0 16px',
                        fontSize: 13, fontWeight: 700, cursor: drafts[notif.id]?.trim() ? 'pointer' : 'default', transition: 'background 0.2s', fontFamily: 'inherit'
                      }}>
                      {sentStates[notif.id] ? '✓ Sent' : 'Reply'}
                    </button>
                  </form>
               )}
            </div>
          )}

          {(notif.type === 'application_approved' || notif.type === 'application_declined') && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => dismissNotification(notif.id)}
                style={{
                  backgroundColor: clr.bg, color: clr.textDark, border: `1px solid ${clr.border}`, padding: '8px 16px',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                }}>
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: '24px 20px 80px',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 24, minHeight: 34, paddingLeft: 4, paddingRight: 4 }}>
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 28, fontWeight: 800, color: clr.textDark, margin: 0, pointerEvents: 'none' }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllNotificationsRead}
              style={{
                background: 'none', border: 'none', color: clr.indigo,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 8px',
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
           <div style={{ padding: 40, textAlign: 'center' }}>
             <p style={{ fontSize: 15, color: clr.textLight }}>You have no notifications yet.</p>
           </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            
            {connectionRequests.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>Connection requests</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {connectionRequests.map(renderNotifCard)}
                </div>
              </section>
            )}

            {eventReminders.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>Event reminders</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {eventReminders.map(renderNotifCard)}
                </div>
              </section>
            )}

            {reconnectNudges.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>Reconnect nudges</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reconnectNudges.map(renderNotifCard)}
                </div>
              </section>
            )}

            {circleActivity.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>Circle activity</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {circleActivity.map(renderNotifCard)}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
