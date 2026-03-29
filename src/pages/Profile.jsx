import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import { circles, people } from '../data/mockData'
import EventDetailModal from '../components/EventDetailModal.jsx'

const INTERESTS = [
  'Rock Climbing','Hiking','Coffee','Startups','Photography','Chess',
  'Running','Yoga','Book Club','Tech','Art','Cooking','Music','Travel','Film','Gaming',
]

const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  textLight:'var(--textLight)',
  border:   'var(--border)',
  green:    'var(--green)',
}

export default function Profile() {
  const { currentUser, setCurrentUser, joinedCircles, meetups } = useAppContext()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: currentUser.name,
    age:  currentUser.age ?? '',
    city: currentUser.city ?? '',
    bio:  currentUser.bio ?? '',
    interests: currentUser.interests ?? [],
    avatar: currentUser.avatar ?? '',
  })

  const joinedCircleObjects = circles.filter((c) => joinedCircles.includes(c.id))
  const upcomingMeetups     = meetups.slice(0, 3)
  const recentConnections   = people.slice(0, 5)

  const [selectedEvent, setSelectedEvent] = useState(null)
  const [detailClosing, setDetailClosing] = useState(false)
  
  const [showExternalInvite, setShowExternalInvite] = useState(false)
  const [inviteInput, setInviteInput] = useState('')
  const [toastMsg, setToastMsg] = useState(null)
  
  const openEventDetail = (event) => setSelectedEvent(event)
  const closeEventDetail = () => {
    setDetailClosing(true)
    setTimeout(() => { setSelectedEvent(null); setDetailClosing(false) }, 250)
  }

  const handleSave = () => {
    setCurrentUser((prev) => ({
      ...prev,
      name: draft.name.trim() || prev.name,
      age:  draft.age ? Number(draft.age) : prev.age,
      city: draft.city.trim() || prev.city,
      bio:  draft.bio.trim(),
      interests: draft.interests,
      avatar: draft.avatar,
    }))
    setEditing(false)
  }

  /* ── Circle icon colors ── */
  const circleAccents = ['#7B8FEF', '#F59E0B', '#10B981', '#F43F5E']
  const circleBgs     = ['#EEF0FF', '#FEF3C7', '#D1FAE5', '#FFE4E6']

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: clr.bg,
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      
      {/* ── Centered Main Container ── */}
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        paddingBottom: 80,
        display: 'flex',
        flexDirection: 'column',
      }}>
        
        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 8px',
        }}>
          <button type="button" onClick={() => navigate('/settings')} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <svg width="22" height="22" fill="none" stroke={clr.textDark} strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <span style={{ fontSize:17, fontWeight:700, color: clr.textDark }}>Profile</span>
          <button type="button" onClick={() => setEditing(true)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <svg width="20" height="20" fill="none" stroke={clr.indigo} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>

        {/* ── Avatar + name + bio ── */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'16px 24px 24px', textAlign:'center' }}>
          {/* Avatar with online dot */}
          <div style={{ position:'relative', marginBottom:16 }}>
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                style={{
                  width: 110, height: 110, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid #FFFFFF',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                }}
              />
            ) : (
              <div style={{
                width: 110, height: 110, borderRadius: '50%',
                backgroundColor: clr.indigoLt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, fontWeight: 700, color: clr.indigo,
                border: '4px solid #FFFFFF',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              }}>
                {currentUser.name ? currentUser.name[0].toUpperCase() : '?'}
              </div>
            )}
            <div style={{
              position:'absolute', bottom:6, right:6,
              width:18, height:18, borderRadius:'50%',
              backgroundColor: clr.green,
              border: '3px solid #F0F0F5',
            }}/>
          </div>

          {/* Name */}
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            color: clr.textDark,
            margin: '0 0 8px 0',
            fontFamily: "'DM Serif Display', 'Georgia', serif",
            letterSpacing: '-0.02em',
          }}>
            {currentUser.name}
          </h1>

          {/* Bio */}
          <p style={{
            fontSize: 15,
            color: clr.textMid,
            lineHeight: 1.6,
            maxWidth: 300,
            margin: 0,
          }}>
            {currentUser.bio || `${currentUser.city} · ${currentUser.age}`}
          </p>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display:'flex', gap:12, padding:'0 20px 28px', justifyContent:'center' }}>
          {[
            { value: currentUser.stats?.circlesJoined  ?? joinedCircles.length, label:'CIRCLES',     route: '/circles' },
            { value: currentUser.stats?.meetupsAttended ?? meetups.length,       label:'MEETUPS',     route: '/schedule' },
            { value: currentUser.stats?.connections     ?? 85,                   label:'CONNECTIONS', id: 'connections-section' },
          ].map(({ value, label, route, id }) => (
            <div key={label} 
              onClick={() => {
                if (route) navigate(route)
                else if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                flex: 1,
                backgroundColor: clr.white,
                borderRadius: 20,
                padding: '18px 8px',
                textAlign: 'center',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <p style={{ fontSize:26, fontWeight:700, color: clr.indigo, margin:'0 0 4px 0' }}>{value}</p>
              <p style={{ fontSize:11, color: clr.textMid, margin:0, letterSpacing:'0.08em', fontWeight:500 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── My Interests ── */}
        <div style={{ padding:'0 20px 28px' }}>
          <h2 style={{ fontSize:22, fontWeight:800, color: clr.textDark, margin:'0 0 14px 0', textAlign: 'center' }}>
            My Interests
          </h2>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent: 'center' }}>
            {(currentUser.interests ?? []).map((interest) => (
              <span key={interest} style={{
                padding: '10px 18px',
                borderRadius: 999,
                backgroundColor: clr.indigoLt,
                color: clr.indigo,
                fontSize: 14,
                fontWeight: 500,
                border: `1.5px solid #D4D8FF`,
              }}>
                {interest}
              </span>
            ))}
          </div>
        </div>

        {/* ── My Circles ── */}
        <div style={{ padding:'0 20px 28px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h2 style={{ fontSize:22, fontWeight:800, color: clr.textDark, margin:0 }}>My Circles</h2>
            <button type="button" onClick={() => navigate('/circles')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:600, color: clr.indigo }}>
              See All
            </button>
          </div>

          {joinedCircleObjects.length === 0 ? (
            <p style={{ fontSize:14, color: clr.textMid, textAlign: 'center' }}>Join a circle from the feed to see it here.</p>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {joinedCircleObjects.map((circle, i) => (
                <div key={circle.id} onClick={() => navigate(`/circles/${circle.id}`)} style={{
                  backgroundColor: clr.white,
                  borderRadius: 20,
                  padding: '20px 16px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                }}>
                  {/* Circle icon */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    backgroundColor: circleBgs[i % circleBgs.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 12,
                    fontSize: 24,
                  }}>
                    {circle.emoji ?? '⭕'}
                  </div>
                  <p style={{ fontSize:15, fontWeight:700, color: clr.textDark, margin:'0 0 4px 0', lineHeight:1.3 }}>
                    {circle.name}
                  </p>
                  <p style={{ fontSize:12, color: clr.textMid, margin:0 }}>
                    {circle.memberCount ?? circle.members?.length ?? 0} Members
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Upcoming Meetups ── */}
        {upcomingMeetups.length > 0 && (
          <div style={{ padding:'0 20px 28px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <h2 style={{ fontSize:22, fontWeight:800, color: clr.textDark, margin:0 }}>Upcoming Meetups</h2>
              <button type="button" onClick={() => navigate('/schedule')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:600, color: clr.indigo }}>
                See All
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {upcomingMeetups.map((m) => (
                <div key={m.id} onClick={() => openEventDetail(m)} style={{
                  backgroundColor: clr.white,
                  borderRadius: 16,
                  padding: '14px 16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  borderLeft: `4px solid ${clr.indigo}`,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                }}>
                  <p style={{ fontSize:14, fontWeight:600, color: clr.textDark, margin:'0 0 4px 0' }}>{m.title}</p>
                  <p style={{ fontSize:12, color: clr.textMid, margin:0 }}>{m.date} · {m.time} · {m.location}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Connections ── */}
        <div id="connections-section" style={{ padding:'0 0 28px' }}>
          <div style={{ padding:'0 20px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h2 style={{ fontSize:22, fontWeight:800, color: clr.textDark, margin:'0 0 4px 0' }}>Recent Connections</h2>
              <p style={{ fontSize:13, fontWeight:600, color: clr.textMid, margin:0 }}>Sorted by: Most recent interaction</p>
            </div>
            <button onClick={() => setShowExternalInvite(true)} style={{
              padding: '8px 16px', borderRadius: 999, border: 'none',
              background: clr.indigoLt, color: clr.indigo, fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}>
              + Invite
            </button>
          </div>
          <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'4px 20px', scrollbarWidth:'none' }}>
            {recentConnections.map((person) => (
              <div key={person.id} onClick={() => navigate(`/user/${person.id}`)} style={{
                flexShrink: 0,
                backgroundColor: clr.white,
                borderRadius: 20,
                padding: '16px 14px',
                textAlign: 'center',
                width: 110,
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                cursor: 'pointer',
              }}>
                <img
                  src={person.avatar}
                  alt={person.name}
                  style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', marginBottom:8 }}
                />
                <p style={{ fontSize:13, fontWeight:600, color: clr.textDark, margin:'0 0 2px 0' }}>
                  {person.name.split(' ')[0]}
                </p>
                <p style={{ fontSize:11, color: clr.textMid, margin:0 }}>
                  {person.interests?.[0] ?? ''}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Edit Modal ── */}
      {editing && (
        <div style={{
          position:'fixed', inset:0, zIndex:50,
          backgroundColor:'rgba(15,15,30,0.45)',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'24px 16px',
        }}>
          <div style={{
            width:'100%', maxWidth:440,
            backgroundColor: clr.white,
            borderRadius: 28,
            padding: '28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize:18, fontWeight:700, color: clr.textDark, margin:'0 0 20px 0' }}>
              Edit Profile
            </h2>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:20 }}>
              <div style={{
                width:80, height:80, borderRadius:'50%',
                backgroundColor: clr.indigoLt,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28, fontWeight:700, color: clr.indigo,
                marginBottom:12, overflow:'hidden', position:'relative',
                border: `2px solid ${clr.indigo}`
              }}>
                {draft.avatar ? (
                  <img src={draft.avatar} alt="Avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                ) : (
                  draft.name ? draft.name[0].toUpperCase() : '?'
                )}
              </div>
              <button type="button" style={{
                padding:'6px 16px', borderRadius:999, border:`1.5px solid ${clr.border}`,
                background:clr.white, fontSize:13, fontWeight:500, color:'#475569', cursor:'pointer', position:'relative'
              }}>
                Change Photo
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setDraft(d => ({ ...d, avatar: URL.createObjectURL(e.target.files[0]) }))
                    }
                  }} 
                  style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }} 
                />
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { label:'Name', key:'name', type:'text',   placeholder:'Alex Rivera' },
                  { label:'Age',  key:'age',  type:'number', placeholder:'29'          },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color: clr.textMid, marginBottom:6 }}>{label}</label>
                    <input type={type} value={draft[key]}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{
                        width:'100%', boxSizing:'border-box',
                        padding:'10px 14px', borderRadius:12,
                        border:`1.5px solid ${clr.border}`,
                        backgroundColor: clr.bg,
                        fontSize:14, color: clr.textDark,
                        outline:'none', fontFamily:'inherit',
                      }}
                      onFocus={e => e.target.style.borderColor = clr.indigo}
                      onBlur={e  => e.target.style.borderColor = clr.border}
                    />
                  </div>
                ))}
              </div>
              {[
                { label:'City', key:'city', type:'text', placeholder:'Austin, TX', rows:1 },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color: clr.textMid, marginBottom:6 }}>{label}</label>
                  <input type={type} value={draft[key]}
                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      width:'100%', boxSizing:'border-box',
                      padding:'10px 14px', borderRadius:12,
                      border:`1.5px solid ${clr.border}`,
                      backgroundColor: clr.bg,
                      fontSize:14, color: clr.textDark,
                      outline:'none', fontFamily:'inherit',
                    }}
                    onFocus={e => e.target.style.borderColor = clr.indigo}
                    onBlur={e  => e.target.style.borderColor = clr.border}
                  />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color: clr.textMid, marginBottom:6 }}>Short bio</label>
                <textarea rows={4} value={draft.bio}
                  onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
                  placeholder="Share a few lines about what you're into..."
                  style={{
                    width:'100%', boxSizing:'border-box',
                    padding:'10px 14px', borderRadius:12,
                    border:`1.5px solid ${clr.border}`,
                    backgroundColor: clr.bg,
                    fontSize:14, color: clr.textDark,
                    outline:'none', resize:'none', fontFamily:'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = clr.indigo}
                  onBlur={e  => e.target.style.borderColor = clr.border}
                />
              </div>

              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color: clr.textMid, marginBottom:8 }}>Interests</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {INTERESTS.map((label) => {
                    const active = draft.interests.includes(label)
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setDraft(d => {
                            const newInts = d.interests.includes(label) 
                              ? d.interests.filter(i => i !== label) 
                              : [...d.interests, label]
                            return { ...d, interests: newInts }
                          })
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 999,
                          border: `1.5px solid ${active ? clr.indigo : clr.border}`,
                          backgroundColor: active ? clr.indigoLt : clr.white,
                          color: active ? clr.indigo : '#475569',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          outline: 'none',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
              <button type="button" onClick={() => setEditing(false)} style={{
                padding:'10px 20px', borderRadius:999, border:'none',
                background:'none', fontSize:14, fontWeight:500,
                color: clr.textMid, cursor:'pointer',
              }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} style={{
                padding:'10px 24px', borderRadius:999, border:'none',
                background: `linear-gradient(135deg, #5B5FEF, #7B6FFF)`,
                color:'#fff', fontSize:14, fontWeight:600,
                cursor:'pointer',
                boxShadow:'0 4px 14px rgba(91,95,239,0.35)',
              }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── External Invite Modal ── */}
      {showExternalInvite && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          backgroundColor: 'rgba(15,15,30,0.5)', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', alignItems: 'center'
        }} onClick={() => { setShowExternalInvite(false); setInviteInput(''); }}>
          <div style={{
            backgroundColor: clr.white, width: '100%', maxWidth: 500,
            borderRadius: '24px 24px 0 0', padding: '24px 20px 32px',
            animation: 'slideUp 0.25s ease', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 32, height: 4, backgroundColor: clr.border, borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: clr.textDark }}>Invite to Third Space</h3>
              <button onClick={() => { setShowExternalInvite(false); setInviteInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="24" height="24" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            
            <p style={{ fontSize: 14, color: clr.textMid, margin: '0 0 16px 0' }}>Invite friends to join you using their phone number or email address.</p>

            <input 
              autoFocus
              placeholder="Email or Phone Number" 
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16,
                border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 15,
                color: clr.textDark, outline: 'none', fontFamily: 'inherit', marginBottom: 16
              }}
            />

            {/* Preview Block */}
            <div style={{ padding: 16, backgroundColor: clr.indigoLt, borderRadius: 16, marginBottom: 24, border: `1px dashed ${clr.indigo}` }}>
              <p style={{ margin: 0, fontSize: 12, color: clr.indigo, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Message Preview</p>
              <p style={{ margin: 0, fontSize: 14, color: clr.textDark, lineHeight: 1.5 }}>
                Hey! I'm using Third Space to find local meetups. Join me here:{' '}
                <span style={{color: clr.indigo, textDecoration: 'underline'}}>https://third.space/join/{currentUser.name.split(' ')[0].toLowerCase()}</span>
              </p>
            </div>

            <button 
              disabled={!inviteInput.trim()}
              onClick={() => {
                setShowExternalInvite(false);
                setToastMsg(`Invite sent to ${inviteInput}!`);
                setInviteInput('');
                setTimeout(() => setToastMsg(null), 3000);
              }}
              style={{
                width: '100%', padding: '16px', borderRadius: 999, border: 'none',
                background: !inviteInput.trim() ? clr.border : `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                color: !inviteInput.trim() ? clr.textMid : '#FFF',
                fontSize: 16, fontWeight: 800, cursor: !inviteInput.trim() ? 'default' : 'pointer',
                boxShadow: !inviteInput.trim() ? 'none' : '0 6px 20px rgba(91,95,239,0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              Send Invite
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', zIndex: 400, transform: 'translateX(-50%)',
          background: clr.textDark, color: '#FFF', padding: '12px 24px', borderRadius: 999,
          fontSize: 14, fontWeight: 600, animation: 'fadeToast 2.5s ease forwards', whiteSpace: 'nowrap'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeToast {
          0% { opacity: 0; transform: translate(-50%, 20px); }
          15% { opacity: 1; transform: translate(-50%, 0); }
          85% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -20px); }
        }
      `}</style>

      {/* ── Event Detail Modal ── */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          closing={detailClosing}
          onClose={closeEventDetail}
        />
      )}
    </div>
  )
}

