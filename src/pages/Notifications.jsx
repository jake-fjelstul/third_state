import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { listChannels } from '../lib/chat'
import { avatarFor } from '../lib/avatar'
import CircleIcon from '../components/ui/CircleIcon.jsx'
import { joinLfgPost } from '../lib/lfg'

function friendlyJoinError(err) {
  const m = String(err?.message || '')
  if (m.includes('expired'))        return 'This one has already wrapped up.'
  if (m.includes('not available'))  return 'This is no longer available.'
  if (m.includes('not found'))      return 'This post was cancelled.'
  if (m.includes('your own post'))  return "That's your own post."
  return 'Could not join. Please try again.'
}

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

const HANDLED_TYPES = [
  'connection_request', 'connection_accepted',
  'event_approaching',
  'reconnect_nudge',
  'circle_activity', 'application_approved', 'application_declined',
  'question_revealed', 'spontaneous_question', 'spontaneous_question_answered',
  'lfg_post', 'lfg_join',
  'poll_created',
]

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
    blockedUserIds,
  } = useAppContext()
  
  const [drafts, setDrafts] = useState({})
  const [sentStates, setSentStates] = useState({})
  const [activityReplyId, setActivityReplyId] = useState(null)
  const [actionStates, setActionStates] = useState({})
  const [actionErrors, setActionErrors] = useState({})

  const activeBlockedIds = blockedUserIds || []
  const visibleNotifications = notifications.filter(n => {
    if (n.user?.id && activeBlockedIds.includes(n.user.id)) return false
    if (n.targetId && activeBlockedIds.includes(n.targetId)) return false
    return true
  })

  const connectionRequests = visibleNotifications.filter(n => n.type === 'connection_request' || n.type === 'connection_accepted')
  const chatActivity = visibleNotifications.filter(n =>
    n.type === 'question_revealed' ||
    n.type === 'spontaneous_question' ||
    n.type === 'spontaneous_question_answered' ||
    n.type === 'poll_created')
  const lfgActivity = visibleNotifications.filter(n =>
    n.type === 'lfg_post' || n.type === 'lfg_join')
  const eventReminders = visibleNotifications.filter(n => n.type === 'event_approaching')
  const reconnectNudges = visibleNotifications.filter(n => n.type === 'reconnect_nudge')
  const circleActivity = visibleNotifications.filter(n => n.type === 'circle_activity' || n.type === 'application_approved' || n.type === 'application_declined')
  const otherActivity = visibleNotifications.filter(n => !HANDLED_TYPES.includes(n.type))

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
        borderLeft: notif.isRead ? `1px solid ${clr.border}` : '3px solid #F59E0B',
        display: 'flex',
        gap: 16,
        position: 'relative',
        opacity: notif.isRead ? 0.7 : 1,
        transition: 'opacity 0.3s ease'
      }}>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.stopPropagation()
            dismissNotification(notif.id)
          }}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 32, height: 32, borderRadius: '50%',
            border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, lineHeight: 0,
          }}
        >
          <svg width="14" height="14" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
        
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
            {notif.circle ? <CircleIcon circle={notif.circle} size={24} color={clr.indigo} /> : <span style={{ fontSize: '24px' }}>{notif.type === 'application_approved' ? '✅' : '❌'}</span>}
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
        ) : (notif.type === 'question_revealed' || notif.type === 'spontaneous_question' || notif.type === 'spontaneous_question_answered') ? (
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            backgroundColor: clr.indigoLt, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="24" height="24" fill="none" stroke={clr.indigo} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (notif.type === 'lfg_post' || notif.type === 'lfg_join') ? (
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="24" height="24" fill="none" stroke="#D97706" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : notif.type === 'poll_created' ? (
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            backgroundColor: clr.indigoLt, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="24" height="24" fill="none" stroke={clr.indigo} strokeWidth="2" viewBox="0 0 24 24">
              <line x1="12" y1="20" x2="12" y2="10" strokeLinecap="round" />
              <line x1="18" y1="20" x2="18" y2="4" strokeLinecap="round" />
              <line x1="6" y1="20" x2="6" y2="16" strokeLinecap="round" />
            </svg>
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
        <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
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
            ) : (notif.type === 'question_revealed' || notif.type === 'spontaneous_question' || notif.type === 'spontaneous_question_answered') ? (
              <><span style={{ fontWeight: 700 }}>{notif.name || 'Someone'}</span> {notif.message}</>
            ) : (notif.type === 'poll_created' || notif.type === 'lfg_post' || notif.type === 'lfg_join') ? (
              <>{notif.message}</>
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

          {(notif.type === 'question_revealed' || notif.type === 'spontaneous_question' || notif.type === 'spontaneous_question_answered') && notif.chatId && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  markNotificationRead(notif.id)
                  navigate(`/chat/${notif.chatId}`)
                }}
                style={{
                  backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 16px',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                }}
              >
                Open chat
              </button>
            </div>
          )}

          {notif.type === 'lfg_join' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  markNotificationRead(notif.id)
                  navigate('/feed')
                }}
                style={{
                  backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 16px',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                }}
              >
                View
              </button>
            </div>
          )}

          {notif.type === 'lfg_post' && !notif.postId && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  markNotificationRead(notif.id)
                  navigate('/feed')
                }}
                style={{
                  backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 16px',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                }}
              >
                View
              </button>
            </div>
          )}

          {notif.type === 'lfg_post' && notif.postId && actionState === 'joined' && (
            <div style={{ backgroundColor: clr.indigoLt, color: clr.indigo, borderRadius: 8, padding: '8px 0', fontWeight: 600, textAlign: 'center' }}>
              You're in ✓
            </div>
          )}

          {notif.type === 'lfg_post' && notif.postId && actionState === 'failed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: clr.textMid, fontWeight: 600 }}>
                {actionErrors[notif.id] || 'Could not join. Please try again.'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    markNotificationRead(notif.id)
                    navigate('/feed')
                  }}
                  style={{
                    backgroundColor: clr.bg, color: clr.textDark, border: `1px solid ${clr.border}`, padding: '8px 16px',
                    borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                  }}
                >
                  View
                </button>
              </div>
            </div>
          )}

          {notif.type === 'lfg_post' && notif.postId && actionState !== 'joined' && actionState !== 'failed' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  setActionState(notif.id, 'pending')
                  try {
                    await joinLfgPost(notif.postId)
                    markNotificationRead(notif.id)
                    setActionState(notif.id, 'joined')
                    setTimeout(() => dismissNotification(notif.id), 1200)
                  } catch (err) {
                    console.error('[Notifications] joinLfgPost failed', err)
                    setActionErrors(prev => ({ ...prev, [notif.id]: friendlyJoinError(err) }))
                    setActionState(notif.id, 'failed')
                  }
                }}
                disabled={actionState === 'pending'}
                style={{
                  flex: 1, backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 0',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: actionState === 'pending' ? 'not-allowed' : 'pointer', opacity: actionState === 'pending' ? 0.7 : 1,
                }}
              >
                {actionState === 'pending' ? 'Joining…' : 'Join'}
              </button>
              <button
                onClick={() => {
                  markNotificationRead(notif.id)
                  navigate('/feed')
                }}
                style={{
                  flex: 1, backgroundColor: clr.bg, color: clr.textDark, border: `1px solid ${clr.border}`, padding: '8px 0',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer'
                }}
              >
                View
              </button>
            </div>
          )}

          {notif.type === 'poll_created' && notif.chatId && (
            <div style={{ display: 'flex', gap: 8 }}>
              {/* notif.pollId is mapped and available for future deep link */}
              <button
                onClick={() => {
                  markNotificationRead(notif.id)
                  navigate(`/chat/${notif.chatId}`)
                }}
                style={{
                  backgroundColor: clr.indigo, color: '#FFF', border: 'none', padding: '8px 16px',
                  borderRadius: '8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', flex: 1
                }}
              >
                Open poll
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const unreadCount = visibleNotifications.filter(n => !n.isRead).length

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 0' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" fill="none" stroke={clr.textDark} strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: '12px 20px 80px',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: clr.textDark,
            margin: 0, textAlign: 'center',
          }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button
                onClick={markAllNotificationsRead}
                style={{
                  background: 'none', border: 'none', color: clr.indigo,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  padding: '4px 8px', minHeight: 32,
                }}
              >
                Mark all read
              </button>
            </div>
          )}
        </div>

        {visibleNotifications.length === 0 ? (
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

            {chatActivity.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>Chat activity</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {chatActivity.map(renderNotifCard)}
                </div>
              </section>
            )}

            {lfgActivity.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>Free right now</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lfgActivity.map(renderNotifCard)}
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

            {otherActivity.length > 0 && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, marginBottom: 12, paddingLeft: 4 }}>Other</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {otherActivity.map(renderNotifCard)}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
