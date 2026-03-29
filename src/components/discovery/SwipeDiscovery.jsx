import { useState, useMemo, useRef, useEffect } from 'react'
import { people, circles, events } from '../../data/mockData'
import { useAppContext } from '../../context/AppContext.jsx'

/* ── Colors (from app theme) ── */
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

/* ── DiscoveryCard Component ── */
function DiscoveryCard({ card }) {
  if (card.type === 'person') {
    const p = card.data
    return (
      <div style={{
        height: 520, display:'flex', flexDirection:'column',
        backgroundColor: clr.white, borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ position:'relative', height:'55%' }}>
          <img src={p.avatar} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:'40%',
            background:'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)'
          }}/>
        </div>
        <div style={{ flex:1, padding: '20px', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <h2 style={{ margin:0, fontSize:26, fontWeight:800, color: clr.textDark, fontFamily:"'DM Serif Display','Georgia',serif" }}>
              {p.name.split(' ')[0]}, {p.age}
            </h2>
            {p.online && <div style={{ width:12, height:12, borderRadius:'50%', backgroundColor: 'var(--green, #22C55E)' }} />}
          </div>
          <p style={{ margin:'0 0 12px 0', fontSize:14, color: clr.textMid }}>
            {p.city} • <span style={{ fontWeight: 700 }}>📍 {card.distance} miles away</span>
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
            {p.interests?.slice(0,4).map(i => (
              <span key={i} style={{ padding:'4px 10px', borderRadius:999, backgroundColor:clr.indigoLt, color:clr.indigo, fontSize:12, fontWeight:700 }}>
                {i}
              </span>
            ))}
          </div>
          <p style={{ margin:0, fontSize:14, color:clr.textDark, lineHeight:1.5 }}>{p.bio}</p>
        </div>
      </div>
    )
  }

  if (card.type === 'circle') {
    const c = card.data
    return (
      <div style={{
        height: 520, display:'flex', flexDirection:'column',
        backgroundColor: clr.white, borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          height: 160, background: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)', // Or circle color
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:64
        }}>
          {c.emoji ?? '⭕'}
        </div>
        <div style={{ flex:1, padding: '24px', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'inline-block', marginBottom:12 }}>
             <span style={{ padding:'4px 12px', borderRadius:999, backgroundColor:clr.indigoLt, color:clr.indigo, fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>
               {c.type === 'private' ? 'Private Circle' : 'Open Circle'}
             </span>
          </div>
          <h2 style={{ margin:'0 0 8px 0', fontSize:26, fontWeight:800, color: clr.textDark }}>{c.name}</h2>
          <p style={{ margin:'0 0 16px', fontSize:15, color: clr.textMid }}>
            {c.memberCount ?? c.members?.length ?? 0} members • <span style={{ fontWeight: 700 }}>📍 {card.distance} miles away</span>
          </p>
          <p style={{ margin:0, fontSize:15, color:clr.textDark, lineHeight:1.5 }}>{c.description}</p>
        </div>
      </div>
    )
  }

  if (card.type === 'event') {
    const e = card.data
    return (
      <div style={{
        height: 520, display:'flex', flexDirection:'column',
        backgroundColor: clr.white, borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          height: 160, background: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:64
        }}>
          {e.emoji ?? '📅'}
        </div>
        <div style={{ flex:1, padding: '24px', display:'flex', flexDirection:'column', gap:14 }}>
          <h2 style={{ margin:0, fontSize:24, fontWeight:800, color: clr.textDark }}>{e.title}</h2>
          <div style={{ display:'flex', alignItems:'center', gap:10, color:clr.textMid, fontSize:15 }}>
            <span style={{ fontSize:18 }}>📅</span> {e.date} • {e.time}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, color:clr.textMid, fontSize:15 }}>
            <span style={{ fontSize:18 }}>📍</span> {e.location} • <span style={{ fontWeight: 700 }}>{card.distance} miles away</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, color:clr.textMid, fontSize:15 }}>
            <span style={{ fontSize:18 }}>🎟️</span> Hosted by {e.circleName ?? 'Community'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, color:clr.textMid, fontSize:15 }}>
            <span style={{ fontSize:18 }}>👥</span> {e.attendees?.length ?? 0} attending
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function SwipeDiscovery({ onClose }) {
  const { joinCircle, startDM, sendMessage, discoverySwipes, recordSwipe, searchRadius } = useAppContext()
  const [activeFilters, setActiveFilters] = useState(['people', 'circles', 'events'])
  const [cardIndex, setCardIndex] = useState(0)
  
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  
  const [showMessageDraft, setShowMessageDraft] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [currentMatchCard, setCurrentMatchCard] = useState(null)
  
  const cardRef = useRef(null)
  const dragStartX = useRef(0)
  const wheelAccumulator = useRef(0)
  const isSwiping = useRef(false)
  const wheelTimer = useRef(null)

  const toggleFilter = (f) => {
    setActiveFilters(prev => {
      if (f === 'all') return ['people', 'circles', 'events']
      if (prev.includes(f)) {
        const next = prev.filter(x => x !== f)
        if (next.length === 0) return ['people', 'circles', 'events']
        return next
      }
      return [...prev, f]
    })
    setCardIndex(0)
  }

  const allCards = useMemo(() => {
    const cards = []
    const today = new Date().toDateString()
    const swipes = discoverySwipes.date === today ? discoverySwipes : { person:0, circle:0, event:0 }

    const getMockDist = (id) => ((String(id).charCodeAt(0) * 13 + String(id).length * 7) % 50) + 1

    if (activeFilters.includes('people')) {
      const allowed = Math.max(0, 5 - (swipes.person || 0))
      cards.push(...people
        .filter(p => getMockDist(p.id) <= searchRadius)
        .slice(0, allowed)
        .map(p => ({ type: 'person', data: p, distance: getMockDist(p.id) }))
      )
    }
    if (activeFilters.includes('circles')) {
      const allowed = Math.max(0, 5 - (swipes.circle || 0))
      cards.push(...circles
        .filter(c => getMockDist(c.id) <= searchRadius)
        .slice(0, allowed)
        .map(c => ({ type: 'circle', data: c, distance: getMockDist(c.id) }))
      )
    }
    if (activeFilters.includes('events')) {
      cards.push(...events
        .filter(e => getMockDist(e.id) <= searchRadius)
        .map(e => ({ type: 'event', data: e, distance: getMockDist(e.id) }))
      )
    }
    return cards.sort(() => Math.random() - 0.5)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, searchRadius])

  const currentCard = allCards[cardIndex]
  const nextCard = allCards[cardIndex + 1]

  const advanceCard = () => {
    setCardIndex(i => i + 1)
  }

  const handleSwipeRight = () => {
    if (!currentCard) return
    recordSwipe(currentCard.type)
    if (currentCard.type === 'circle') {
      joinCircle(currentCard.data.id)
      advanceCard()
    } else if (currentCard.type === 'event') {
      advanceCard()
    } else if (currentCard.type === 'person') {
      setCurrentMatchCard(currentCard)
      setDraftMessage(`Hey ${currentCard.data.name.split(' ')[0]}! I'd love to connect 👋`)
      setShowMessageDraft(true)
    }
  }

  const handleSwipeLeft = () => {
    if (!currentCard) return
    recordSwipe(currentCard.type)
    advanceCard()
  }

  const handleDragStart = (e) => {
    setIsDragging(true)
    dragStartX.current = e.clientX
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e) => {
    if (!isDragging) return
    setDragX(e.clientX - dragStartX.current)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    const threshold = 100
    if (dragX > threshold) {
      setDragX(500)
      setTimeout(() => {
        handleSwipeRight()
        setDragX(0)
      }, 250)
    } else if (dragX < -threshold) {
      setDragX(-500)
      setTimeout(() => {
        handleSwipeLeft()
        setDragX(0)
      }, 250)
    } else {
      setDragX(0)
    }
  }

  const handleWheel = (e) => {
    if (isSwiping.current || isDragging) return
    
    // Check if horizontal scrolling
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // deltaX > 0 means the user is swiping left on trackpad (content moves left)
      // Accumulate inverted deltaX to simulate dragX
      wheelAccumulator.current -= e.deltaX
      setDragX(wheelAccumulator.current)
      
      const threshold = 150
      if (wheelAccumulator.current > threshold) {
        isSwiping.current = true
        setDragX(500)
        setTimeout(() => {
          handleSwipeRight()
          setDragX(0)
          wheelAccumulator.current = 0
        }, 250)
        setTimeout(() => { isSwiping.current = false }, 800)
      } else if (wheelAccumulator.current < -threshold) {
        isSwiping.current = true
        setDragX(-500)
        setTimeout(() => {
          handleSwipeLeft()
          setDragX(0)
          wheelAccumulator.current = 0
        }, 250)
        setTimeout(() => { isSwiping.current = false }, 800)
      } else {
        clearTimeout(wheelTimer.current)
        wheelTimer.current = setTimeout(() => {
          setDragX(0)
          wheelAccumulator.current = 0
        }, 150)
      }
    }
  }

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'people', label: 'People 👤' },
    { id: 'circles', label: 'Circles 🔵' },
    { id: 'events', label: 'Events 📅' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: clr.bg, fontFamily: "'DM Sans', 'Inter', sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Centered Top Content */}
      <div style={{ width: '100%', maxWidth: 500, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 24px', flexShrink: 0, position: 'relative'
        }}>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            <button onClick={onClose} style={{
              width: 40, height: 40, borderRadius: '50%', border: 'none',
              backgroundColor: clr.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer'
            }}>
              <svg width="20" height="20" fill="none" stroke={clr.textDark} strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: clr.textDark, fontFamily: "'DM Serif Display', 'Georgia', serif", letterSpacing: '-0.02em' }}>
              Discover
            </h1>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: clr.textMid, textAlign: 'right' }}>
              {activeFilters.length === 3 ? 'Everything' : activeFilters.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(' · ')}
            </span>
          </div>
        </div>

        {/* Filter bubbles */}
        <div style={{ overflowX: 'auto', padding: '16px 20px 20px', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: clr.textMid, marginRight: 4 }}>Filter by:</span>
            {FILTERS.map(f => {
              const isActive = f.id === 'all' ? activeFilters.length === 3 : activeFilters.includes(f.id)
              return (
                <button key={f.id} onClick={() => toggleFilter(f.id)} style={{
                  padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
                  border: isActive ? 'none' : `1.5px solid ${clr.border}`,
                  backgroundColor: isActive ? clr.indigo : clr.white,
                  color: isActive ? '#FFFFFF' : clr.textDark,
                  fontSize: 14, fontWeight: 700,
                  boxShadow: isActive ? '0 4px 12px rgba(91,95,239,0.3)' : 'none',
                }}>
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Card stack area */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', padding: '0 20px',
      }}>
        {/* Next Card */}
        {nextCard && (
          <div style={{
            position: 'absolute', width: '88%', maxWidth: 400,
            transform: 'scale(0.94) translateY(16px)',
            opacity: 0.7, zIndex: 1, pointerEvents: 'none'
          }}>
            <DiscoveryCard card={nextCard} />
          </div>
        )}

        {/* Current Card */}
        {currentCard ? (
          <div
            key={`${currentCard.type}-${currentCard.data.id}`}
            ref={cardRef}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onWheel={handleWheel}
            style={{
              position: 'absolute', width: '88%', maxWidth: 400,
              transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              zIndex: 2, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
            }}
          >
            {dragX > 40 && (
              <div style={{
                position: 'absolute', top: 30, left: 30, zIndex: 10,
                backgroundColor: clr.indigo, color: '#FFF',
                padding: '8px 20px', borderRadius: 999, fontSize: 18, fontWeight: 800,
                opacity: Math.min(dragX / 80, 1), border: '4px solid #FFF',
                transform: 'rotate(-12deg)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}>
                {currentCard.type === 'person' ? '👋 CONNECT' : currentCard.type === 'circle' ? '✓ JOIN' : '✓ RSVP'}
              </div>
            )}
            {dragX < -40 && (
              <div style={{
                position: 'absolute', top: 30, right: 30, zIndex: 10,
                backgroundColor: clr.white, color: clr.textLight,
                padding: '8px 20px', borderRadius: 999, fontSize: 18, fontWeight: 800,
                opacity: Math.min(Math.abs(dragX) / 80, 1), border: `4px solid ${clr.border}`,
                transform: 'rotate(12deg)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                PASS
              </div>
            )}
            <DiscoveryCard card={currentCard} />
          </div>
        ) : (
          /* Empty State */
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: clr.textDark, marginBottom: 8 }}>You're all caught up!</h2>
            <p style={{ fontSize: 15, color: clr.textMid, marginBottom: 24, lineHeight: 1.5 }}>
              Check back later for new people and events near you.
            </p>
            <button onClick={() => setCardIndex(0)} style={{
              padding: '12px 32px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
              color: '#FFFFFF', fontSize: 15, fontWeight: 700,
              boxShadow: '0 6px 20px rgba(91,95,239,0.3)',
            }}>
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {currentCard && (
        <div style={{
          flexShrink: 0, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
          paddingBottom: 'max(40px, env(safe-area-inset-bottom))'
        }}>
          <button onClick={() => { 
            setDragX(-500)
            setTimeout(() => {
              handleSwipeLeft()
              setDragX(0)
            }, 250)
          }} style={{
            width: 64, height: 64, borderRadius: '50%', backgroundColor: clr.white,
            border: `1.5px solid ${clr.border}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
          }}>
            <svg width="24" height="24" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <span style={{ fontSize: 13, fontWeight: 700, color: clr.textMid }}>
            {cardIndex + 1} / {allCards.length}
          </span>

          <button onClick={() => { 
            setDragX(500)
            setTimeout(() => {
              handleSwipeRight()
              setDragX(0)
            }, 250)
          }} style={{
            width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #5B5FEF, #7B6FFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(91,95,239,0.4)'
          }}>
            <svg width="32" height="32" fill="none" stroke="#FFFFFF" strokeWidth="3" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* Message Draft Popup */}
      {showMessageDraft && currentMatchCard && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          backgroundColor: 'rgba(15,15,30,0.5)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', backgroundColor: clr.white,
            borderRadius: '24px 24px 0 0', padding: '24px 20px 40px',
            animation: 'slideUp 0.3s ease-out forwards',
          }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <img src={currentMatchCard.data.avatar} alt="" style={{
                width: 72, height: 72, borderRadius: '50%',
                objectFit: 'cover', margin: '0 auto 12px',
                border: `3px solid ${clr.indigo}`,
              }}/>
              <p style={{ fontSize: 20, fontWeight: 800, color: clr.textDark, margin: '0 0 4px 0' }}>
                Say hi to {currentMatchCard.data.name.split(' ')[0]}! 👋
              </p>
              <p style={{ fontSize: 14, color: clr.textMid, margin: 0 }}>
                Send a quick message to start the conversation
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, justifyContent: 'center' }}>
              {[
                `Hey! I'd love to connect 👋`,
                `Your interests caught my eye!`,
                `Want to grab coffee sometime?`,
              ].map(suggestion => (
                <button key={suggestion}
                  onClick={() => setDraftMessage(suggestion)}
                  style={{
                    padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${clr.border}`,
                    backgroundColor: draftMessage === suggestion ? clr.indigoLt : clr.white,
                    color: draftMessage === suggestion ? clr.indigo : clr.textMid,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
                  }}>
                  {suggestion}
                </button>
              ))}
            </div>

            <textarea
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 16px', borderRadius: 16,
                border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg,
                fontSize: 15, color: clr.textDark, resize: 'none', outline: 'none',
                fontFamily: 'inherit', marginBottom: 16,
              }}
              onFocus={e => e.target.style.borderColor = clr.indigo}
              onBlur={e => e.target.style.borderColor = clr.border}
            />

            <button
              onClick={() => {
                const chatId = startDM(currentMatchCard.data)
                sendMessage(chatId, draftMessage)
                setShowMessageDraft(false)
                setCurrentMatchCard(null)
                advanceCard()
              }}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 999, border: 'none',
                background: 'linear-gradient(135deg, #5B5FEF, #7B6FFF)',
                color: '#FFFFFF', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(91,95,239,0.38)', marginBottom: 16,
              }}
            >
              Send Message →
            </button>

            <button
              onClick={() => {
                setShowMessageDraft(false)
                setCurrentMatchCard(null)
                advanceCard()
              }}
              style={{
                width: '100%', background: 'none', border: 'none',
                fontSize: 14, fontWeight: 600, color: clr.textLight, cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
