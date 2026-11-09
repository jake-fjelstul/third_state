import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { listCircleMates } from '../lib/profiles'
import { listMessages } from '../lib/chat.js'
import { prefetchMessages } from '../lib/chatCache.js'
import { avatarFor } from '../lib/avatar'
import GamePicker from '../components/games/GamePicker.jsx'
import SoloGameModal from '../components/games/SoloGameModal.jsx'
import SwipeableRow from '../components/chat/SwipeableRow.jsx'
import ConfirmCard from '../components/assistant/messages/ConfirmCard.jsx'
import ThreadView, { clr, GroupAvatar, UserAvatar, normChat } from '../components/chat/ThreadView.jsx'
import { Gamepad2, Search, SquarePen } from 'lucide-react'
import { Avatar, IconButton, LargeTitle, ListRow } from '../components/ui/ds.jsx'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight.js'
import { canGoBack } from '../lib/tabActive.js'

/* ── New Chat Modal (iPhone-style) ── */
function NewChatModal({ onClose, onSelect, joinedCircles, currentUser, chatState, connections }) {
  const kbHeight = useKeyboardHeight()
  const [contactSearch, setContactSearch] = useState('')
  const [circleMates, setCircleMates] = useState([])
  const { blockedUserIds } = useAppContext()

  // listCircles() never returned members, so circle-mates never showed (M11).
  useEffect(() => {
    let cancelled = false
    listCircleMates()
      .then(list => { if (!cancelled) setCircleMates(list) })
      .catch(err => console.error('[NewChatModal] listCircleMates failed', err))
    return () => { cancelled = true }
  }, [])

  const contacts = useMemo(() => {
    const seen = new Set()
    const result = []
    if (currentUser?.id) seen.add(currentUser.id)

    ;(blockedUserIds || []).forEach(id => seen.add(id))

    // Connections first, then people from my circles
    connections?.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        result.push(p)
      }
    })
    circleMates.forEach(member => {
      if (!seen.has(member.id)) {
        seen.add(member.id)
        result.push(member)
      }
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

    return result
  }, [chatState, currentUser, circleMates, connections, blockedUserIds])

  const filtered = contactSearch.trim()
    ? contacts.filter(p => p.name.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      backgroundColor: 'rgba(15,15,30,0.5)',
      display: 'flex', alignItems: 'flex-end',
      paddingBottom: kbHeight, transition: 'padding-bottom 0.25s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', backgroundColor: clr.bg,
        borderRadius: '24px 24px 0 0',
        maxHeight: kbHeight > 0 ? `calc(100dvh - ${kbHeight}px - 48px)` : '75vh', display: 'flex', flexDirection: 'column',
        animation: 'tsSheetUp 0.34s cubic-bezier(0.32, 0.72, 0, 1) both',
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
  const location = useLocation()
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
        <div style={{ height:'100dvh', display:'flex', flexDirection:'column', backgroundColor:clr.bg, fontFamily: 'inherit' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'max(16px, calc(env(safe-area-inset-top) + 12px)) 20px 16px', backgroundColor:clr.bg, borderBottom:`1px solid ${clr.border}` }}>
            <button onClick={() => (canGoBack() ? navigate(-1) : navigate('/chat'))} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
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

    // Pop back to whatever is underneath (chat list, circle page...).
    return <ThreadView chat={chat} baseId={baseId} channelId={channelId} onBack={() => (canGoBack() ? navigate(-1) : navigate('/chat'))} />
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
 
  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', backgroundColor: 'var(--bg)' }}>
      <LargeTitle right={
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <IconButton label="Games" onClick={() => setShowGamePicker(true)}><Gamepad2 size={24} strokeWidth={1.9} /></IconButton>
          <IconButton label="New message" onClick={() => setShowCompose(true)}><SquarePen size={23} strokeWidth={1.9} /></IconButton>
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
      }>Messages</LargeTitle>

      {/* Search */}
      <div style={{ padding: '4px 16px 8px' }}>
        <div style={{ height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
          <Search size={18} color="var(--textLight)" aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search messages"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: 'var(--textDark)', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Chat list: edge-to-edge rows; circles get rounded-square avatars */}
      <div>
        {filtered.length === 0 && (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--textMid)', fontSize: 15 }}>
            {search.trim() ? 'No chats match that search.' : 'No messages yet. Start one with the pencil above.'}
          </div>
        )}
        {filtered.map((chat) => {
          const { isGroup, name, preview, time, unread, avatar } = normChat(chat)
          return (
            <SwipeableRow
              key={chat.id}
              enabled={!isGroup}
              isOpen={openRowId === chat.id}
              onOpenChange={(open) => setOpenRowId(open ? chat.id : null)}
              onClick={() => navigate(`/chat/${chat.id}`)}
              onLongPress={() => setActionSheetChat({ id: chat.id, name })}
              onDelete={() => { setOpenRowId(null); setConfirmDeleteChat({ id: chat.id, name }) }}
              background="var(--bg)"
            >
              <div
                // Start loading on finger-down so the thread opens with messages (item 3).
                onPointerDown={() => { if (!isGroup) prefetchMessages(chat.id, null, () => listMessages(chat.id)) }}
                style={{ width: '100%' }}
              >
                <ListRow
                  leading={<Avatar src={avatar} name={name} size={56} square={isGroup} />}
                  title={name}
                  subtitle={preview}
                  meta={time}
                  unread={unread > 0}
                />
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

