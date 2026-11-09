import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAppContext } from '../../context/AppContext.jsx'
import { useChatMessages } from '../../hooks/useChatMessages.js'
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight.js'
import { listChannels, createChannel, toggleMessageReaction } from '../../lib/chat.js'
import GameMessageCard from '../games/GameMessageCard.jsx'
import GamePicker from '../games/GamePicker.jsx'
import SoloGameModal from '../games/SoloGameModal.jsx'
import PollComposer from './PollComposer.jsx'
import PollMessageCard from './PollMessageCard.jsx'
import CircleInviteMessageCard from './CircleInviteMessageCard.jsx'
import CoffeeInviteMessageCard from './CoffeeInviteMessageCard.jsx'
import QuestionPrompt from './QuestionPrompt.jsx'
import QuestionMessageCard from './QuestionMessageCard.jsx'
import AskQuestionComposer from './AskQuestionComposer.jsx'
import ReportModal from '../moderation/ReportModal.jsx'
import { BarChart2, Gamepad2, HelpCircle, XCircle, Flag } from 'lucide-react'

/*
 * The one chat thread used everywhere: DMs, group chats and circle chats
 * (with channels). Circle pages open this same view (item 7), so reactions,
 * polls, photos, replies and the question of the day behave identically.
 */
export const clr = {
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
export function GroupAvatar({ name, color = clr.indigo }) {
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
 
export function UserAvatar({ src, name, online }) {
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
export function normChat(chat) {
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
export default function ThreadView({ chat, baseId, channelId, onBack }) {
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
  const kbHeight = useKeyboardHeight()
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const hasInitiallyScrolled = useRef(false)
  const stickToBottom = useRef(true)

  // Prepending older messages must not make the view jump.
  const preserveScrollRef = useRef(null)
  const handleScroll = () => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.current = distanceFromBottom <= 80
    if (el.scrollTop < 80 && hasMoreRef.current && !loadingOlderRef.current) {
      preserveScrollRef.current = { height: el.scrollHeight, top: el.scrollTop }
      loadOlderRef.current?.()
    }
  }




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
    adjustTextareaHeight()
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

  const { messages, loading: msgsLoading, reactions, applyLocalReaction, loadOlder, hasMore, loadingOlder } = useChatMessages({
    chatId: channelsReady ? baseId : null,
    channelId: resolvedChannelId,
  })
  const hasMoreRef = useRef(false)
  const loadingOlderRef = useRef(false)
  const loadOlderRef = useRef(null)
  useEffect(() => {
    hasMoreRef.current = hasMore
    loadingOlderRef.current = loadingOlder
    loadOlderRef.current = loadOlder
  })
  useLayoutEffect(() => {
    const saved = preserveScrollRef.current
    const el = messagesContainerRef.current
    if (!saved || !el || loadingOlder) return
    el.scrollTop = saved.top + (el.scrollHeight - saved.height)
    preserveScrollRef.current = null
  }, [messages, loadingOlder])

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

  // Reset initial scroll & stickiness flags when thread or channel changes
  useEffect(() => {
    hasInitiallyScrolled.current = false
    stickToBottom.current = true
  }, [baseId, activeChannelName])

  // Instant jump before paint on initial load of messages
  useLayoutEffect(() => {
    if (!messages || messages.length === 0) return
    if (hasInitiallyScrolled.current) return

    const el = messagesContainerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
    hasInitiallyScrolled.current = true
    stickToBottom.current = true
  }, [messages, baseId, activeChannelName])

  // Re-pin to bottom as late content loads (reactions, images, composer height), if user intends to stay at bottom
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return

    const handleRePin = () => {
      if (stickToBottom.current) {
        el.scrollTop = el.scrollHeight
      }
    }

    const observer = new ResizeObserver(handleRePin)

    const observeContent = () => {
      observer.observe(el)
      Array.from(el.children).forEach(child => observer.observe(child))
    }

    observeContent()

    const handleImageLoad = () => handleRePin()

    const attachImgListeners = (node) => {
      if (node.tagName === 'IMG') {
        if (!node.complete) {
          node.addEventListener('load', handleImageLoad, { once: true })
        }
      }
      if (node.querySelectorAll) {
        node.querySelectorAll('img').forEach(img => {
          if (!img.complete) {
            img.addEventListener('load', handleImageLoad, { once: true })
          }
        })
      }
    }

    attachImgListeners(el)

    const mutationObserver = new MutationObserver((mutations) => {
      observeContent()
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) attachImgListeners(node)
        })
      })
    })

    mutationObserver.observe(el, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [baseId, activeChannelName, messages.length])

  // Smooth-scroll only when a genuinely new message lands at the end. Cache
  // -> network swaps and older-page loads jump instantly (or not at all), and
  // we scroll the list itself: scrollIntoView also scrolled the whole page,
  // which was the "popup scrolling" on open (issue 2).
  const lastIdRef = useRef(null)
  const idsRef = useRef(new Set())
  useEffect(() => {
    const el = messagesContainerRef.current
    const last = messages[messages.length - 1]
    const prevLast = lastIdRef.current
    const appended = !!last && !!prevLast && last.id !== prevLast && idsRef.current.has(prevLast)
      && !idsRef.current.has(last.id)
      && messages.length - idsRef.current.size <= 3
    lastIdRef.current = last?.id || null
    idsRef.current = new Set(messages.map(m => m.id))
    if (!el || !hasInitiallyScrolled.current || !stickToBottom.current) return
    if (appended) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (location.state?.prefillText) {
      setInput(location.state.prefillText)
    }
  }, [location.state?.prefillText, chat.id])

  const [sendError, setSendError] = useState('')
  const handleSend = async (e) => {
    e.preventDefault()
    const text = input
    if (!text.trim()) return
    setInput('')
    setSendError('')
    import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
      .catch(() => {})
    try {
      await sendMessage(baseId || chat.id, text, resolvedChannelId)
    } catch (err) {
      // Never lose what they typed (audit M9).
      console.error('[ThreadView] send failed', err)
      setInput(prev => prev || text)
      setSendError("Couldn't send. Check your connection and try again.")
    }
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
          const el = messagesContainerRef.current
          if (el) el.scrollTop = el.scrollHeight
        }
      }}
      style={{
        display: 'flex', flexDirection: 'column',
        // A pushed screen covers the tab bar, so it gets the full height.
        height: kbHeight > 0 ? `calc(100dvh - ${kbHeight}px)` : '100dvh',
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
      <div ref={messagesContainerRef} onScroll={handleScroll} style={{ flex:1, overflowY:'auto', padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
        {loadingOlder && (
          <div style={{ textAlign: 'center', fontSize: 12, color: clr.textLight, padding: '4px 0' }}>Loading earlier messages…</div>
        )}
        {messages.length === 0 && msgsLoading && (
          // Bubble-shaped skeleton instead of a blank screen (item 3).
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            {[62, 44, 70, 38, 56].map((w, i) => (
              <div key={i} className="ts-skeleton" style={{
                alignSelf: i % 2 ? 'flex-end' : 'flex-start',
                width: `${w}%`, height: 38, borderRadius: 18,
              }} />
            ))}
          </div>
        )}
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
            if (msg.kind === 'circle_invite') {
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
                    <CircleInviteMessageCard message={msg} viewerId={currentUser?.id} clr={clr} />
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
 
      {sendError && (
        <div role="alert" onClick={() => setSendError('')} style={{
          margin: '0 16px 6px', padding: '8px 12px', borderRadius: 12,
          backgroundColor: '#FEE2E2', color: '#B91C1C', fontSize: 13, fontWeight: 600, flexShrink: 0,
        }}>
          {sendError}
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSend} style={{
        padding: kbHeight > 0 ? '12px 16px' : '12px 16px calc(12px + env(safe-area-inset-bottom))',
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
                  <BarChart2 size={16} color={clr.textDark} /> Poll
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
                  <Gamepad2 size={16} color={clr.textDark} /> Game
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
                  <HelpCircle size={16} color={clr.textDark} /> Question
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
                    <XCircle size={16} color="#DC2626" /> Cancel Question
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
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Flag size={15} color={clr.textDark} /> Report message
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
