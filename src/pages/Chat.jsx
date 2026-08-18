import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { useAppContext } from '../context/AppContext.jsx'
import { listCircles } from '../lib/circles'
import { useChatMessages } from '../hooks/useChatMessages.js'
import { listChannels, createChannel, toggleMessageReaction } from '../lib/chat.js'
import { avatarFor } from '../lib/avatar'
import GameMessageCard from '../components/games/GameMessageCard.jsx'
import GamePicker from '../components/games/GamePicker.jsx'
import SoloGameModal from '../components/games/SoloGameModal.jsx'
import SwipeableRow from '../components/chat/SwipeableRow.jsx'
import ConfirmCard from '../components/assistant/messages/ConfirmCard.jsx'
import PollComposer from '../components/chat/PollComposer.jsx'
import PollMessageCard from '../components/chat/PollMessageCard.jsx'
import CoffeeInviteMessageCard from '../components/chat/CoffeeInviteMessageCard.jsx'
import QuestionPrompt from '../components/chat/QuestionPrompt.jsx'
import QuestionMessageCard from '../components/chat/QuestionMessageCard.jsx'
import AskQuestionComposer from '../components/chat/AskQuestionComposer.jsx'
import ReportModal from '../components/moderation/ReportModal.jsx'
 
const clr = {
  bg:         'var(--bg)',
  white:      'var(--white)',
  indigo:     'var(--indigo)',
  indigoLt:   'var(--indigoLt)',
  amber:      '#F59E0B',
  textDark:   'var(--textDark)',
  textMid:    'var(--textMid)',
  textLight:  'var(--textLight)',
  border:     'var(--border)',
  green:      'var(--green)',
  activeRow:  '#EEF0FF',
}

const REACTION_EMOJIS = ['❤️', '👍', '👎', '😂', '😮', '😢']
 
/* ── tiny helpers ── */
function GroupAvatar({ name, color = clr.indigo }) {
  const initials = name?.split(' ').map(w => w[0]).slice(0,2).join('') ?? '?'
  return (
    <div style={{
      width: 54, height: 54, borderRadius: '50%',
      backgroundColor: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="24" height="24" fill="none" stroke="#FFFFFF" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
  )
}
 
function UserAvatar({ src, name, online }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {src ? (
        <img src={src} alt={name} style={{
          width: 54, height: 54, borderRadius: '50%', objectFit: 'cover',
        }}/>
      ) : (
        <div style={{
          width: 54, height: 54, borderRadius: '50%',
          backgroundColor: clr.indigoLt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: clr.indigo,
        }}>
          {name?.[0] ?? '?'}
        </div>
      )}
      {online && (
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 12, height: 12, borderRadius: '50%',
          backgroundColor: clr.green,
          border: '2px solid #F0F0F5',
        }}/>
      )}
    </div>
  )
}
 
/* derive display fields from raw chat object */
function normChat(chat) {
  const isGroup   = chat.type === 'group' || chat.type === 'circle' || !!chat.circleName
  const name      = chat.name ?? chat.circleName ?? chat.title ?? 'Unknown'
  const lastMsg   = chat.messages?.[chat.messages.length - 1]
  const preview   = lastMsg
    ? `${lastMsg.senderName || lastMsg.sender || 'Unknown'}: ${lastMsg.text}`
    : chat.lastMessagePreview ?? chat.lastMessage ?? ''
  const time      = lastMsg ? (lastMsg.time ?? lastMsg.timestamp) : (chat.time ?? chat.lastTime ?? chat.lastMessageTime ?? '')
  const unread    = chat.unread ?? chat.unreadCount ?? 0
  const avatar    = chat.avatar ?? chat.avatarUrl ?? chat.participants?.[0]?.avatar ?? null
  const online    = chat.online ?? false
  return { isGroup, name, preview, time, unread, avatar, online }
}
 
