import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { people, circles } from '../data/mockData'
 
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
  const isGroup   = chat.type === 'group' || !!chat.circleName
  const name      = chat.name ?? chat.circleName ?? 'Unknown'
  const lastMsg   = chat.messages?.[chat.messages.length - 1]
  const preview   = lastMsg
    ? `${lastMsg.sender !== 'You' ? lastMsg.sender + ': ' : ''}${lastMsg.text}`
    : chat.lastMessage ?? ''
  const time      = chat.time ?? chat.lastTime ?? ''
  const unread    = chat.unread ?? 0
  const avatar    = chat.avatar ?? chat.participants?.[0]?.avatar ?? null
  const online    = chat.online ?? false
  return { isGroup, name, preview, time, unread, avatar, online }
}
 
/* ── Full thread view ── */
function ThreadView({ chat, onBack }) {
  const [input, setInput] = useState('')
  const { name, avatar, online, isGroup } = normChat(chat)
  const messages = chat.messages ?? []
  
  const { sendMessage, setChatState } = useAppContext()
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setChatState(prev => {
      if (!prev[chat.id] || prev[chat.id].unread === 0) return prev
      return {
        ...prev,
        [chat.id]: { ...prev[chat.id], unread: 0 }
      }
    })
  }, [chat.id, setChatState])

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(chat.id, input)
    setInput('')
  }
 
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 80px)', backgroundColor: clr.bg,
      fontFamily: "'DM Sans','Inter',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px',
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
 
      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:10 }}>
        {messages.map((msg, i) => {
          const isMe = msg.sender === 'You'
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && isGroup && (
                <span style={{ fontSize:11, color: clr.textLight, marginBottom:3, marginLeft:4 }}>{msg.sender}</span>
              )}
              <div style={{
                maxWidth: '72%',
                padding: '11px 14px',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: isMe ? clr.indigo : clr.indigoLt,
                color: isMe ? '#FFFFFF' : clr.textDark,
                fontSize: 14, lineHeight: 1.5,
                boxShadow: isMe ? '0 4px 14px rgba(91,95,239,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                {msg.text}
              </div>
              <span style={{ fontSize:11, color: clr.textLight, marginTop:4, marginLeft:4, marginRight:4 }}>
                {msg.time ?? ''}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
 
      {/* Input bar */}
      <form onSubmit={handleSend} style={{
        padding: '12px 16px',
        backgroundColor: clr.bg,
        borderTop: `1px solid ${clr.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex:1, padding:'12px 16px', borderRadius:999,
            border:`1.5px solid ${clr.border}`,
            backgroundColor: clr.bg,
            fontSize:14, color: clr.textDark,
            outline:'none', fontFamily:'inherit',
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
    </div>
  )
}

/* ── New Chat Modal (iPhone-style) ── */
function NewChatModal({ onClose, onSelect, joinedCircles, currentUser, chatState }) {
  const [contactSearch, setContactSearch] = useState('')

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
        const person = people.find(p => p.id === chat.personId)
        if (person) {
          seen.add(person.id)
          result.push(person)
        }
      }
    })

    // Also include all people as fallback
    people.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        result.push(p)
      }
    })

    return result
  }, [joinedCircles, chatState, currentUser])

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
                  <img src={person.avatar} alt={person.name} style={{
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
  const { chatState, startDM, joinedCircles, currentUser } = useAppContext()
  const [search, setSearch] = useState('')
  const [showCompose, setShowCompose] = useState(false)

  if (id) {
    const chat = chatState[id]
    if (!chat) {
      return (
        <div style={{ height:'calc(100vh - 80px)', display:'flex', flexDirection:'column', backgroundColor:clr.bg, fontFamily:"'DM Sans','Inter',sans-serif" }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', backgroundColor:clr.bg, borderBottom:`1px solid ${clr.border}` }}>
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
    return <ThreadView chat={chat} onBack={() => navigate('/chat')} />
  }

  const filtered = Object.values(chatState).filter(c => {
    const { name } = normChat(c)
    return name.toLowerCase().includes(search.toLowerCase())
  }).sort((a,b) => {
    const tA = new Date(`1970/01/01 ${a.time || '12:00 AM'}`).getTime() || 0
    const tB = new Date(`1970/01/01 ${b.time || '12:00 AM'}`).getTime() || 0
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
 
      <h1 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, margin: 0, padding: '16px 20px 16px', letterSpacing: '-0.02em', fontFamily: "'DM Serif Display', 'Georgia', serif", textAlign: 'center' }}>
        Chat
      </h1>

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
            <button
              key={chat.id}
              type="button"
              onClick={() => navigate(`/chat/${chat.id}`)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:14,
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
            </button>
          )
        })}
      </div>
 
      {/* ── New Chat Modal ── */}
      {showCompose && (
        <NewChatModal
          onClose={() => setShowCompose(false)}
          onSelect={(person) => {
            const chatId = startDM(person)
            setShowCompose(false)
            navigate(`/chat/${chatId}`)
          }}
          joinedCircles={joinedCircles}
          currentUser={currentUser}
          chatState={chatState}
        />
      )}

    </div>
  )
}

