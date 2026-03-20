import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { people, circles } from '../data/mockData'
import { useAppContext } from '../context/AppContext.jsx'

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
  const { connections, connectWithPerson, startDM, meetups } = useAppContext()
  
  const person = useMemo(() => {
    let p = people.find((p) => p.id === id)
    if (p) return p
    
    // Look through circles for the member
    for (const c of circles) {
      if (c.members) {
        const m = c.members.find(m => m.id === id)
        if (m) {
          return {
            id: m.id,
            name: m.name,
            avatar: m.avatar,
            age: 28,
            city: 'Austin, TX',
            bio: `Hey, I'm ${m.name.split(' ')[0]}. See you around!`,
            interests: [c.interestTag].filter(Boolean),
          }
        }
      }
    }
    
    if (id.startsWith('m-')) {
      const nameStr = id.replace('m-', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      return {
        id,
        name: nameStr,
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(nameStr)}`,
        age: 25,
        city: 'Austin, TX',
        bio: `Happy to be here!`,
        interests: [],
      }
    }
    return null
  }, [id])
  
  if (!person) {
    return <div style={{ padding:40, textAlign:'center', color:clr.textMid, fontFamily:"'DM Sans',sans-serif" }}>User not found.</div>
  }

  const isConnected = connections.includes(person.id)
  
  const personCircles = circles.filter(c => 
    person.interests.some(i => c.interestTag === i || c.category === i.toLowerCase()) || c.members?.some(m => m.name === person.name)
  )

  const eventsAttending = isConnected ? meetups.slice(0, 2) : []

  return (
    <div style={{ minHeight:'100vh', backgroundColor:clr.bg, paddingBottom:100, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between' }}>
        <button onClick={() => navigate(-1)} style={{ background:'none', border:'none', cursor:'pointer' }}>
          <svg width="24" height="24" fill="none" stroke={clr.textDark} strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '24px 20px', textAlign:'center' }}>
        <img src={person.avatar} alt={person.name} style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:`4px solid ${clr.white}`, boxShadow:'0 4px 14px rgba(0,0,0,0.1)' }} />
        <h1 style={{ fontSize:26, fontWeight:800, color:clr.textDark, margin:'12px 0 4px' }}>{person.name}</h1>
        <p style={{ fontSize:15, color:clr.textMid, margin:'0 0 16px' }}>{person.age} · {person.city}</p>
        
        <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
          {isConnected ? (
            <button onClick={() => { const chatId = startDM(person); navigate(`/chat/${chatId}`) }} style={{ padding:'10px 26px', borderRadius:999, border:`1.5px solid ${clr.border}`, background:clr.white, color:clr.textDark, fontSize:15, fontWeight:700, cursor:'pointer' }}>
              Message
            </button>
          ) : (
            <button onClick={() => connectWithPerson(person.id)} style={{ padding:'10px 26px', borderRadius:999, border:'none', background:`linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, color:'#FFFFFF', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(91,95,239,0.3)' }}>
              Connect
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
            {personCircles.length === 0 ? <p style={{ fontSize:14, color:clr.textMid }}>Not in any public circles.</p> : personCircles.map(c => (
              <div key={c.id} onClick={() => navigate(`/circles/${c.id}`)} style={{ backgroundColor:clr.white, padding:16, borderRadius:20, display:'flex', alignItems:'center', gap:14, cursor:'pointer', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ width:48, height:48, borderRadius:14, background:c.coverGradient, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{c.emoji}</div>
                <div>
                  <h4 style={{ margin:'0 0 2px', fontSize:15, fontWeight:700, color:clr.textDark }}>{c.name}</h4>
                  <p style={{ margin:0, fontSize:13, color:clr.textMid }}>{c.memberCount} members</p>
                </div>
              </div>
            ))}
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
