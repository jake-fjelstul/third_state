import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { circles, people } from '../data/mockData'
import { useAppContext } from '../context/AppContext.jsx'

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

const CIRCLE_COLORS = [
  { bg:'#EEF0FF', accent:'#5B5FEF' },
  { bg:'#FEF3C7', accent:'#D97706' },
  { bg:'#D1FAE5', accent:'#059669' },
  { bg:'#FFE4E6', accent:'#E11D48' },
]

function getActivityScore(circle) {
  const eventScore   = Math.min((circle.events?.length ?? 0) * 15, 45)
  const memberScore  = Math.min((circle.memberCount ?? 10) / 10, 20)
  const chatScore    = Math.min((circle.chatPreview?.length ?? 0) * 8, 35)
  return Math.round(eventScore + memberScore + chatScore)
}

function getInteractionScore(person, chatState, circles, joinedCircles) {
  let score = 0
  const sharedCircles = joinedCircles.filter(circleId => {
    const circle = circles.find(c => c.id === circleId)
    return circle?.members?.some(m => m.id === person.id)
  })
  score += sharedCircles.length * 20
  const dmThread = Object.values(chatState ?? {}).find(
    chat => chat.type === 'dm' && chat.personId === person.id
  )
  if (dmThread) {
    score += Math.min((dmThread.messages?.length ?? 0) * 10, 100)
    if (dmThread.time) score += 15
    if (dmThread.unread > 0) score += 5
  }
  joinedCircles.forEach(circleId => {
    const circleChat = Object.values(chatState ?? {}).find(
      c => c.circleId === circleId || c.id === circleId
    )
    const theyPosted = circleChat?.messages?.some(
      m => m.sender === person.name || m.sender === person.name.split(' ')[0]
    )
    if (theyPosted) score += 8
  })
  return score
}

function getConnectionTier(score) {
  if (score >= 80) return { label: 'Close',    bg: '#EEF0FF', color: '#5B5FEF', dot: '#5B5FEF' }
  if (score >= 40) return { label: 'Regular',  bg: '#D1FAE5', color: '#059669', dot: '#10B981' }
  if (score >= 15) return { label: 'Familiar', bg: '#FEF3C7', color: '#D97706', dot: '#F59E0B' }
  return { label: 'New', bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' }
}

function ActivityBadge({ score }) {
  const tier = score >= 70 ? 
    { label: 'Core',   bg: '#EEF0FF', color: '#5B5FEF' } :
    score >= 40 ? 
    { label: 'Active', bg: '#D1FAE5', color: '#059669' } :
    { label: 'Casual', bg: '#F3F4F6', color: '#6B7280' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      backgroundColor: tier.bg, color: tier.color,
      padding: '2px 8px', borderRadius: 999,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      {tier.label}
    </span>
  )
}

function CircleCard({ circle, idx, isJoined, onJoin, onClick }) {
  const accent = CIRCLE_COLORS[idx % CIRCLE_COLORS.length]
  const isPrivate = circle.type === 'private'
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: clr.white, borderRadius:20,
        padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
        display:'flex', alignItems:'center', gap:12, cursor:'pointer',
        transition:'transform 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
    >
      <div style={{
        width:52, height:52, borderRadius:14, flexShrink:0,
        backgroundColor: accent.bg,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:26,
      }}>
        {circle.emoji ?? '⭕'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
          <span style={{ fontSize:15, fontWeight:700, color: clr.textDark,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {circle.name}
          </span>
          {isPrivate && (
            <svg width="12" height="12" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:600, color: accent.accent,
            backgroundColor: accent.bg, padding:'2px 8px', borderRadius:999 }}>
            {circle.interestTag}
          </span>
          <span style={{ fontSize:11, color: clr.textLight }}>
            {circle.memberCount ?? circle.members?.length ?? 0} members
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onJoin() }}
        style={{
          flexShrink:0, padding:'8px 14px', borderRadius:999,
          border: isJoined ? 'none' : `1.5px solid ${clr.indigo}`,
          backgroundColor: isJoined ? clr.indigoLt : clr.white,
          color: clr.indigo, fontSize:12, fontWeight:700,
          cursor: isJoined ? 'default' : 'pointer',
        }}
      >
        {isJoined ? '✓' : isPrivate ? 'Request' : 'Join'}
      </button>
    </div>
  )
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    return typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  })
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

