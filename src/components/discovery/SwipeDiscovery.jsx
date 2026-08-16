import { useState, useMemo, useRef, useEffect } from 'react'
import { listVisibleCircles, listHoopsByCircle, listMyApplications, isDiscoverable, requiresApplication as requiresApp } from '../../lib/circles'
import { listProfiles } from '../../lib/profiles'
import { listUpcomingEvents } from '../../lib/events'
import { listActiveLfgPosts, joinLfgPost, timeLeftLabel } from '../../lib/lfg'
import { useAppContext } from '../../context/AppContext.jsx'
import { avatarFor } from '../../lib/avatar'
import { resolveCircleCover } from '../../lib/circleCover'
import CircleIcon from '../ui/CircleIcon.jsx'
import { haversineMiles } from '../../lib/geo'
import HoopApplication from '../hoops/HoopApplication.jsx'

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

// Note: Using client-side storage (@capacitor/preferences) for passes as a lightweight solution.
// A server-side passes table would be the long-term solution to sync across devices/reinstalls.
const PASSED_STORAGE_KEY = 'ts.discovery.passed'

function scoreCard(card, currentUser) {
  let score = 0
  let reason = ''
  
  if (card.type === 'person') {
    const sharedInterests = card.data.interests?.filter(i => currentUser?.interests?.includes(i)) || []
    if (sharedInterests.length >= 2) {
      score += 10
      reason = `You both like ${sharedInterests[0]}`
    } else if (card.data.intent && card.data.intent === currentUser?.intent) {
      score += 5
      reason = `Both looking to ${card.data.intent.replace(/^to /i, '')}`
    } else {
      score += 1
      reason = 'New in your area'
    }
  } else if (card.type === 'circle') {
    score += 5
    reason = 'Popular in your area'
  } else if (card.type === 'event') {
    score += 5
    reason = 'Happening soon'
  } else if (card.type === 'lfg') {
    score += 10
    reason = 'Free right now'
  }
  
  return { ...card, score, matchReason: reason }
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
          <img src={avatarFor(p)} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:'40%',
            background:'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)'
          }}/>
        </div>
        <div style={{ flex:1, padding: '20px', display:'flex', flexDirection:'column' }}>
          {card.matchReason && (
            <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, backgroundColor: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, alignSelf: 'flex-start' }}>
              ✨ {card.matchReason}
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <h2 style={{ margin:0, fontSize:26, fontWeight:800, color: clr.textDark, fontFamily:"'DM Serif Display','Georgia',serif" }}>
              {p.name.split(' ')[0]}, {p.age}
            </h2>
            {p.online && <div style={{ width:12, height:12, borderRadius:'50%', backgroundColor: 'var(--green, #22C55E)' }} />}
          </div>
          <p style={{ margin:'0 0 12px 0', fontSize:14, color: clr.textMid }}>
            {p.city}{typeof card.distance === 'number' ? <> • <span style={{ fontWeight: 700 }}>📍 {card.distance} miles away</span></> : null}
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
    const cover = resolveCircleCover(c)
    return (
      <div style={{
        height: 520, display:'flex', flexDirection:'column',
        backgroundColor: clr.white, borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          height: 160, background: cover.kind === 'gradient' ? cover.value : undefined,
          display:'flex', alignItems:'center', justifyContent:'center', position: 'relative', overflow: 'hidden'
        }}>
          {cover.kind === 'image' && <img src={cover.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          <CircleIcon circle={c} size={48} color="#FFFFFF" style={{ position: 'relative' }} />
        </div>
        <div style={{ flex:1, padding: '24px', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', gap: 8, marginBottom:12, flexWrap: 'wrap' }}>
             {card.matchReason && (
               <span style={{ padding:'4px 12px', borderRadius:999, backgroundColor:'#FEF3C7', color:'#D97706', fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                 ✨ {card.matchReason}
               </span>
             )}
             <span style={{ padding:'4px 12px', borderRadius:999, backgroundColor:clr.indigoLt, color:clr.indigo, fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>
               {card.requiresApplication ? 'Application Required' : 'Open Circle'}
             </span>
          </div>
          <h2 style={{ margin:'0 0 8px 0', fontSize:26, fontWeight:800, color: clr.textDark }}>{c.name}</h2>
          <p style={{ margin:'0 0 16px', fontSize:15, color: clr.textMid }}>
            {c.memberCount ?? c.members?.length ?? 0} members{c.city ? ` • ${c.city}` : ''}
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
        {e.coverImageUrl ? (
          <img src={e.coverImageUrl} alt={e.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
        ) : (
          <div style={{
            height: 160, background: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:64
          }}>
            {e.emoji ?? '📅'}
          </div>
        )}
        <div style={{ flex:1, padding: '24px', display:'flex', flexDirection:'column', gap:14 }}>
          {card.matchReason && (
            <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, backgroundColor: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'flex-start' }}>
              ✨ {card.matchReason}
            </div>
          )}
          <h2 style={{ margin:0, fontSize:24, fontWeight:800, color: clr.textDark }}>{e.title}</h2>
          <div style={{ display:'flex', alignItems:'center', gap:10, color:clr.textMid, fontSize:15 }}>
            <span style={{ fontSize:18 }}>📅</span> {e.date} • {e.time}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, color:clr.textMid, fontSize:15 }}>
            <span style={{ fontSize:18 }}>📍</span> {e.location}{card.distance != null ? <> • <span style={{ fontWeight: 700 }}>{card.distance} miles away</span></> : null}
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

  if (card.type === 'lfg') {
    const p = card.data
    const authorFirstName = p.authorName ? p.authorName.split(' ')[0] : 'Someone'
    const formattedStartTime = p.startsAt
      ? new Date(p.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : ''
    return (
      <div style={{
        height: 520, display:'flex', flexDirection:'column',
        backgroundColor: clr.white, borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        {/* Amber accent header with Zap-style treatment */}
        <div style={{
          height: 160,
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          position: 'relative', overflow: 'hidden', color: '#FCD34D', padding: '16px', textAlign: 'center'
        }}>
          <div style={{ fontSize: 44, marginBottom: 4 }}>⚡</div>
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#FCD34D' }}>
            Looking For Group
          </span>
        </div>

        <div style={{ flex:1, padding: '24px', display:'flex', flexDirection:'column', gap: 14 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding:'4px 12px', borderRadius:999, backgroundColor:'#FEF3C7', color:'#D97706', fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>
              ⏱️ {timeLeftLabel(p.expiresAt)}
            </span>
            {p.visibility === 'friends' && (
              <span style={{ padding:'4px 12px', borderRadius:999, backgroundColor:clr.indigoLt, color:clr.indigo, fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                🔒 Friends only
              </span>
            )}
          </div>

          <h2 style={{ margin:0, fontSize:24, fontWeight:800, color: clr.textDark, lineHeight: 1.3 }}>
            {p.activity}
          </h2>

          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <img
              src={avatarFor({ avatar_url: p.authorAvatar, name: p.authorName })}
              alt={authorFirstName}
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
            />
            <span style={{ fontSize: 15, fontWeight: 700, color: clr.textDark }}>
              {authorFirstName} wants to hang out
            </span>
          </div>

          {formattedStartTime && (
            <div style={{ display:'flex', alignItems:'center', gap: 10, color: clr.textMid, fontSize: 15 }}>
              <span style={{ fontSize: 18 }}>🕒</span> Starts at {formattedStartTime}
            </div>
          )}

          {(p.placeName || p.placeAddress) && (
            <div style={{ display:'flex', alignItems:'flex-start', gap: 10, color: clr.textMid, fontSize: 15 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
              <div>
                {p.placeName && <div style={{ fontWeight: 700, color: clr.textDark }}>{p.placeName}</div>}
                {p.placeAddress && <div style={{ fontSize: 13, color: clr.textLight }}>{p.placeAddress}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

export default function SwipeDiscovery({ onClose }) {
  const { joinCircle, rsvpEvent, startDM, sendMessage, connectWithPerson, discoverySwipes, recordSwipe, searchRadius, resetDiscoverySwipes, currentUser, connections, joinedCircles, isRsvpd, blockedUserIds } = useAppContext()
  const [activeFilters, setActiveFilters] = useState(['people', 'circles', 'events', 'lfg'])
  const [consumedIds, setConsumedIds] = useState([])
  
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [passedCards, setPassedCards] = useState({ person: [], circle: [], event: [], lfg: [] })
  
  const [showMessageDraft, setShowMessageDraft] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [currentMatchCard, setCurrentMatchCard] = useState(null)
  
  const cardRef = useRef(null)
  const currentCardRef = useRef(null)
  const dragStartX = useRef(0)
  const wheelAccumulator = useRef(0)
  const isSwiping = useRef(false)
  const wheelTimer = useRef(null)

  const [circles, setCircles] = useState([])
  const [people, setPeople] = useState([])
  const [events, setEvents] = useState([])
  const [lfgPosts, setLfgPosts] = useState([])
  const [hoopsByCircle, setHoopsByCircle] = useState({})
  const [appliedCircleIds, setAppliedCircleIds] = useState([])
  const [hoopCircle, setHoopCircle] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.get({ key: PASSED_STORAGE_KEY }).then(({ value }) => {
        if (!cancelled && value) {
          try {
            const parsed = JSON.parse(value)
            setPassedCards({
              person: Array.isArray(parsed?.person) ? parsed.person : [],
              circle: Array.isArray(parsed?.circle) ? parsed.circle : [],
              event: Array.isArray(parsed?.event) ? parsed.event : [],
              lfg: Array.isArray(parsed?.lfg) ? parsed.lfg : [],
            })
          } catch {}
        }
      }).catch(() => {})
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listProfiles(),
      listVisibleCircles(currentUser?.id),
      listUpcomingEvents({ limit: 50 }),
      listActiveLfgPosts(),
      listHoopsByCircle(),
      currentUser?.id ? listMyApplications(currentUser.id) : Promise.resolve([]),
    ])
      .then(([ppl, crc, evts, lfg, hoops, apps]) => {
        if (!cancelled) {
          setPeople(ppl)
          setCircles(crc)
          setEvents(evts)
          setLfgPosts(lfg)
          setHoopsByCircle(hoops)
          setAppliedCircleIds((apps || []).map(a => a.circle_id).filter(Boolean))
        }
      })
      .catch(err => console.error('[SwipeDiscovery] load failed', err))
    return () => { cancelled = true }
  }, [currentUser?.id])

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2500)
  }

  const toggleFilter = (f) => {
    setActiveFilters(prev => {
      if (f === 'all') return ['people', 'circles', 'events', 'lfg']
      if (prev.includes(f)) {
        const next = prev.filter(x => x !== f)
        if (next.length === 0) return ['people', 'circles', 'events', 'lfg']
        return next
      }
      return [...prev, f]
    })
  }

  const allCards = useMemo(() => {
    const scoredCards = []
    const today = new Date().toDateString()
    const swipes = discoverySwipes.date === today ? discoverySwipes : { person:0, circle:0, event:0 }

    const myLat = currentUser?.latitude
    const myLng = currentUser?.longitude
    const personDistanceTo = (person) => haversineMiles(myLat, myLng, person.latitude, person.longitude)
    const eventDistanceTo = (e) => haversineMiles(myLat, myLng, e.locationLat, e.locationLng)

    if (activeFilters.includes('people')) {
      const allowed = Math.max(0, 5 - (swipes.person || 0))
      if (allowed > 0) {
        const candidates = people
          .filter(p => {
            if (p.id === currentUser?.id) return false
            if (connections.some(c => c.id === p.id)) return false
            if (blockedUserIds?.includes(p.id)) return false
            if (passedCards.person?.includes(p.id)) return false
            if (consumedIds.includes(p.id)) return false
            const dist = personDistanceTo(p)
            return dist == null || dist <= searchRadius
          })
          .map(p => scoreCard({ type: 'person', data: p, distance: personDistanceTo(p) == null ? null : Math.round(personDistanceTo(p)) }, currentUser))
          .sort((a, b) => b.score !== a.score ? b.score - a.score : Math.random() - 0.5)
        scoredCards.push(...candidates)
      }
    }

    if (activeFilters.includes('circles')) {
      const allowed = Math.max(0, 5 - (swipes.circle || 0))
      if (allowed > 0) {
        const candidates = circles
          .filter(c => {
            if (joinedCircles.includes(c.id)) return false
            if (passedCards.circle?.includes(c.id)) return false
            if (consumedIds.includes(c.id)) return false
            if (appliedCircleIds.includes(c.id)) return false
            return isDiscoverable(c)
          })
          .map(c => scoreCard({
            type: 'circle',
            data: { ...c, hoops: hoopsByCircle[c.id] || [] },
            distance: null,
            requiresApplication: requiresApp(c),
          }, currentUser))
          .sort((a, b) => b.score !== a.score ? b.score - a.score : Math.random() - 0.5)
        scoredCards.push(...candidates)
      }
    }

    if (activeFilters.includes('events')) {
      const allowed = Math.max(0, 5 - (swipes.event || 0))
      if (allowed > 0) {
        const candidates = events
          .filter(e => {
            if (isRsvpd(e.id)) return false
            if (passedCards.event?.includes(e.id)) return false
            if (consumedIds.includes(e.id)) return false
            const dist = eventDistanceTo(e)
            return dist == null || dist <= searchRadius
          })
          .map(e => scoreCard({ type: 'event', data: e, distance: eventDistanceTo(e) == null ? null : Math.round(eventDistanceTo(e)) }, currentUser))
          .sort((a, b) => b.score !== a.score ? b.score - a.score : Math.random() - 0.5)
        scoredCards.push(...candidates)
      }
    }

    if (activeFilters.includes('lfg')) {
      const candidates = lfgPosts
        .filter(p => p.userId !== currentUser?.id)
        .filter(p => !passedCards.lfg?.includes(p.id))
        .filter(p => !consumedIds.includes(p.id))
        .filter(p => !blockedUserIds?.includes(p.userId))
        .map(p => ({ type: 'lfg', data: p, score: 1000 - Math.round((new Date(p.expiresAt) - Date.now()) / 60000) }))
      scoredCards.push(...candidates)
    }

    return scoredCards.sort((a, b) => b.score !== a.score ? b.score - a.score : Math.random() - 0.5)
  }, [activeFilters, searchRadius, circles, people, events, lfgPosts, currentUser, blockedUserIds, passedCards, hoopsByCircle, appliedCircleIds, discoverySwipes, consumedIds, connections, joinedCircles, isRsvpd])

  const currentCard = allCards[0]
  const nextCard = allCards[1]
  currentCardRef.current = currentCard

  const advanceCard = () => {
    const c = currentCardRef.current
    if (!c) return
    setConsumedIds(prev => prev.includes(c.data.id) ? prev : [...prev, c.data.id])
  }

  const handleSwipeRight = async () => {
    if (!currentCard || actionPending) return
    setActionPending(true)

    try {
      if (currentCard.type === 'circle') {
        if (currentCard.requiresApplication) {
          setHoopCircle(currentCard.data)
          // Do NOT advance or record — that happens on successful submission.
        } else {
          await joinCircle(currentCard.data.id)
          recordSwipe(currentCard.type)
          triggerToast(`Joined ${currentCard.data.name}`)
          advanceCard()
        }
      } else if (currentCard.type === 'event') {
        await rsvpEvent(currentCard.data)
        recordSwipe(currentCard.type)
        triggerToast(`You're going to ${currentCard.data.title}`)
        advanceCard()
      } else if (currentCard.type === 'lfg') {
        await joinLfgPost(currentCard.data.id)
        triggerToast(`You're in — say hi to ${currentCard.data.authorName.split(' ')[0]}`)
        advanceCard()
      } else if (currentCard.type === 'person') {
        setCurrentMatchCard(currentCard)
        setDraftMessage(`Hey ${currentCard.data.name.split(' ')[0]}! I'd love to connect 👋`)
        setShowMessageDraft(true)
      }
    } catch (err) {
      console.error('[SwipeDiscovery] handleSwipeRight failed', err)
      triggerToast(err?.message || 'Action failed')
    } finally {
      setActionPending(false)
    }
  }


  const handleSwipeLeft = async () => {
    if (!currentCard || actionPending) return
    recordSwipe(currentCard.type)

    const cardType = currentCard.type
    const cardId = currentCard.data.id

    setPassedCards(prev => {
      const existing = prev[cardType] || []
      if (existing.includes(cardId)) return prev
      const updated = [...existing, cardId].slice(-500)
      const nextState = { ...prev, [cardType]: updated }

      import('@capacitor/preferences').then(({ Preferences }) => {
        Preferences.set({
          key: PASSED_STORAGE_KEY,
          value: JSON.stringify(nextState),
        }).catch(() => {})
      }).catch(() => {})

      return nextState
    })

    advanceCard()
  }

  const handleDragStart = (e) => {
    if (actionPending) return
    setIsDragging(true)
    dragStartX.current = e.clientX
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e) => {
    if (!isDragging || actionPending) return
    setDragX(e.clientX - dragStartX.current)
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (actionPending) {
      setDragX(0)
      return
    }
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
    if (isSwiping.current || isDragging || actionPending) return
    
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
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
    { id: 'lfg', label: 'Free now ⚡' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: clr.bg, fontFamily: "'DM Sans', 'Inter', sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes fadeToast { 0% { opacity: 0; transform: translateX(-50%) translateY(20px); } 15% { opacity: 1; transform: translateX(-50%) translateY(0); } 85% { opacity: 1; transform: translateX(-50%) translateY(0); } 100% { opacity: 0; transform: translateX(-50%) translateY(20px); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      {/* Centered Top Content */}
      <div style={{ width: '100%', maxWidth: 500, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'max(20px, calc(env(safe-area-inset-top) + 12px)) 24px 24px', flexShrink: 0, position: 'relative'
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
              {activeFilters.length === 4 ? 'Everything' : activeFilters.map(f => f === 'lfg' ? 'Free now' : f.charAt(0).toUpperCase() + f.slice(1)).join(' · ')}
            </span>
          </div>
        </div>

        {/* Filter bubbles */}
        <div style={{ overflowX: 'auto', padding: '16px 20px 20px', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: clr.textMid, marginRight: 4 }}>Filter by:</span>
            {FILTERS.map(f => {
              const isActive = f.id === 'all' ? activeFilters.length === 4 : activeFilters.includes(f.id)
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
                {currentCard.type === 'person' ? '👋 CONNECT' : currentCard.type === 'circle' ? (currentCard.requiresApplication ? '✓ APPLY' : '✓ JOIN') : currentCard.type === 'lfg' ? '⚡ JOIN' : '✓ RSVP'}
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
          <div style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', backgroundColor: clr.indigoLt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, marginBottom: 24 }}>
              🔭
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, marginBottom: 12 }}>You're all caught up!</h2>
            <p style={{ fontSize: 16, color: clr.textMid, marginBottom: 32, lineHeight: 1.6, maxWidth: 320 }}>
              You've seen all the matches in your area based on your current filters. Check back later or try adjusting your settings.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 240 }}>
              {(Object.keys(discoverySwipes).some(k => discoverySwipes[k] > 0 && k !== 'date') || Object.values(passedCards).some(arr => arr.length > 0) || consumedIds.length > 0) && (
                <button onClick={() => {
                  resetDiscoverySwipes()
                  setPassedCards({ person: [], circle: [], event: [], lfg: [] })
                  setConsumedIds([])
                }} style={{
                  padding: '16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
                  color: '#FFFFFF', fontSize: 15, fontWeight: 800,
                  boxShadow: '0 6px 20px rgba(91,95,239,0.3)',
                }}>
                  Reset Swipe Limits
                </button>
              )}
              {activeFilters.length < 4 && (
                <button onClick={() => { setActiveFilters(['people', 'circles', 'events', 'lfg']) }} style={{
                  padding: '16px', borderRadius: 999, border: `1.5px solid ${clr.border}`, cursor: 'pointer',
                  background: clr.white, color: clr.textDark, fontSize: 15, fontWeight: 700,
                }}>
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {currentCard && (
        <div style={{
          flexShrink: 0, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
          paddingBottom: 'max(40px, env(safe-area-inset-bottom))'
        }}>
          <button
            disabled={actionPending}
            onClick={() => {
              if (actionPending) return
              setDragX(-500)
              setTimeout(() => {
                handleSwipeLeft()
                setDragX(0)
              }, 250)
            }}
            style={{
              width: 64, height: 64, borderRadius: '50%', backgroundColor: clr.white,
              border: `1.5px solid ${clr.border}`, cursor: actionPending ? 'not-allowed' : 'pointer',
              opacity: actionPending ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
            }}
          >
            <svg width="24" height="24" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: clr.textLight, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {currentCard.type === 'lfg' ? 'Unlimited' : `${Math.max(0, 5 - (discoverySwipes.date === new Date().toDateString() ? (discoverySwipes[currentCard.type] || 0) : 0))} left`}
            </span>
          </div>

          <button
            disabled={actionPending}
            onClick={() => {
              if (actionPending) return
              setDragX(500)
              setTimeout(() => {
                handleSwipeRight()
                setDragX(0)
              }, 250)
            }}
            style={{
              width: 72, height: 72, borderRadius: '50%', border: 'none',
              cursor: actionPending ? 'not-allowed' : 'pointer',
              opacity: actionPending ? 0.5 : 1,
              background: 'linear-gradient(135deg, #5B5FEF, #7B6FFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(91,95,239,0.4)'
            }}
          >
            <svg width="32" height="32" fill="none" stroke="#FFFFFF" strokeWidth="3" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* Toast message */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--toast-bg)', color: 'var(--toast-text)', padding: '12px 24px',
          borderRadius: 999, fontSize: 14, fontWeight: 700, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          animation: 'fadeToast 2.5s ease forwards',
        }}>
          {toastMessage}
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
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <img src={avatarFor(currentMatchCard.data)} alt="" style={{
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
              disabled={actionPending}
              onClick={async () => {
                if (actionPending) return
                setActionPending(true)
                try {
                  await connectWithPerson(currentMatchCard.data)
                  const chatId = await startDM(currentMatchCard.data)
                  await sendMessage(chatId, draftMessage)
                  recordSwipe(currentMatchCard.type)
                  triggerToast(`Connected with ${currentMatchCard.data.name.split(' ')[0]}!`)
                  setShowMessageDraft(false)
                  setCurrentMatchCard(null)
                  advanceCard()
                } catch (err) {
                  console.error('[SwipeDiscovery] connect/message failed', err)
                  triggerToast(err?.message || 'Failed to connect')
                } finally {
                  setActionPending(false)
                }
              }}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 999, border: 'none',
                background: 'linear-gradient(135deg, #5B5FEF, #7B6FFF)',
                color: '#FFFFFF', fontSize: 16, fontWeight: 700, cursor: actionPending ? 'not-allowed' : 'pointer',
                opacity: actionPending ? 0.6 : 1,
                boxShadow: '0 6px 20px rgba(91,95,239,0.38)', marginBottom: 16,
              }}
            >
              {actionPending ? 'Sending…' : 'Send Message →'}
            </button>

            <button
              disabled={actionPending}
              onClick={() => {
                if (actionPending) return
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
      {hoopCircle && (
        <HoopApplication
          circle={hoopCircle}
          onSubmitted={(circleId) => {
            setAppliedCircleIds(prev => prev.includes(circleId) ? prev : [...prev, circleId])
            recordSwipe('circle')
          }}
          onClose={() => {
            const wasSubmitted = appliedCircleIds.includes(hoopCircle.id)
            setHoopCircle(null)
            if (wasSubmitted) {
              triggerToast(`Application sent to ${hoopCircle.name}`)
              advanceCard()
            }
          }}
        />
      )}
    </div>
  )
}
