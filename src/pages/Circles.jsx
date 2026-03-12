import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { circles } from '../data/mockData'
import { useAppContext } from '../context/AppContext.jsx'
 
const clr = {
  bg:       '#F0F0F5',
  white:    '#FFFFFF',
  indigo:   '#5B5FEF',
  indigoLt: '#EEEEFF',
  textDark: '#1A1A2E',
  textMid:  '#6B7280',
  textLight:'#9CA3AF',
  border:   '#E8E8EE',
}
 
const FILTERS = [
  { id: 'all',          label: 'All'          },
  { id: 'open',         label: 'Open'         },
  { id: 'private',      label: 'Private'      },
  { id: 'professional', label: 'Professional' },
  { id: 'social',       label: 'Social'       },
  { id: 'outdoors',     label: 'Outdoors'     },
]
 
const CIRCLE_COLORS = [
  { bg:'#EEF0FF', accent:'#5B5FEF' },
  { bg:'#FEF3C7', accent:'#D97706' },
  { bg:'#D1FAE5', accent:'#059669' },
  { bg:'#FFE4E6', accent:'#E11D48' },
]
 
export default function Circles() {
  const navigate = useNavigate()
  const { joinedCircles, joinCircle } = useAppContext()
  const [query, setQuery]             = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
 
  const filtered = useMemo(() => {
    return circles.filter((circle) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !q ||
        circle.name.toLowerCase().includes(q) ||
        (circle.city ?? '').toLowerCase().includes(q) ||
        (circle.interestTag ?? '').toLowerCase().includes(q)
      const matchesFilter =
        activeFilter === 'all' ||
        circle.type === activeFilter ||
        circle.category === activeFilter
      return matchesQuery && matchesFilter
    })
  }, [query, activeFilter])
 
  return (
    <div style={{
      minHeight:'100vh',
      backgroundColor: clr.bg,
      fontFamily:"'DM Sans','Inter',sans-serif",
      paddingBottom:100,
    }}>
 
      {/* ── Top bar ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'20px 24px 12px',
      }}>
        <span style={{ fontSize:22, fontWeight:800, color: clr.textDark }}>Circles</span>
        <button type="button" style={{
          padding:'8px 18px', borderRadius:999, border:'none',
          background:`linear-gradient(135deg,#5B5FEF,#7B6FFF)`,
          color:'#FFFFFF', fontSize:13, fontWeight:600, cursor:'pointer',
          boxShadow:'0 4px 14px rgba(91,95,239,0.3)',
        }}>
          + Create
        </button>
      </div>
 
      <div style={{ padding:'0 16px', maxWidth:560, margin:'0 auto' }}>
 
        {/* ── Search ── */}
        <div style={{ position:'relative', marginBottom:16 }}>
          <svg width="18" height="18" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24"
            style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, interest, or city"
            style={{
              width:'100%', boxSizing:'border-box',
              padding:'13px 16px 13px 44px',
              borderRadius:999, border:'none',
              backgroundColor:'#E8E8F0',
              fontSize:15, color: clr.textDark,
              outline:'none', fontFamily:'inherit',
            }}
          />
        </div>
 
        {/* ── Filter chips ── */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {FILTERS.map((f) => {
            const active = activeFilter === f.id
            return (
              <button key={f.id} type="button"
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding:'8px 16px', borderRadius:999, border:'none',
                  backgroundColor: active ? clr.indigo : clr.white,
                  color: active ? '#FFFFFF' : clr.textMid,
                  fontSize:13, fontWeight:600, cursor:'pointer',
                  boxShadow: active ? '0 4px 12px rgba(91,95,239,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                  transition:'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
 
        {/* ── Circle cards ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map((circle, idx) => {
            const isJoined  = joinedCircles.includes(circle.id)
            const isPrivate = circle.type === 'private'
            const accent    = CIRCLE_COLORS[idx % CIRCLE_COLORS.length]
 
            return (
              <div
                key={circle.id}
                onClick={() => navigate(`/circles/${circle.id}`)}
                style={{
                  backgroundColor: clr.white,
                  borderRadius:20,
                  padding:'18px',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                  cursor:'pointer',
                  display:'flex', alignItems:'center', gap:14,
                  transition:'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.06)' }}
              >
                {/* Circle icon */}
                <div style={{
                  width:60, height:60, borderRadius:16, flexShrink:0,
                  backgroundColor: accent.bg,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:28,
                }}>
                  {circle.emoji ?? '⭕'}
                </div>
 
                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <span style={{ fontSize:16, fontWeight:700, color: clr.textDark,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {circle.name}
                    </span>
                    {isPrivate && (
                      <svg width="13" height="13" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    )}
                  </div>
                  <p style={{ fontSize:13, color: clr.textMid, margin:'0 0 8px 0',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {circle.description?.slice(0,60)}...
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{
                      fontSize:11, fontWeight:600, color: accent.accent,
                      backgroundColor: accent.bg,
                      padding:'3px 10px', borderRadius:999,
                    }}>
                      {circle.interestTag}
                    </span>
                    <span style={{ fontSize:12, color: clr.textLight }}>
                      {circle.memberCount ?? circle.members?.length ?? 0} members
                    </span>
                  </div>
                </div>
 
                {/* Join button */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isJoined) joinCircle(circle.id) }}
                  style={{
                    flexShrink:0,
                    padding:'9px 16px', borderRadius:999,
                    border: isJoined ? 'none' : `1.5px solid ${clr.indigo}`,
                    backgroundColor: isJoined ? clr.indigoLt : clr.white,
                    color: clr.indigo,
                    fontSize:13, fontWeight:700, cursor: isJoined ? 'default' : 'pointer',
                    transition:'all 0.15s ease',
                  }}
                >
                  {isJoined ? '✓ Joined' : isPrivate ? 'Request' : 'Join'}
                </button>
              </div>
            )
          })}
 
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color: clr.textMid, fontSize:15 }}>
              No circles found. Try a different search or filter.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
