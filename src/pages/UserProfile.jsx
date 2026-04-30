import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProfileById } from '../lib/profiles'
import { listCirclesForUser } from '../lib/circles'
import { listUpcomingEventsForUser } from '../lib/events'
import { useAppContext } from '../context/AppContext.jsx'
import { avatarFor } from '../lib/avatar'
import { resolveCircleCover } from '../lib/circleCover'

const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  teal:     '#0D9488',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
}

export default function UserProfile() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { connections, connectWithPerson, startDM } = useAppContext()
  const [person, setPerson] = useState(null)
  const [personLoading, setPersonLoading] = useState(true)
  const [personCircles, setPersonCircles] = useState([])
  const [personEvents, setPersonEvents] = useState([])
  const [connecting, setConnecting] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setPersonLoading(true)
    Promise.all([getProfileById(id), listCirclesForUser(id), listUpcomingEventsForUser(id)])
      .then(([prof, crc, events]) => {
        if (cancelled) return
        setPerson(prof)
        setPersonCircles(crc)
        setPersonEvents(events)
      })
      .catch(err => console.error('[UserProfile] load failed', err))
      .finally(() => { if (!cancelled) setPersonLoading(false) })
    return () => { cancelled = true }
  }, [id])
  
  if (personLoading) {
    return <div style={{ padding:40, textAlign:'center', color:clr.textMid, fontFamily:"'DM Sans',sans-serif" }}>Loading…</div>
  }
  if (!person) {
    return <div style={{ padding:40, textAlign:'center', color:clr.textMid, fontFamily:"'DM Sans',sans-serif" }}>User not found.</div>
  }

  const isConnected = connections.some(c => c.id === person.id)
  
  const eventsAttending = isConnected ? personEvents.slice(0, 2) : []

  return (
    <div style={{ minHeight:'100vh', backgroundColor:clr.bg, paddingBottom:100, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between' }}>
        <button onClick={() => navigate('/feed')} style={{ background:'none', border:'none', cursor:'pointer' }}>
          <svg width="24" height="24" fill="none" stroke={clr.textDark} strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '24px 20px', textAlign:'center' }}>
        <img src={avatarFor(person)} alt={person.name} style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:`4px solid ${clr.white}`, boxShadow:'0 4px 14px rgba(0,0,0,0.1)' }} />
        <h1 style={{ fontSize:26, fontWeight:800, color:clr.textDark, margin:'12px 0 4px' }}>{person.name}</h1>
        <p style={{ fontSize:15, color:clr.textMid, margin:'0 0 16px' }}>{person.age} · {person.city}</p>
        
        <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
          {isConnected ? (
            <button onClick={async () => { try { const chatId = await startDM(person); navigate(`/chat/${chatId}`) } catch (err) { console.error('[UserProfile] startDM failed', err) } }} style={{ padding:'10px 26px', borderRadius:999, border:`1.5px solid ${clr.border}`, background:clr.white, color:clr.textDark, fontSize:15, fontWeight:700, cursor:'pointer' }}>
              Message
            </button>
          ) : requestSent ? (
            <button disabled style={{ padding:'10px 26px', borderRadius:999, border:'none', background:'#10B981', color:'#FFFFFF', fontSize:15, fontWeight:700, cursor:'default', opacity:0.9 }}>
              Request Sent ✓
            </button>
          ) : (
            <button
              disabled={connecting}
              onClick={async () => {
                setConnecting(true)
                try {
                  await connectWithPerson(person.id)
                  setRequestSent(true)
                } catch (err) {
                  console.error('[UserProfile] connect failed', err)
                  alert('Something went wrong. Please try again.')
                } finally {
                  setConnecting(false)
                }
              }}
              style={{ padding:'10px 26px', borderRadius:999, border:'none', background: connecting ? clr.indigoLt : `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color:'#FFFFFF', fontSize:15, fontWeight:700, cursor: connecting ? 'wait' : 'pointer', boxShadow:'0 4px 14px rgba(91,95,239,0.3)', opacity: connecting ? 0.7 : 1, transition:'opacity 0.2s ease' }}
            >
              {connecting ? 'Sending…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 20px', display:'flex', flexDirection:'column', gap:24 }}>
        <section>
          <h3 style={{ fontSize:18, fontWeight:800, color:clr.textDark, marginBottom:12 }}>About</h3>
          <div style={{ backgroundColor:clr.white, padding:20, borderRadius:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize:15, color:clr.textMid, lineHeight:1.6, margin:0 }}>{person.bio}</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:16 }}>
              {person.interests?.map(i => (
                <span key={i} style={{ padding:'6px 14px', borderRadius:999, backgroundColor:clr.bg, color:clr.textDark, fontSize:13, fontWeight:600 }}>{i}</span>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3 style={{ fontSize:18, fontWeight:800, color:clr.textDark, marginBottom:12 }}>Circles</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {personCircles.length === 0 ? <p style={{ fontSize:14, color:clr.textMid }}>Not in any public circles.</p> : personCircles.map(c => {
              const cover = resolveCircleCover(c)
              return (
              <div key={c.id} onClick={() => navigate(`/circles/${c.id}`)} style={{ backgroundColor:clr.white, padding:16, borderRadius:20, display:'flex', alignItems:'center', gap:14, cursor:'pointer', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ width:48, height:48, borderRadius:14, position: 'relative', overflow: 'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, background: cover.kind === 'gradient' ? cover.value : undefined }}>
                  {cover.kind === 'image' && <img src={cover.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <span style={{ position: 'relative' }}>{c.emoji}</span>
                </div>
                <div>
                  <h4 style={{ margin:'0 0 2px', fontSize:15, fontWeight:700, color:clr.textDark }}>{c.name}</h4>
                  <p style={{ margin:0, fontSize:13, color:clr.textMid }}>{c.memberCount} members</p>
                </div>
              </div>
            )})}
          </div>
        </section>

        {isConnected ? (
          <section>
            <h3 style={{ fontSize:18, fontWeight:800, color:clr.textDark, marginBottom:12 }}>Attending Events</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {eventsAttending.length === 0 ? <p style={{ fontSize:14, color:clr.textMid }}>No upcoming events.</p> : eventsAttending.map(e => (
                <div key={e.id} style={{ backgroundColor:clr.white, padding:16, borderRadius:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                  <h4 style={{ margin:'0 0 4px', fontSize:15, fontWeight:700, color:clr.textDark }}>{e.title}</h4>
                  <p style={{ margin:0, fontSize:13, color:clr.textMid }}>{e.date} · {e.location}</p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div style={{ padding:20, backgroundColor:clr.white, borderRadius:20, textAlign:'center', border:`1.5px dashed ${clr.border}` }}>
            <p style={{ margin:0, fontSize:14, color:clr.textMid }}>Connect to see the events {person.name.split(' ')[0]} is attending.</p>
          </div>
        )}
      </div>
    </div>
  )
}