/* ── Full thread view ── */
function ThreadView({ chat, baseId, channelId, onBack }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [input, setInput] = useState('')
  const [showGamePicker, setShowGamePicker] = useState(false)
  const [showSoloModal, setShowSoloModal] = useState(null)
  const [showPollComposer, setShowPollComposer] = useState(false)
  const [showPlusPicker, setShowPlusPicker] = useState(false)
  const [showQuestionComposer, setShowQuestionComposer] = useState(false)
  const [channels, setChannels] = useState([])
  const [channelsLoaded, setChannelsLoaded] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [actionMsg, setActionMsg] = useState(null)
  const [reportMsg, setReportMsg] = useState(null)
  const longPressRef = useRef({ timer: null, startX: 0, startY: 0, fired: false })

  const { name, avatar, online, isGroup } = normChat(chat)
  const { sendMessage, markChatRead, currentUser, setCurrentlyOpenChatId, startChatGame, startChatPoll, syncQuestionReveals, askSpontaneousQuestion, getPendingQuestion, cancelSpontaneousQuestion } = useAppContext()
  const [pendingSq, setPendingSq] = useState(null)
  const [kbHeight, setKbHeight] = useState(0)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const messagesContainerRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let isMounted = true
    let showHandle = null
    let hideHandle = null

    const setupListeners = async () => {
      const showH = await Keyboard.addListener('keyboardWillShow', (info) => {
        if (isMounted) {
          setKbHeight(info.keyboardHeight)
        }
      })
      if (!isMounted) {
        showH.remove()
        return
      }
      showHandle = showH

      const hideH = await Keyboard.addListener('keyboardWillHide', () => {
        if (isMounted) {
          setKbHeight(0)
        }
      })
      if (!isMounted) {
        showH.remove()
        hideH.remove()
        return
      }
      hideHandle = hideH
    }

    setupListeners()

    return () => {
      isMounted = false
      if (showHandle) showHandle.remove()
      if (hideHandle) hideHandle.remove()
    }
  }, [])



  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const scHeight = el.scrollHeight
    const newHeight = Math.min(scHeight, 120)
    el.style.height = `${newHeight}px`
    el.style.overflowY = scHeight >= 120 ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    const wasAtBottom = container
      ? container.scrollHeight - container.scrollTop - container.clientHeight <= 50
      : true

    adjustTextareaHeight()

    if (wasAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [input, adjustTextareaHeight])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const isNative = Capacitor.isNativePlatform()
      if (!isNative && !e.shiftKey) {
        e.preventDefault()
        handleSend(e)
      }
    }
  }

  const isDm = chat.type === 'dm'

  useEffect(() => {
    if (!baseId || !isDm) return
    syncQuestionReveals().catch(err => console.error('[ThreadView] syncQuestionReveals failed', err))
    getPendingQuestion(baseId)
      .then(setPendingSq)
      .catch(err => console.error('[ThreadView] getPendingQuestion error', err))
  }, [baseId, isDm, syncQuestionReveals, getPendingQuestion])

  useEffect(() => {
    if (!baseId) return
    setChannelsLoaded(false)
    listChannels(baseId)
      .then(setChannels)
      .catch(err => console.error('[ThreadView] listChannels failed', err))
      .finally(() => setChannelsLoaded(true))
  }, [baseId])

  const activeChannelName = isDm ? null : (channelId || 'general')

  const resolvedChannelId = useMemo(() => {
    if (isDm) return null
    if (!channelsLoaded || channels.length === 0) return null
    return channels.find(c => c.name === activeChannelName)?.id
      ?? channels.find(c => c.name === 'general')?.id
      ?? channels[0].id
  }, [isDm, channelsLoaded, channels, activeChannelName])

  const channelsReady = isDm || channelsLoaded

  const { messages, loading: msgsLoading, reactions, applyLocalReaction } = useChatMessages({
    chatId: channelsReady ? baseId : null,
    channelId: resolvedChannelId,
  })

  const switchChannel = (name) => {
    navigate(`/chat/${baseId}---${name}`, { replace: true })
  }

  const handleCreateChannel = async (e) => {
    e.preventDefault()
    const slug = newChannelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    setShowNewChannel(false)
    setNewChannelName('')
    if (!slug || !baseId) return
    if (channels.some(c => c.name === slug)) { switchChannel(slug); return }
    try {
      const newCh = await createChannel(baseId, slug)
      if (newCh) {
        setChannels(prev => [...prev, newCh])
        switchChannel(newCh.name)
      }
    } catch (err) {
      console.error('[ThreadView] createChannel failed', err)
    }
  }

  useEffect(() => {
    if (!baseId) return
    markChatRead(baseId)
  }, [baseId, markChatRead])

  useEffect(() => {
    if (!baseId) return
    setCurrentlyOpenChatId(baseId)
    return () => setCurrentlyOpenChatId(null)
  }, [baseId, setCurrentlyOpenChatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (location.state?.prefillText) {
      setInput(location.state.prefillText)
    }
  }, [location.state?.prefillText, chat.id])

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(baseId || chat.id, input, resolvedChannelId)
    setInput('')
  }

  const startLongPress = (msg, e) => {
    const t = e.touches?.[0]
    longPressRef.current.startX = t ? t.clientX : 0
    longPressRef.current.startY = t ? t.clientY : 0
    longPressRef.current.fired = false
    if (longPressRef.current.timer) clearTimeout(longPressRef.current.timer)
    longPressRef.current.timer = setTimeout(async () => {
      longPressRef.current.fired = true
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
        await Haptics.impact({ style: ImpactStyle.Medium })
      } catch {}
      setActionMsg(msg)
    }, 450)
  }

  const moveLongPress = (e) => {
    const t = e.touches?.[0]
    if (!t) return
    const dx = Math.abs(t.clientX - longPressRef.current.startX)
    const dy = Math.abs(t.clientY - longPressRef.current.startY)
    if (dx > 10 || dy > 10) cancelLongPress()
  }

  const cancelLongPress = () => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer)
      longPressRef.current.timer = null
    }
  }

  const handleTouchEnd = (e) => {
    if (longPressRef.current.fired) {
      try { e.preventDefault() } catch {}
      try { e.stopPropagation() } catch {}
      longPressRef.current.fired = false
    }
    cancelLongPress()
  }

  const showTimeSeparator = (msg, prev) => {
    if (!prev) return true
    if (!msg?.createdAt || !prev?.createdAt) return false
    return (new Date(msg.createdAt) - new Date(prev.createdAt)) > 15 * 60 * 1000
  }

  const formatSeparator = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const yest = new Date(now); yest.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yest.toDateString()
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (sameDay) return t
    if (isYesterday) return `Yesterday ${t}`
    const withinWeek = (now - d) < 7 * 24 * 60 * 60 * 1000
    if (withinWeek) return `${d.toLocaleDateString([], { weekday: 'long' })} ${t}`
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${t}`
  }

  const reactionsFor = (messageId) => {
    const mine = new Set()
    const counts = new Map()
    for (const r of reactions || []) {
      if (r.message_id !== messageId) continue
      counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1)
      if (r.user_id === currentUser?.id) mine.add(r.emoji)
    }
    return { counts, mine }
  }

  const handleReact = async (msg, emoji) => {
    if (!msg?.id || !currentUser?.id) return
    const { mine } = reactionsFor(msg.id)
    const willAdd = !mine.has(emoji)
    applyLocalReaction(msg.id, emoji, currentUser.id, willAdd)
    setActionMsg(null)
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {}
    try {
      await toggleMessageReaction(msg.id, emoji)
    } catch (err) {
      applyLocalReaction(msg.id, emoji, currentUser.id, !willAdd)
      console.error('[Chat] reaction failed', err)
    }
  }

  return (
    <div
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === 'height' && kbHeight > 0) {
          bottomRef.current?.scrollIntoView({ behavior: 'auto' })
        }
      }}
      style={{
        display: 'flex', flexDirection: 'column',
        height: kbHeight > 0 ? `calc(100vh - ${kbHeight}px)` : 'calc(100vh - 80px - env(safe-area-inset-bottom))',
        transition: 'height 250ms cubic-bezier(0.17, 0.59, 0.4, 0.77)',
        backgroundColor: clr.bg,
        fontFamily: "'DM Sans','Inter',sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 'max(16px, calc(env(safe-area-inset-top) + 12px)) 20px 16px',
        backgroundColor: clr.bg,
        borderBottom: `1px solid ${clr.border}`,
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
          <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        {isGroup
          ? <GroupAvatar name={name} />
          : <UserAvatar src={avatar} name={name} online={online} />
        }
        <div style={{ flex:1 }}>
          <p style={{ fontSize:16, fontWeight:700, color: clr.textDark, margin:0 }}>{name}</p>
          <p style={{ fontSize:12, color: online ? clr.green : clr.textLight, margin:0 }}>
            {isGroup ? `${chat.memberCount ?? chat.members?.length ?? ''} members` : online ? 'Active now' : 'Offline'}
          </p>
        </div>
      </div>

      {!isDm && channelsLoaded && channels.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center',
          padding: '8px 16px 8px var(--channel-bar-pad-left, 16px)',
          backgroundColor: clr.bg,
          borderBottom: `1px solid ${clr.border}`,
          overflowX: 'auto', scrollbarWidth: 'none',
          flexShrink: 0,
        }} className="noscrollbar">
          {channels.map(ch => {
            const isActive = ch.name === activeChannelName
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => switchChannel(ch.name)}
                style={{
                  padding: '6px 12px', borderRadius: 10, border: 'none',
                  backgroundColor: isActive ? clr.indigo : 'transparent',
                  color: isActive ? '#FFFFFF' : clr.textMid,
                  fontSize: 13, fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.45 }}>#</span>
                {ch.name}
              </button>
            )
          })}

          {showNewChannel ? (
            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexShrink: 0 }}>
              <input
                autoFocus
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                onBlur={() => setTimeout(() => setShowNewChannel(false), 200)}
                placeholder="new-channel"
                style={{
                  padding: '6px 10px', borderRadius: 10,
                  border: `1.5px solid ${clr.indigo}`,
                  backgroundColor: clr.bg, color: clr.textDark,
                  fontSize: 13, fontWeight: 600, outline: 'none', width: 110,
                }}
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewChannel(true)}
              aria-label="Add channel"
              style={{
                padding: '6px 12px', borderRadius: 10,
                border: `1.5px dashed ${clr.border}`,
                backgroundColor: 'transparent', color: clr.textMid,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                flexShrink: 0, fontFamily: 'inherit',
              }}
            >
              +
            </button>
          )}
        </div>
      )}
 
      {/* Floating Question Prompt beneath Header */}
      {isDm && <QuestionPrompt clr={clr} chat={chat} messages={messages} />}

      {/* Messages */}
      <div ref={messagesContainerRef} style={{ flex:1, overflowY:'auto', padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
        {messages.length === 0 && !msgsLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: clr.textMid, margin: 0 }}>Start the conversation</p>
          </div>
        ) : (
          messages.map((msg, i, arr) => {
            const prev = i > 0 ? arr[i - 1] : null
            const needsSeparator = showTimeSeparator(msg, prev)
            const isMe = msg.senderId === currentUser?.id || msg.sender === 'You' || msg.isMe
            if (msg.kind === 'poll') {
              return (
                <Fragment key={i}>
                  {needsSeparator && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 2px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: clr.textLight }}>
                        {formatSeparator(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && isGroup && (
                      <span style={{ fontSize:11, color: clr.textLight, marginBottom:3, marginLeft:4 }}>{msg.senderName || msg.sender}</span>
                    )}
                    <PollMessageCard clr={clr} payload={msg.payload} viewerId={currentUser?.id} />
                  </div>
                </Fragment>
              )
            }
            if (msg.kind === 'game') {
              return (
                <Fragment key={i}>
                  {needsSeparator && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 2px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: clr.textLight }}>
                        {formatSeparator(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && isGroup && (
                      <span style={{ fontSize:11, color: clr.textLight, marginBottom:3, marginLeft:4 }}>{msg.senderName || msg.sender}</span>
                    )}
                    <GameMessageCard payload={msg.payload} viewerId={currentUser?.id} />
                  </div>
                </Fragment>
              )
            }
            if (msg.kind === 'question') {
              return (
                <Fragment key={i}>
                  {needsSeparator && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 2px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: clr.textLight }}>
                        {formatSeparator(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && isGroup && (
                      <span style={{ fontSize:11, color: clr.textLight, marginBottom:3, marginLeft:4 }}>{msg.senderName || msg.sender}</span>
                    )}
                    <QuestionMessageCard clr={clr} payload={msg.payload} viewerId={currentUser?.id} />
                  </div>
                </Fragment>
              )
            }
            if (msg.kind === 'coffee_invite' || msg.payload?.type === 'coffee_invite') {
              return (
                <Fragment key={i}>
                  {needsSeparator && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 2px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: clr.textLight }}>
                        {formatSeparator(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && isGroup && (
                      <span style={{ fontSize:11, color: clr.textLight, marginBottom:3, marginLeft:4 }}>{msg.senderName || msg.sender}</span>
                    )}
                    <CoffeeInviteMessageCard message={msg} viewerId={currentUser?.id} clr={clr} />
                  </div>
                </Fragment>
              )
            }
            return (
              <Fragment key={i}>
                {needsSeparator && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 2px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: clr.textLight }}>
                      {formatSeparator(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && isGroup && (
                    <span style={{ fontSize:11, color: clr.textLight, marginBottom:3, marginLeft:4 }}>{msg.senderName || msg.sender}</span>
                  )}
                  <div
                    onTouchStart={(e) => startLongPress(msg, e)}
                    onTouchMove={moveLongPress}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onContextMenu={(e) => { e.preventDefault(); setActionMsg(msg) }}
                    style={{
                      maxWidth: '72%',
                      padding: '11px 14px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      backgroundColor: isMe ? clr.indigo : clr.indigoLt,
                      color: isMe ? '#FFFFFF' : clr.textDark,
                      fontSize: 14, lineHeight: 1.5,
                      boxShadow: isMe ? '0 4px 14px rgba(91,95,239,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      touchAction: 'pan-y',
                    }}
                  >
                    {msg.text}
                  </div>
                  {(() => {
                    const { counts, mine } = reactionsFor(msg.id)
                    if (counts.size === 0) return null
                    return (
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 4,
                        marginTop: -4, marginLeft: 4, marginRight: 4,
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                      }}>
                        {[...counts.entries()].map(([emoji, count]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReact(msg, emoji)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 3,
                              padding: '2px 7px', borderRadius: 999,
                              border: `1px solid ${mine.has(emoji) ? clr.indigo : clr.border}`,
                              backgroundColor: mine.has(emoji) ? clr.indigoLt : clr.white,
                              fontSize: 12, cursor: 'pointer', lineHeight: 1.6,
                            }}
                          >
                            <span>{emoji}</span>
                            {count > 1 && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: clr.textMid }}>{count}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </Fragment>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
 
      {/* Input bar */}
      <form onSubmit={handleSend} style={{
        padding: '12px 16px',
        backgroundColor: clr.bg,
        borderTop: `1px solid ${clr.border}`,
        display: 'flex', alignItems: 'flex-end', gap: 10,
        flexShrink: 0,
      }}>
        {chat.type !== 'dm' && (
          <button
            type="button"
            onClick={() => setShowPollComposer(true)}
            style={{
              width: 42, height: 42, borderRadius: '50%', border: `1.5px solid ${clr.border}`,
              backgroundColor: clr.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, fontSize: 22, lineHeight: 1,
              color: clr.textMid, fontFamily: 'inherit',
            }}
            aria-label="Create a poll"
          >
            +
          </button>
        )}
        {chat.type === 'dm' && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowPlusPicker(prev => !prev)}
              style={{
                width: 42, height: 42, borderRadius: '50%', border: `1.5px solid ${clr.border}`,
                backgroundColor: clr.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, fontSize: 22, lineHeight: 1,
                color: clr.textMid, fontFamily: 'inherit',
              }}
              aria-label="Actions"
            >
              +
            </button>

            {showPlusPicker && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 60,
                width: 160, backgroundColor: clr.white, borderRadius: 16,
                border: `1px solid ${clr.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: 6, display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <button
                  type="button"
                  onClick={() => { setShowPlusPicker(false); setShowPollComposer(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, border: 'none', backgroundColor: 'transparent',
                    color: clr.textDark, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 16 }}>📊</span> Poll
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPlusPicker(false); setShowGamePicker(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, border: 'none', backgroundColor: 'transparent',
                    color: clr.textDark, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 16 }}>🎮</span> Game
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPlusPicker(false); setShowQuestionComposer(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, border: 'none', backgroundColor: 'transparent',
                    color: clr.textDark, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 16 }}>💬</span> Question
                </button>
                {pendingSq && pendingSq.askerId === currentUser?.id && (
                  <button
                    type="button"
                    onClick={async () => {
                      setShowPlusPicker(false)
                      try {
                        await cancelSpontaneousQuestion(pendingSq.id)
                        setPendingSq(null)
                      } catch (err) {
                        console.error('Failed to cancel question', err)
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 10, border: 'none', backgroundColor: 'transparent',
                      color: '#DC2626', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>❓</span> Cancel Question
                  </button>
                )}
              </div>
            )}

            {showGamePicker && (
              <GamePicker
                anchor="bottom-left"
                opponent={{ id: chat.personId || chat.id, name: chat.name, firstName: chat.name?.split(' ')[0], avatar: chat.avatar }}
                chatId={baseId || chat.id}
                onChallenge={async (gameType) => {
                  try {
                    await startChatGame({ chatId: baseId || chat.id, gameType })
                    setShowGamePicker(false)
                  } catch (err) {
                    console.error('Failed to start game', err)
                  }
                }}
                onSoloSelected={(gt) => { setShowGamePicker(false); setShowSoloModal({ gameType: gt }) }}
                onClose={() => setShowGamePicker(false)}
              />
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDm ? 'Type a message...' : `Message #${activeChannelName}…`}
          style={{
            flex:1, padding:'12px 16px', borderRadius:20,
            border:`1.5px solid ${clr.border}`,
            backgroundColor: clr.bg,
            fontSize:14, color: clr.textDark,
            outline:'none', fontFamily:'inherit',
            resize:'none', lineHeight:'20px',
            boxSizing:'border-box', overflowY:'hidden',
          }}
        />
        <button type="submit" style={{
          width:42, height:42, borderRadius:'50%', border:'none',
          background:`linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', flexShrink:0,
          boxShadow:'0 4px 12px rgba(91,95,239,0.35)',
        }}>
          <svg width="18" height="18" fill="none" stroke="#FFFFFF" strokeWidth="2.2" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>

      {showSoloModal && (
        <SoloGameModal
          gameType={showSoloModal.gameType}
          onClose={() => setShowSoloModal(null)}
        />
      )}

      {showPollComposer && (
        <PollComposer
          clr={clr}
          onClose={() => setShowPollComposer(false)}
          onCreate={async ({ question, options, allowMultiple }) => {
            await startChatPoll({
              chatId: baseId || chat.id,
              channelId: resolvedChannelId,
              question,
              options,
              allowMultiple,
            })
            setShowPollComposer(false)
          }}
        />
      )}

      {showQuestionComposer && (
        <AskQuestionComposer
          clr={clr}
          pendingSq={pendingSq}
          onCancelPending={async (id) => {
            await cancelSpontaneousQuestion(id)
            setPendingSq(null)
          }}
          onClose={() => setShowQuestionComposer(false)}
          onSend={async ({ question, myAnswer }) => {
            await askSpontaneousQuestion({
              chatId: baseId || chat.id,
              question,
              myAnswer,
            })
            setShowQuestionComposer(false)
            const updated = await getPendingQuestion(baseId || chat.id)
            setPendingSq(updated || null)
          }}
        />
      )}

      {actionMsg && (
        <div
          onClick={() => setActionMsg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            backgroundColor: 'rgba(15,15,30,0.4)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 500,
              backgroundColor: clr.white,
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
              boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{ width: 36, height: 4, backgroundColor: clr.border, borderRadius: 2 }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 4, padding: '6px 4px 14px',
            }}>
              {REACTION_EMOJIS.map(emoji => {
                const active = reactionsFor(actionMsg.id).mine.has(emoji)
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(actionMsg, emoji)}
                    style={{
                      flex: 1, minHeight: 48, borderRadius: 999, border: 'none',
                      backgroundColor: active ? clr.indigoLt : 'transparent',
                      fontSize: 26, lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
            {actionMsg.senderId !== currentUser?.id && (
              <button
                type="button"
                onClick={() => { const m = actionMsg; setActionMsg(null); setReportMsg(m) }}
                style={{
                  width: '100%', minHeight: 48, borderRadius: 14, border: 'none',
                  backgroundColor: clr.bg, color: clr.textDark,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                }}
              >
                🚩 Report message
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionMsg(null)}
              style={{
                width: '100%', minHeight: 48, borderRadius: 14,
                border: `1.5px solid ${clr.border}`,
                backgroundColor: clr.white, color: clr.textMid,
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ReportModal
        open={!!reportMsg}
        onClose={() => setReportMsg(null)}
        reportedMessageId={reportMsg?.id}
        reportedUserId={reportMsg?.senderId}
        subjectName={reportMsg?.senderName ? `message from ${reportMsg.senderName}` : 'message'}
        context={{ text: reportMsg?.text || '' }}
      />
    </div>
  )
}

/* ── New Chat Modal (iPhone-style) ── */
function NewChatModal({ onClose, onSelect, joinedCircles, currentUser, chatState, connections }) {
  const [contactSearch, setContactSearch] = useState('')
  const [circles, setCircles] = useState([])

  useEffect(() => {
    let cancelled = false
    listCircles().then(list => { if (!cancelled) setCircles(list) })
    return () => { cancelled = true }
  }, [])

  const contacts = useMemo(() => {
    const seen = new Set()
    const result = []
    if (currentUser?.id) seen.add(currentUser.id)

    // People from joined circles
    joinedCircles?.forEach(circleId => {
      const circle = circles.find(c => c.id === circleId)
      circle?.members?.forEach(member => {
        if (!seen.has(member.id)) {
          seen.add(member.id)
          result.push(member)
        }
      })
    })

    // People from existing DMs
    Object.values(chatState ?? {}).forEach(chat => {
      if (chat.type === 'dm' && chat.personId && !seen.has(chat.personId)) {
        seen.add(chat.personId)
        result.push({
          id: chat.personId,
          name: chat.name || 'Unknown',
          avatar: chat.avatar || ''
        })
      }
    })

    // Also include connections as fallback
    connections?.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        result.push(p)
      }
    })

    return result
  }, [joinedCircles, chatState, currentUser, circles, connections])

  const filtered = contactSearch.trim()
    ? contacts.filter(p => p.name.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      backgroundColor: 'rgba(15,15,30,0.5)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', backgroundColor: clr.bg,
        borderRadius: '24px 24px 0 0',
        maxHeight: '75vh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 32, height: 4, backgroundColor: '#E8E8EE', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: clr.textDark }}>New Message</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="22" height="22" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* To: search */}
        <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: clr.textMid }}>To:</span>
          <input
            value={contactSearch}
            onChange={e => setContactSearch(e.target.value)}
            placeholder="Search people..."
            autoFocus
            style={{
              flex: 1, padding: '10px 0', border: 'none', outline: 'none',
              fontSize: 15, color: clr.textDark, fontFamily: 'inherit',
              backgroundColor: 'transparent',
            }}
          />
        </div>
        <div style={{ borderBottom: `1px solid ${clr.border}` }} />

        {/* Contact list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 32, color: clr.textMid, fontSize: 14 }}>No contacts found</p>
          ) : (
            filtered.map(person => (
              <button
                key={person.id}
                type="button"
                onClick={() => onSelect(person)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={avatarFor(person)} alt={person.name} style={{
                    width: 44, height: 44, borderRadius: '50%', objectFit: 'cover',
                  }}/>
                  {person.online && (
                    <div style={{
                      position: 'absolute', bottom: 1, right: 1,
                      width: 10, height: 10, borderRadius: '50%',
                      backgroundColor: clr.green, border: '2px solid #FFFFFF',
                    }}/>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: clr.textDark, margin: '0 0 2px 0' }}>
                    {person.name}
                  </p>
                  {person.bio && (
                    <p style={{ fontSize: 13, color: clr.textMid, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {person.bio.slice(0, 40)}…
                    </p>
                  )}
                </div>
                <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
 
/* ── Main Chat page ── */
export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { chatState, startDM, joinedCircles, currentUser, connections, deleteChat } = useAppContext()
  const [search, setSearch] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [showGamePicker, setShowGamePicker] = useState(false)
  const [showSoloModal, setShowSoloModal] = useState(null)
  const [openRowId, setOpenRowId] = useState(null)
  const [actionSheetChat, setActionSheetChat] = useState(null)
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(null)

  if (id) {
    let chat = null;
    let baseId = id;
    let channelId = null;

    if (id.includes('---')) {
      [baseId, channelId] = id.split('---');
    }
    
    chat = chatState[baseId];

    if (!chat) {
      return (
        <div style={{ height:'calc(100vh - 80px - env(safe-area-inset-bottom))', display:'flex', flexDirection:'column', backgroundColor:clr.bg, fontFamily:"'DM Sans','Inter',sans-serif" }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'max(16px, calc(env(safe-area-inset-top) + 12px)) 20px 16px', backgroundColor:clr.bg, borderBottom:`1px solid ${clr.border}` }}>
            <button onClick={() => navigate('/chat')} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
              <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <p style={{ fontSize:16, fontWeight:700, color: clr.textDark, margin:0 }}>New Message</p>
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center' }}>
            <p style={{ fontSize:15, color:clr.textMid }}>Start the conversation</p>
          </div>
        </div>
      )
    }

    if (channelId) {
      chat = {
        ...chat,
        name: chat.name || chat.circleName || chat.title
      }
    }

    return <ThreadView chat={chat} baseId={baseId} channelId={channelId} onBack={() => navigate('/chat')} />
  }

  const listItems = Object.values(chatState).filter(c => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const n = normChat(c).name
      return (n || '').toLowerCase().includes(q)
    }
    return true
  })

  const filtered = listItems.sort((a,b) => {
    const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return tB - tA
  })
 
  /* alternate group avatar colors */
  const groupColors = [clr.indigo, '#6B7280', '#10B981', '#F43F5E']
 
  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans','Inter',sans-serif",
    }}>
 
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, margin: 0, letterSpacing: '-0.02em', fontFamily: "'DM Serif Display', 'Georgia', serif" }}>
          Chat
        </h1>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowGamePicker(true)} style={{
            padding: '6px 12px', borderRadius: 16, border: `1.5px solid ${clr.border}`,
            backgroundColor: clr.white, color: clr.textDark, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
          }}>
            <span style={{ fontSize: 16 }}>🎮</span> Games
          </button>
          {showGamePicker && (
            <GamePicker
              anchor="top-right"
              opponent={null}
              chatId={null}
              onSoloSelected={(gt) => { setShowGamePicker(false); setShowSoloModal({ gameType: gt }) }}
              onClose={() => setShowGamePicker(false)}
            />
          )}
        </div>
      </div>

      {/* ── Search bar + Compose ── */}
      <div style={{ padding:'0 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position:'relative', flex: 1 }}>
          <svg width="18" height="18" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24"
            style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages"
            style={{
              width:'100%', boxSizing:'border-box',
              padding:'13px 16px 13px 44px',
              borderRadius:999,
              border:`1.5px solid ${clr.border}`,
              backgroundColor: clr.bg,
              fontSize:15, color: clr.textDark,
              outline:'none', fontFamily:'inherit',
            }}
          />
        </div>
        <button type="button" onClick={() => setShowCompose(true)} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
          background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 3px 10px rgba(91,95,239,0.3)',
        }}>
          <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      {/* ── Chat list ── */}
      <div style={{ marginTop:4 }}>
        {filtered.map((chat, idx) => {
          const { isGroup, name, preview, time, unread, avatar, online } = normChat(chat)
          const isActive = unread > 0

          return (
            <SwipeableRow
              key={chat.id}
              enabled={!isGroup}
              isOpen={openRowId === chat.id}
              onOpenChange={(open) => setOpenRowId(open ? chat.id : null)}
              onClick={() => navigate(`/chat/${chat.id}`)}
              onLongPress={() => setActionSheetChat({ id: chat.id, name })}
              onDelete={() => { setOpenRowId(null); setConfirmDeleteChat({ id: chat.id, name }) }}
              background={clr.bg}
            >
              <div
                style={{
                  width:'100%', boxSizing:'border-box', display:'flex', alignItems:'center', gap:14,
                  padding:'14px 20px',
                  backgroundColor: 'transparent',
                  border:'none',
                  cursor:'pointer', textAlign:'left',
                  transition:'background-color 0.15s ease',
                }}
              >
                {/* Avatar */}
                {isGroup
                  ? <GroupAvatar name={name} color={groupColors[idx % groupColors.length]} />
                  : <UserAvatar src={avatar} name={name} online={online} />
                }

                {/* Text */}
                <div style={{ flex:1, minWidth:0, borderBottom:`0.5px solid ${clr.border}`, paddingBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{
                      fontSize:16, fontWeight: isActive ? 700 : 600, color: clr.textDark,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {name}
                    </span>
                    <span style={{
                      fontSize:12, color: isActive ? clr.indigo : clr.textLight,
                      fontWeight: isActive ? 600 : 400, flexShrink:0, marginLeft:8,
                    }}>
                      {time}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{
                      fontSize:14, color: clr.textMid,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      maxWidth:'85%',
                    }}>
                      {preview}
                    </span>
                    {unread > 0 && (
                      <div style={{
                        minWidth:22, height:22, borderRadius:999,
                        backgroundColor: clr.indigo,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:700, color:'#FFFFFF',
                        padding:'0 6px', flexShrink:0,
                      }}>
                        {unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SwipeableRow>
          )
        })}
      </div>
 
      {/* ── New Chat Modal ── */}
      {showCompose && (
        <NewChatModal
          onClose={() => setShowCompose(false)}
          onSelect={async (person) => {
            try {
              const chatId = await startDM(person)
              setShowCompose(false)
              navigate(`/chat/${chatId}`)
            } catch (err) {
              console.error('Failed to start DM', err)
            }
          }}
          joinedCircles={joinedCircles}
          currentUser={currentUser}
          chatState={chatState}
          connections={connections}
        />
      )}

      {showSoloModal && (
        <SoloGameModal
          gameType={showSoloModal.gameType}
          onClose={() => setShowSoloModal(null)}
        />
      )}

      {actionSheetChat && (
        <div
          onClick={() => setActionSheetChat(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <div style={{ backgroundColor: clr.white, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', fontSize: 13, color: clr.textMid, textAlign: 'center' }}>
                {actionSheetChat.name}
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = actionSheetChat
                  setActionSheetChat(null)
                  setConfirmDeleteChat(target)
                }}
                style={{
                  width: '100%', padding: 16, border: 'none', borderTop: `0.5px solid ${clr.border}`,
                  backgroundColor: 'transparent', color: '#FF3B30',
                  fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Delete Conversation
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActionSheetChat(null)}
              style={{
                width: '100%', padding: 16, borderRadius: 16, border: 'none',
                backgroundColor: clr.white, color: clr.textDark,
                fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmDeleteChat && (
        <div
          onClick={() => setConfirmDeleteChat(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 61,
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340 }}>
            <ConfirmCard
              clr={clr}
              title="Delete conversation?"
              subtitle={`This removes ${confirmDeleteChat.name} from your list. They will still have their copy, and it comes back if they message you again.`}
              primaryLabel="Delete"
              onCancel={() => setConfirmDeleteChat(null)}
              onConfirm={async () => {
                const target = confirmDeleteChat
                setConfirmDeleteChat(null)
                try {
                  await deleteChat(target.id)
                } catch (err) {
                  console.error('Failed to delete chat', err)
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  )
}