function NetworkGraph({ filter, people, circles, joinedCircles, currentUser, onSelectNode, selectedNode }) {
  const isDark = useDarkMode()
  const [hoveredNode, setHoveredNode] = useState(null)
  
  const colors = isDark ? {
    bg: '#0F0F1A', card: '#1A1A2E', ring: '#2A2A3E', edge: '#818CF8', youBorder: '#5B5FEF', glow1: 'rgba(129,140,248,0.2)', glow2: 'rgba(129,140,248,0.1)', circleNodeBg: '#1E1E3F', circleNodeBorder: '#818CF8', personNodeBg: '#1E1E2E', personNodeBorder: '#2A2A4E', labelYou: '#F0F0FF', labelOther: '#9CA3AF', tooltipBg: '#252540',
  } : {
    bg: '#F0F0F5', card: '#FFFFFF', ring: '#E8E8EE', edge: '#5B5FEF', youBorder: '#5B5FEF', glow1: 'rgba(91,95,239,0.15)', glow2: 'rgba(91,95,239,0.08)', circleNodeBg: '#EEF0FF', circleNodeBorder: '#5B5FEF', personNodeBg: '#FFFFFF', personNodeBorder: '#E8E8EE', labelYou: '#1A1A2E', labelOther: '#6B7280', tooltipBg: '#FFFFFF',
  }

  const cx = 250, cy = 245
  const R1 = 75, R2 = 130, R3 = 185
  const PADDING = 30

  const clampX = (x, r) => Math.max(PADDING + r, Math.min(500 - PADDING - r, x))
  const clampY = (y, r) => Math.max(PADDING + r, Math.min(520 - PADDING - r, y))

  const graphData = useMemo(() => {
    const nodes = []
    const edges = []
    let hiddenCount = 0

    nodes.push({
      id: 'you', type: 'user', label: currentUser.name.split(' ')[0],
      avatar: currentUser.avatar, x: cx, y: cy, radius: 32, matchFilter: true
    })

    if (joinedCircles.length === 0) return { nodes, edges, hiddenCount: 0 }

    const matchesFilter = (c) => {
      if (filter === 'all') return true
      if (filter === 'professional') return c.category === 'professional' || c.interestTag?.toLowerCase().includes('startup') || c.interestTag?.toLowerCase().includes('tech')
      if (filter === 'social') return c.category === 'social'
      if (filter === 'activity') return c.category === 'outdoors' || c.category === 'activity'
      return true
    }

    const joinedCircleObjs = joinedCircles.map(id => circles.find(c => c.id === id)).filter(Boolean)
    joinedCircleObjs.sort((a,b) => getActivityScore(b) - getActivityScore(a))

    const coreCircles = joinedCircleObjs.slice(0, 4)
    const activeCircles = joinedCircleObjs.slice(4)
    const offsetAngle = 15 * (Math.PI / 180)

    coreCircles.forEach((c, i) => {
      const angle = (i / coreCircles.length) * Math.PI * 2 - Math.PI/2 + offsetAngle
      const match = matchesFilter(c)
      const r = 22
      const x = cx + R1 * Math.cos(angle)
      const y = cy + R1 * Math.sin(angle)
      nodes.push({
        id: `circle-${c.id}`, type: 'circle', label: c.name.slice(0,10) + (c.name.length>10?'…':''),
        emoji: c.emoji ?? '⭕', circleId: c.id,
        x: clampX(x, r), y: clampY(y, r),
        radius: r, matchFilter: match, strength: 'strong'
      })
      edges.push({ from: 'you', to: `circle-${c.id}`, strength: 'strong' })
    })

    const middleRingRaw = []
    const outerRingRaw = []

    activeCircles.forEach(c => middleRingRaw.push({ type: 'circle_node', data: c }))

    const personMap = new Map()
    joinedCircleObjs.forEach(c => {
      const members = c.members?.slice(0, 4) ?? []
      members.forEach(m => {
        if (!personMap.has(m.id)) personMap.set(m.id, { data: m, connections: [], matchFilter: false })
        personMap.get(m.id).connections.push(c)
        if (matchesFilter(c)) personMap.get(m.id).matchFilter = true
      })
    })

    Array.from(personMap.values()).forEach(p => {
      if (p.connections.length > 1 && middleRingRaw.length < 7) {
        middleRingRaw.push({ type: 'person_node', ...p })
      } else {
        outerRingRaw.push({ type: 'person_node', ...p })
      }
    })

    const middleRingNodes = middleRingRaw.slice(0, 7)
    const outerRingNodes = outerRingRaw.slice(0, 10)
    hiddenCount = Math.max(0, middleRingRaw.length - 7) + Math.max(0, outerRingRaw.length - 10)

    middleRingNodes.forEach((item, i) => {
      const angle = (i / Math.max(middleRingNodes.length, 1)) * Math.PI * 2 - Math.PI/2 + offsetAngle
      if (item.type === 'circle_node') {
        const c = item.data
        const match = matchesFilter(c)
        const r = 22
        const x = cx + R2 * Math.cos(angle)
        const y = cy + R2 * Math.sin(angle)
        nodes.push({
          id: `circle-${c.id}`, type: 'circle', label: c.name.slice(0,10) + (c.name.length>10?'…':''),
          emoji: c.emoji ?? '⭕', circleId: c.id,
          x: clampX(x, r), y: clampY(y, r),
          radius: r, matchFilter: match, strength: 'medium'
        })
        edges.push({ from: 'you', to: `circle-${c.id}`, strength: 'medium' })
      } else {
        const p = item.data
        const r = 15
        const x = cx + R2 * Math.cos(angle)
        const y = cy + R2 * Math.sin(angle)
        nodes.push({
          id: `person-${p.id}`, type: 'person', label: p.name.split(' ')[0],
          avatar: p.avatar, personId: p.id,
          x: clampX(x, r), y: clampY(y, r),
          radius: r, matchFilter: item.matchFilter, strength: 'medium'
        })
        item.connections.forEach(c => edges.push({ from: `circle-${c.id}`, to: `person-${p.id}`, strength: 'medium' }))
      }
    })

    outerRingNodes.forEach((item, i) => {
      const angle = (i / Math.max(outerRingNodes.length, 1)) * Math.PI * 2 - Math.PI/2 + offsetAngle
      const p = item.data
      const r = 15
      const x = cx + R3 * Math.cos(angle)
      const y = cy + R3 * Math.sin(angle)
      nodes.push({
        id: `person-${p.id}`, type: 'person', label: p.name.split(' ')[0],
        avatar: p.avatar, personId: p.id,
        x: clampX(x, r), y: clampY(y, r),
        radius: r, matchFilter: item.matchFilter, strength: 'weak'
      })
      item.connections.forEach(c => edges.push({ from: `circle-${c.id}`, to: `person-${p.id}`, strength: 'weak' }))
    })

    return { nodes, edges, hiddenCount }
  }, [joinedCircles, filter, currentUser, circles])

  const getEdgeOpacity = (edge) => {
    const fromNode = graphData.nodes.find(n => n.id === edge.from)
    const toNode = graphData.nodes.find(n => n.id === edge.to)
    if (!fromNode?.matchFilter || !toNode?.matchFilter) return 0
    
    // Explicitly target active taps or hovers organically
    const activeTargetId = selectedNode?.id || hoveredNode
    
    if (activeTargetId) {
      if (edge.from === activeTargetId || edge.to === activeTargetId) return 0.8
      return 0.05
    }

    return 0
  }

  const getEdgeStrokeWidth = (strength) => strength === 'strong' ? 2.5 : strength === 'medium' ? 1.5 : 1

  const getNodeOpacity = (node) => {
    if (!node.matchFilter) return 0.2
    if (hoveredNode && hoveredNode !== node.id) {
      const isConnected = graphData.edges.some(e => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id))
      if (!isConnected && node.id !== 'you') return 0.3
    }
    return 1
  }

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', borderRadius: 24, backgroundColor: colors.card, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <svg viewBox="0 0 500 520" style={{ width: '100%', height: 'auto', maxWidth: '100%', display: 'block' }}>
          <circle cx={cx} cy={cy} r={R1} fill="none" stroke={colors.ring} strokeDasharray="4 6" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={R2} fill="none" stroke={colors.ring} strokeDasharray="4 6" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={R3} fill="none" stroke={colors.ring} strokeDasharray="4 6" strokeWidth={1} />

          {joinedCircles.length === 0 && (
            <text x={cx} y={cy + R2 - 20} textAnchor="middle" fill={colors.labelOther} fontSize={13} fontStyle="italic">
              Join circles to grow your network
            </text>
          )}

          {graphData.hiddenCount > 0 && (
            <text x={cx} y={cy + R3 + 24} textAnchor="middle" fill={colors.labelOther} fontSize={11} fontStyle="italic">
              +{graphData.hiddenCount} more
            </text>
          )}

          {graphData.edges.map((e, i) => {
            const from = graphData.nodes.find(n => n.id === e.from)
            const to   = graphData.nodes.find(n => n.id === e.to)
            if (!from || !to) return null
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={colors.edge} strokeWidth={getEdgeStrokeWidth(e.strength)} strokeOpacity={getEdgeOpacity(e)} style={{ transition: 'stroke-opacity 0.3s ease' }} />
          })}

          {graphData.nodes.map(node => {
            const isHovered = hoveredNode === node.id
            const scale = isHovered ? 1.15 : 1
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y}) scale(${scale})`} style={{ cursor: 'pointer', transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease', opacity: getNodeOpacity(node) }} onPointerEnter={() => setHoveredNode(node.id)} onPointerLeave={() => setHoveredNode(null)} onPointerDown={() => onSelectNode(node)}>
                {node.type === 'user' && (
                  <>
                    <circle cx={0} cy={0} r={node.radius + 12} fill="none" stroke={colors.glow1} strokeWidth="2" />
                    <circle cx={0} cy={0} r={node.radius + 24} fill="none" stroke={colors.glow2} strokeWidth="1" />
                    <foreignObject x={-node.radius} y={-node.radius} width={node.radius * 2} height={node.radius * 2}>
                      <img src={node.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    </foreignObject>
                    <circle cx={0} cy={0} r={node.radius} fill="none" stroke={colors.youBorder} strokeWidth="3"/>
                    <text x={0} y={node.radius + 18} textAnchor="middle" fontSize={13} fontWeight={700} fill={colors.labelYou} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {node.label}
                    </text>
                  </>
                )}

                {node.type === 'circle' && (
                  <>
                    <circle cx={0} cy={0} r={node.radius} fill={colors.circleNodeBg} stroke={colors.circleNodeBorder} strokeWidth="2"/>
                    <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize="18">{node.emoji}</text>
                    <text x={0} y={node.radius + 14} textAnchor="middle" fontSize={10} fontWeight={600} fill={colors.labelOther} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {node.label}
                    </text>
                  </>
                )}

                {node.type === 'person' && (
                  <>
                    <foreignObject x={-node.radius} y={-node.radius} width={node.radius * 2} height={node.radius * 2}>
                      <img src={node.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', backgroundColor: colors.personNodeBg }} />
                    </foreignObject>
                    <circle cx={0} cy={0} r={node.radius} fill="none" stroke={colors.personNodeBorder} strokeWidth="1.5"/>
                    <text x={0} y={node.radius + 12} textAnchor="middle" fontSize={10} fontWeight={500} fill={colors.labelOther} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {node.label}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>

        {hoveredNode && graphData.nodes.find(n => n.id === hoveredNode && n.id !== 'you') && (() => {
          const n = graphData.nodes.find(n => n.id === hoveredNode)
          return (
            <div style={{ position: 'absolute', top: `${(n.y / 520) * 100}%`, left: `${(n.x / 500) * 100}%`, transform: 'translate(-50%, calc(-100% - 28px))', backgroundColor: colors.tooltipBg, padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: colors.labelYou, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10 }}>
              {n.label} <span style={{ color: colors.labelOther, fontWeight: 500, marginLeft: 4 }}>{n.type === 'circle' ? 'Circle' : 'Person'}</span>
            </div>
          )
        })()}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, padding: '0 4px', fontSize: 11, color: colors.labelOther, alignItems: 'center' }}>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:8, height:8, borderRadius:'50%', backgroundColor:colors.youBorder}}/> You</span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:8, height:8, borderRadius:'1px', border:`1.5px solid ${colors.circleNodeBorder}`}}/> Circle</span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:8, height:8, borderRadius:'50%', border:`1.5px solid ${colors.personNodeBorder}`}}/> Person</span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:16, height:2, backgroundColor:colors.edge, opacity:0.35}}/> Strong</span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:16, height:1, backgroundColor:colors.edge, opacity:0.15}}/> Weak</span>
      </div>
    </div>
  )
}

export default function Circles() {
  const navigate = useNavigate()
  const { currentUser, joinedCircles, joinCircle, startDM, chatState } = useAppContext()

  const [activeTab, setActiveTab]         = useState('circles')
  const [circleOrder, setCircleOrder]     = useState(joinedCircles)
  const [isEditMode, setIsEditMode]       = useState(false)
  const [draggingId, setDraggingId]       = useState(null)
  const [dragOverId, setDragOverId]       = useState(null)
  
  const [networkFilter, setNetworkFilter] = useState('all')
  const [selectedNode, setSelectedNode]   = useState(null)
  const [discoverSearch, setDiscoverSearch] = useState('')

  const [connectionFilter, setConnectionFilter] = useState('all')
  const [connectionSearch, setConnectionSearch] = useState('')

  const rankedConnections = useMemo(() => {
    const seen = new Set()
    const connected = []
    
    joinedCircles.forEach(circleId => {
      const circle = circles.find(c => c.id === circleId)
      circle?.members?.forEach(member => {
        if (!seen.has(member.id) && member.id !== currentUser.id) {
          seen.add(member.id)
          connected.push({
            ...member,
            score: getInteractionScore(member, chatState, circles, joinedCircles),
            sharedCircles: joinedCircles
              .filter(cid => {
                const c = circles.find(x => x.id === cid)
                return c?.members?.some(m => m.id === member.id)
              })
              .map(cid => circles.find(x => x.id === cid))
              .filter(Boolean),
          })
        }
      })
    })

    Object.values(chatState ?? {}).forEach(chat => {
      if (chat.type === 'dm' && chat.personId && !seen.has(chat.personId) && chat.personId !== currentUser.id) {
        const person = people.find(p => p.id === chat.personId)
        if (person) {
          seen.add(person.id)
          connected.push({
            ...person,
            score: getInteractionScore(person, chatState, circles, joinedCircles),
            sharedCircles: [],
          })
        }
      }
    })

    return connected.sort((a, b) => b.score - a.score)
  }, [joinedCircles, chatState, circles, currentUser.id])

  const filteredConnections = useMemo(() => {
    return rankedConnections.filter(person => {
      const q = connectionSearch.toLowerCase()
      const matchesSearch = !q || 
        person.name.toLowerCase().includes(q) ||
        person.sharedCircles.some(c => c.name.toLowerCase().includes(q))

      const matchesFilter = connectionFilter === 'all' || 
        person.sharedCircles.some(c => {
          if (connectionFilter === 'professional') return c.category === 'professional' || c.interestTag?.toLowerCase().includes('startup') || c.interestTag?.toLowerCase().includes('tech')
          if (connectionFilter === 'social') return c.category === 'social'
          if (connectionFilter === 'activity') return c.category === 'outdoors' || c.category === 'activity'
          return true
        })

      return matchesSearch && matchesFilter
    })
  }, [rankedConnections, connectionSearch, connectionFilter])

  useEffect(() => {
    setCircleOrder(prev => {
      const newArray = [...prev]
      joinedCircles.forEach(id => { if (!newArray.includes(id)) newArray.push(id) })
      return newArray.filter(id => joinedCircles.includes(id))
    })
  }, [joinedCircles])

  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const orderedCircleObjects = circleOrder.map(id => circles.find(c => c.id === id)).filter(Boolean)
  
  const unjoinedCircleObjects = useMemo(() => {
    const term = discoverSearch.toLowerCase()
    return circles.filter(c => !joinedCircles.includes(c.id) && (c.name.toLowerCase().includes(term) || c.interestTag?.toLowerCase().includes(term)))
  }, [discoverSearch, joinedCircles])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: clr.bg, paddingBottom: 110, fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, margin: 0, padding: '16px 20px 0', letterSpacing: '-0.02em', fontFamily: "'DM Serif Display', 'Georgia', serif", textAlign: 'center' }}>
        Circles
      </h1>
      <div style={{ padding: '16px 20px 0' }}>
        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 16, borderBottom: `2px solid ${clr.border}`, marginBottom: 20 }}>
          {[
            { id: 'circles', label: 'My Circles' },
            { id: 'connections', label: 'Connections' },
            { id: 'network', label: 'Network Graph' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: 'none', border: 'none', padding: '0 0 12px 0', cursor: 'pointer',
              fontSize: 15, fontWeight: 700, position: 'relative',
              color: activeTab === tab.id ? clr.indigo : clr.textLight,
            }}>
              {tab.label}
              {activeTab === tab.id && (
                <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 3, borderRadius: '3px 3px 0 0', backgroundColor: clr.indigo }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px', margin: '0 auto' }}>
        {activeTab === 'circles' && (
          <div style={{ animation: 'slideUp 0.15s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: 0 }}>Ranked Activity</h2>
              {joinedCircles.length > 0 && (
                <button onClick={() => setIsEditMode(!isEditMode)} style={{ background: 'none', border: 'none', color: clr.indigo, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {isEditMode ? 'Done' : 'Edit Order'}
                </button>
              )}
            </div>

            {joinedCircles.length === 0 ? (
              <p style={{ fontSize: 15, color: clr.textMid, textAlign: 'center', padding: '40px 20px', backgroundColor: clr.white, borderRadius: 24, margin: '0 0 32px' }}>
                Join some circles from the feed to see your rankings.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {orderedCircleObjects.map((circle, rankIndex) => (
                  <div key={circle.id} draggable={isEditMode}
                    onClick={() => { if (!isEditMode) navigate(`/circles/${circle.id}`) }}
                    onDragStart={() => setDraggingId(circle.id)}
                    onDragOver={e => { e.preventDefault(); setDragOverId(circle.id) }}
                    onDrop={() => {
                      if (!draggingId || draggingId === circle.id) return
                      const newOrder = [...circleOrder]
                      const fromIdx = newOrder.indexOf(draggingId)
                      const toIdx   = newOrder.indexOf(circle.id)
                      newOrder.splice(fromIdx, 1)
                      newOrder.splice(toIdx, 0, draggingId)
                      setCircleOrder(newOrder)
                      setDraggingId(null)
                      setDragOverId(null)
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                    style={{
                      backgroundColor: clr.white, borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 12,
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      opacity: draggingId === circle.id ? 0.4 : 1,
                      border: dragOverId === circle.id ? `2px solid ${clr.indigo}` : '2px solid transparent',
                      transition: 'border 0.15s ease, opacity 0.15s ease',
                      cursor: isEditMode ? 'grab' : 'pointer',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', backgroundColor: clr.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: clr.textMid, flexShrink: 0,
                    }}>
                      {rankIndex + 1}
                    </div>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0, backgroundColor: CIRCLE_COLORS[rankIndex % 4].bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    }}>
                      {circle.emoji ?? '⭕'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {circle.name}
                        </span>
                        <ActivityBadge score={getActivityScore(circle)} />
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ height: 4, borderRadius: 999, backgroundColor: clr.border, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${getActivityScore(circle)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${clr.indigo}, #A78BFA)`, transition: 'width 0.6s ease' }}/>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: clr.textLight, margin: 0 }}>
                        {circle.memberCount ?? circle.members?.length ?? 0} members · {circle.events?.length ?? 0} events
                      </p>
                    </div>
                    {isEditMode ? (
                      <div style={{ padding: '4px 8px', color: clr.textLight, cursor: 'grab', flexShrink: 0 }}>⠿</div>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h2 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: '0 0 16px' }}>Discover More</h2>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={discoverSearch} onChange={e => setDiscoverSearch(e.target.value)} placeholder="Search new circles..." style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 40px', borderRadius: 14, border: `1.5px solid ${clr.border}`, backgroundColor: clr.white, fontSize: 14, color: clr.textDark, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unjoinedCircleObjects.slice(0, 5).map((c, idx) => (
                <CircleCard key={c.id} circle={c} idx={idx} isJoined={false} onJoin={() => joinCircle(c.id)} onClick={() => navigate(`/circles/${c.id}`)} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div style={{ animation: 'slideUp 0.15s ease' }}>


            <div style={{ position: 'relative', marginBottom: 14 }}>
              <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={connectionSearch} onChange={e => setConnectionSearch(e.target.value)} placeholder="Search connections..." style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px 12px 42px', borderRadius: 999, border: `1.5px solid ${clr.border}`, backgroundColor: clr.white, fontSize: 14, color: clr.textDark, outline: 'none', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, margin: '0 -16px', padding: '0 16px 16px', scrollbarWidth: 'none' }}>
              {['all','professional','social','activity'].map(f => (
                <button key={f} onClick={() => setConnectionFilter(f)} style={{
                  padding: '8px 16px', borderRadius: 999, border: 'none',
                  backgroundColor: connectionFilter === f ? clr.indigo : clr.white,
                  color: connectionFilter === f ? '#FFFFFF' : clr.textMid,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  boxShadow: connectionFilter === f ? '0 4px 12px rgba(91,95,239,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  {f === 'all' ? 'All' : f === 'professional' ? '💼 Professional' : f === 'social' ? '🎉 Social' : '🏃 Activity'}
                </button>
              ))}
            </div>

            {rankedConnections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🤝</div>
                <p style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, margin: '0 0 8px 0' }}>No connections yet</p>
                <p style={{ fontSize: 14, color: clr.textMid, margin: 0 }}>Join circles and start chatting to build your network</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
                {filteredConnections.map((person, idx) => {
                  const tier   = getConnectionTier(person.score)
                  const hasDM  = Object.values(chatState ?? {}).some(c => c.type === 'dm' && c.personId === person.id)

                  return (
                    <div key={person.id} onClick={() => navigate(`/user/${person.id}`)} style={{ backgroundColor: clr.white, borderRadius: 20, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, width: 20, textAlign: 'center', flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={person.avatar} alt={person.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tier.dot}` }}/>
                        {person.online && (
                          <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', backgroundColor: '#22C55E', border: `2px solid ${clr.white}` }}/>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {person.name}
                          </span>
                          <span title="Momentum Streak" style={{ fontSize: 11, fontWeight: 700, backgroundColor: tier.bg, color: tier.color, padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            {Math.max(1, Math.floor(person.score / 15))}
                          </span>
                        </div>
                        <div style={{ marginBottom: 5 }}>
                          <div style={{ height: 3, borderRadius: 999, backgroundColor: clr.bg, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(person.score, 100)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${tier.dot}, #A78BFA)`, transition: 'width 0.8s ease' }}/>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {person.sharedCircles.slice(0, 2).map(c => (
                            <span key={c.id} style={{ fontSize: 10, color: clr.textLight, backgroundColor: clr.bg, padding: '2px 8px', borderRadius: 999 }}>
                              {c.emoji} {c.name.slice(0, 12)}
                            </span>
                          ))}
                          {hasDM && (
                            <span style={{ fontSize: 10, color: clr.indigo, backgroundColor: clr.indigoLt, padding: '2px 8px', borderRadius: 999 }}>
                              💬 DM
                            </span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/chat/${startDM(person)}`) }} style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 10px rgba(91,95,239,0.3)' }}>
                        <svg width="16" height="16" fill="none" stroke="#FFFFFF" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'network' && (
          <div style={{ animation: 'slideUp 0.15s ease' }}>
            {joinedCircles.length === 0 ? (
              <p style={{ fontSize: 15, color: clr.textMid, textAlign: 'center', padding: '60px 20px', backgroundColor: clr.white, borderRadius: 24 }}>
                Join some circles to see your network graph 🕸️
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, margin: '0 -16px', padding: '0 16px 16px', scrollbarWidth: 'none' }}>
                  {['all','professional','social','activity'].map(f => (
                    <button key={f} onClick={() => setNetworkFilter(f)} style={{
                      padding: '8px 16px', borderRadius: 999, border: 'none',
                      backgroundColor: networkFilter === f ? clr.indigo : clr.white,
                      color: networkFilter === f ? '#FFFFFF' : clr.textMid,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      boxShadow: networkFilter === f ? '0 4px 12px rgba(91,95,239,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      {f === 'all' ? 'All' : f === 'professional' ? '💼 Professional' : f === 'social' ? '🎉 Social' : '🏃 Activity'}
                    </button>
                  ))}
                </div>
                
                <NetworkGraph filter={networkFilter} people={people} circles={circles} joinedCircles={joinedCircles} currentUser={currentUser} onSelectNode={setSelectedNode} selectedNode={selectedNode} />

                {selectedNode && (
                  <div style={{
                    position: 'fixed', bottom: 85, left: 0, right: 0, zIndex: 100, padding: '0 16px', animation: 'slideUp 0.2s ease',
                    display: 'flex', justifyContent: 'center'
                  }}>
                    <div style={{
                      backgroundColor: clr.white, borderRadius: 24, padding: 20, width: '100%', maxWidth: 560,
                      boxShadow: '0 -4px 32px rgba(0,0,0,0.15)', position: 'relative'
                    }}>
                      <div style={{ width: 32, height: 4, borderRadius: 999, backgroundColor: clr.border, margin: '0 auto 16px' }}/>
                      
                      {selectedNode.type === 'circle' ? (
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:52, height:52, borderRadius:14, backgroundColor:clr.indigoLt, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>{selectedNode.emoji}</div>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:16, fontWeight:700, color:clr.textDark, margin:'0 0 4px 0' }}>{selectedNode.label}</p>
                            <ActivityBadge score={getActivityScore(circles.find(c => c.id === selectedNode.circleId))}/>
                          </div>
                          <button onClick={() => navigate(`/circles/${selectedNode.circleId}`)} style={{ padding:'10px 18px', borderRadius:999, border:'none', background:`linear-gradient(135deg,${clr.indigo},#7B6FFF)`, color:'#FFF', fontSize:13, fontWeight:700, cursor:'pointer' }}>View →</button>
                        </div>
                      ) : selectedNode.type === 'person' ? (
                        <div onClick={() => navigate(`/user/${selectedNode.personId}`)} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                          <img src={selectedNode.avatar} alt={selectedNode.label} style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover' }}/>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:16, fontWeight:700, color:clr.textDark, margin:'0 0 4px 0' }}>{selectedNode.label}</p>
                            <p style={{ fontSize:12, color:clr.textLight, margin:0 }}>In your network</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); const person = people.find(p => p.id === selectedNode.personId); if (person) { const chatId = startDM(person); navigate(`/chat/${chatId}`) } }} style={{ padding:'10px 18px', borderRadius:999, border:'none', background:`linear-gradient(135deg,${clr.indigo},#7B6FFF)`, color:'#FFF', fontSize:13, fontWeight:700, cursor:'pointer' }}>Message →</button>
                        </div>
                      ) : null}

                      <button onClick={() => setSelectedNode(null)} style={{ position:'absolute', top:16, right:16, background:clr.bg, border:'none', cursor:'pointer', width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="12" height="12" fill="none" stroke={clr.textMid} strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
