import { useState } from 'react'
import { chats } from '../data/mockData'
 
const clr = {
  bg:         '#F0F0F5',
  white:      '#FFFFFF',
  indigo:     '#5B5FEF',
  indigoLt:   '#EEEEFF',
  amber:      '#F59E0B',
  textDark:   '#1A1A2E',
  textMid:    '#6B7280',
  textLight:  '#9CA3AF',
  border:     '#E8E8EE',
  green:      '#22C55E',
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
 
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', backgroundColor: clr.bg,
      fontFamily: "'DM Sans','Inter',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px',
        backgroundColor: clr.white,
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
                backgroundColor: isMe ? clr.indigo : clr.white,
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
      </div>
 
      {/* Input bar */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: clr.white,
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
        <button type="button" style={{
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
      </div>
    </div>
  )
}
 
/* ── Main Chat page ── */
export default function Chat() {
  const [activeChat, setActiveChat] = useState(null)
  const [search, setSearch]         = useState('')
 
  if (activeChat) {
    return <ThreadView chat={activeChat} onBack={() => setActiveChat(null)} />
  }
 
  const filtered = chats.filter(c => {
    const { name } = normChat(c)
    return name.toLowerCase().includes(search.toLowerCase())
  })
 
  /* alternate group avatar colors */
  const groupColors = [clr.indigo, '#6B7280', '#10B981', '#F43F5E']
 
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans','Inter',sans-serif",
    }}>
 
      {/* ── Top bar ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'20px 24px 16px',
        backgroundColor: clr.bg,
      }}>
        <button type="button" style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
          <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2.2" viewBox="0 0 24 24">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span style={{ fontSize:18, fontWeight:800, color: clr.textDark }}>Third Space</span>
        <button type="button" style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
          <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
 
      {/* ── Search bar ── */}
      <div style={{ padding:'0 20px 16px' }}>
        <div style={{ position:'relative' }}>
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
              border:'none',
              backgroundColor: '#E8E8F0',
              fontSize:15, color: clr.textDark,
              outline:'none', fontFamily:'inherit',
            }}
          />
        </div>
      </div>
 
      {/* ── Chat list ── */}
      <div style={{ backgroundColor: clr.white, marginTop:4 }}>
        {filtered.map((chat, idx) => {
          const { isGroup, name, preview, time, unread, avatar, online } = normChat(chat)
          const isActive = unread > 0
 
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => setActiveChat(chat)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:14,
                padding:'16px 20px',
                backgroundColor: isActive ? clr.activeRow : clr.white,
                borderLeft: isActive ? `4px solid ${clr.indigo}` : '4px solid transparent',
                borderTop:'none', borderRight:'none', borderBottom:`1px solid ${clr.border}`,
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
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{
                    fontSize:16, fontWeight:700, color: clr.textDark,
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
                      backgroundColor: clr.amber,
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
 
    </div>
  )
}

