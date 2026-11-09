import { PageSkeleton } from '../components/ui/Skeleton.jsx'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { listProfiles } from '../lib/profiles'
import { getCirclesPage, isDiscoverable, requiresApplication } from '../lib/circles'
import { useAppContext } from '../context/AppContext.jsx'
import { avatarFor } from '../lib/avatar'
import Memories from './Memories.jsx'
import CircleIcon from '../components/ui/CircleIcon.jsx'
import { Briefcase, PartyPopper, Activity, Users, MessageCircle, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateProfile } from '../lib/auth'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight.js'
import { LargeTitle, Tabs } from '../components/ui/ds.jsx'
import { resolveCircleCover } from '../lib/circleCover'
import { readCache, writeCache } from '../lib/localCache.js'
import { useRefreshOnTabReturn } from '../lib/tabActive.js'
import CircleRow from '../components/ui/CircleRow.jsx'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

const CIRCLE_COLORS = [
  { bg: 'var(--indigoLt)', accent: 'var(--indigo)' },
  { bg: '#FEF3C7', accent: '#D97706' },
  { bg: '#D1FAE5', accent: '#059669' },
  { bg: '#FFE4E6', accent: '#E11D48' },
]

function getMemberCount(circle) {
  return circle?.memberCount ?? (circle?.members || []).length ?? 0
}

function getInteractionScore(person, chatState, circles, joinedCircles) {
  let score = 0
  const sharedCircles = joinedCircles.filter(circleId => {
    const circle = circles.find(c => c.id === circleId)
    return (circle?.members || []).some(m => m.id === person.id)
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
      m => (m.senderId || m.sender_id) === person.id
    )
    if (theyPosted) score += 8
  })

  // Recency decay multiplier over existing affinity/volume score:
  // Full weight (1.0) within last 7 days, decaying to ~0.45 at 30 days, floor of 0.2 for older/null.
  const lastInteraction = person.lastInteractionAt || person.last_interaction_at || person.lastHangout || person.last_hangout
  let recencyMultiplier = 0.2
  if (lastInteraction) {
    const daysAgo = Math.max(0, (Date.now() - new Date(lastInteraction).getTime()) / 86400000)
    recencyMultiplier = daysAgo <= 7 ? 1.0 : (0.2 + 0.8 * Math.exp(-(daysAgo - 7) / 20))
  }

  return Math.round(score * recencyMultiplier)
}

function getConnectionTier(score) {
  if (score >= 80) return { label: 'Close', bg: 'var(--indigoLt)', color: 'var(--indigo)', dot: 'var(--indigo)' }
  if (score >= 40) return { label: 'Regular', bg: '#D1FAE5', color: '#059669', dot: '#10B981' }
  if (score >= 15) return { label: 'Familiar', bg: '#FEF3C7', color: '#D97706', dot: '#F59E0B' }
  return { label: 'New', bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' }
}

function ActivityBadge({ score }) {
  const tier = score >= 70 ?
    { label: 'Core', bg: 'var(--indigoLt)', color: 'var(--indigo)' } :
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

/* One ranked row. In edit mode it's draggable by its handle (long-press on
   touch, so normal scrolling still works). */
function SortableCircleRow({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled })
  return children({
    setNodeRef,
    handleProps: { ref: setActivatorNodeRef, ...attributes, ...listeners },
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      position: 'relative',
      zIndex: isDragging ? 5 : 'auto',
    },
    isDragging,
  })
}

function CircleCard({ circle, isJoined, onJoin, onClick }) {
  return <CircleRow circle={circle} isJoined={isJoined} onJoin={onJoin} onClick={onClick} />
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

function NetworkGraph({ filter, connections = [], circles = [], joinedCircles = [], currentUser, onSelectNode, selectedNode, onOpenTab }) {
  const isDark = useDarkMode()
  const { blockedUserIds } = useAppContext()

  const colors = isDark ? {
    bg: '#000000', card: '#121214', ring: '#26262B', edge: 'var(--indigo)', youBorder: 'var(--indigo)', glow1: 'rgba(129,140,248,0.2)', glow2: 'rgba(129,140,248,0.1)', circleNodeBg: '#1E1E3F', circleNodeBorder: 'var(--indigo)', personNodeBg: '#1E1E2E', personNodeBorder: '#2A2A4E', labelYou: '#F0F0FF', labelOther: '#9CA3AF', tooltipBg: '#252540',
  } : {
    bg: '#F4F4F6', card: '#FFFFFF', ring: '#E7E7EA', edge: 'var(--indigo)', youBorder: 'var(--indigo)', glow1: 'none', glow2: 'none', circleNodeBg: 'var(--indigoLt)', circleNodeBorder: 'var(--indigo)', personNodeBg: '#FFFFFF', personNodeBorder: '#E8E8EE', labelYou: '#1A1A2E', labelOther: '#6B7280', tooltipBg: '#FFFFFF',
  }

  const cx = 280, cy = 280
  const minDim = 500
  const R1 = 0.30 * minDim // 150px
  const R2 = 0.44 * minDim // 220px

  const activeBlockedIds = blockedUserIds || []

  const matchesFilter = (c) => {
    if (!c) return false
    if (filter === 'all') return true
    if (filter === 'professional') return c.category === 'professional' || c.interestTag?.toLowerCase().includes('startup') || c.interestTag?.toLowerCase().includes('tech')
    if (filter === 'social') return c.category === 'social'
    if (filter === 'activity') return c.category === 'outdoors' || c.category === 'activity'
    return true
  }

  const getSharedCirclesForConn = (conn) => {
    if (conn.sharedCircles && conn.sharedCircles.length > 0) return conn.sharedCircles
    return joinedCircles
      .map(id => circles.find(c => c.id === id))
      .filter(c => c && (c.members || []).some(m => m.id === conn.id))
  }

  const connMatchesFilter = (conn) => {
    if (filter === 'all') return true
    const shared = getSharedCirclesForConn(conn)
    return shared.some(c => matchesFilter(c))
  }

  // Ring 1: Direct Connections (Filtered & Capped to 12)
  const validConnections = (connections || [])
    .filter(conn => conn.id && conn.id !== currentUser?.id && !activeBlockedIds.includes(conn.id))
    .filter(connMatchesFilter)

  const maxRing1Slots = 12
  const hasConnectionOverflow = validConnections.length > maxRing1Slots
  const displayConnCount = hasConnectionOverflow ? maxRing1Slots - 1 : validConnections.length
  const overflowConnCount = hasConnectionOverflow ? validConnections.length - displayConnCount : 0

  const ring1Items = validConnections.slice(0, displayConnCount).map(c => ({
    type: 'connection',
    data: c,
    id: `person-${c.id}`,
    label: (c.name || 'User').split(' ')[0],
  }))

  if (hasConnectionOverflow) {
    ring1Items.push({
      type: 'overflow_connections',
      id: 'overflow-connections',
      label: `+${overflowConnCount}`,
      count: overflowConnCount,
    })
  }

  // Ring 2: Circles (Filtered & Capped to 8)
  const joinedCircleObjs = joinedCircles
    .map(id => circles.find(c => c.id === id))
    .filter(Boolean)
    .filter(matchesFilter)
  joinedCircleObjs.sort((a, b) => getMemberCount(b) - getMemberCount(a))

  const maxRing2Slots = 8
  const hasCircleOverflow = joinedCircleObjs.length > maxRing2Slots
  const displayCircleCount = hasCircleOverflow ? maxRing2Slots - 1 : joinedCircleObjs.length
  const overflowCircleCount = hasCircleOverflow ? joinedCircleObjs.length - displayCircleCount : 0

  const ring2Items = joinedCircleObjs.slice(0, displayCircleCount).map(c => ({
    type: 'circle',
    data: c,
    id: `circle-${c.id}`,
    circleId: c.id,
    label: c.name,
  }))

  if (hasCircleOverflow) {
    ring2Items.push({
      type: 'overflow_circles',
      id: 'overflow-circles',
      label: `+${overflowCircleCount}`,
      count: overflowCircleCount,
    })
  }

  // Compute Positions
  const N1 = Math.max(ring1Items.length, 1)
  const step1 = (2 * Math.PI) / N1

  const ring1Nodes = ring1Items.map((item, i) => {
    const angle = i * step1 - Math.PI / 2
    const radius = 22 // 44px diameter
    const x = cx + R1 * Math.cos(angle)
    const y = cy + R1 * Math.sin(angle)
    return { ...item, x, y, angle, radius }
  })

  const N2 = Math.max(ring2Items.length, 1)
  const step2 = (2 * Math.PI) / N2
  const offset2 = step2 / 2 // Half angular step rotation relative to ring 1

  const ring2Nodes = ring2Items.map((item, i) => {
    const angle = i * step2 - Math.PI / 2 + offset2
    const radius = 16 // 32px diameter
    const x = cx + R2 * Math.cos(angle)
    const y = cy + R2 * Math.sin(angle)
    return { ...item, x, y, angle, radius }
  })

  const isCircleSelected = selectedNode?.type === 'circle'
  const selectedCircleId = isCircleSelected ? selectedNode.circleId : null

  // Member Arc calculation for selected circle
  const selectedCircleObj = selectedCircleId ? circles.find(c => c.id === selectedCircleId) : null
  const selectedCircleMembers = selectedCircleObj
    ? (selectedCircleObj.members || []).filter(m => m.id && m.id !== currentUser?.id && !activeBlockedIds.includes(m.id))
    : []

  const selectedCircleNode = ring2Nodes.find(n => n.type === 'circle' && n.circleId === selectedCircleId)

  let memberArcNodes = []
  if (selectedCircleNode && selectedCircleMembers.length > 0) {
    const circleAngle = selectedCircleNode.angle
    const memberCount = selectedCircleMembers.length
    const arcSpread = Math.min(Math.PI * 0.7, (memberCount - 1) * 0.35)
    const arcRadius = 36 // Distance outside the circle node center
    const memberRadius = 14 // 28px diameter

    memberArcNodes = selectedCircleMembers.map((m, i) => {
      const angleOffset = memberCount > 1
        ? -arcSpread / 2 + (i / (memberCount - 1)) * arcSpread
        : 0
      const angle = circleAngle + angleOffset
      const mx = selectedCircleNode.x + arcRadius * Math.cos(angle)
      const my = selectedCircleNode.y + arcRadius * Math.sin(angle)
      return {
        id: `arc-member-${m.id}`,
        personId: m.id,
        name: m.name,
        avatar: m.avatar,
        x: mx,
        y: my,
        radius: memberRadius,
        circleX: selectedCircleNode.x,
        circleY: selectedCircleNode.y,
      }
    })
  }

  // Radial label helper for Ring 1
  const getRing1LabelProps = (angle, count) => {
    const labelDist = 30 // 22px node radius + 8px gap
    const lx = Math.cos(angle) * labelDist
    const ly = Math.sin(angle) * labelDist
    const cosVal = Math.cos(angle)
    const sinVal = Math.sin(angle)

    let textAnchor = 'middle'
    if (cosVal > 0.3) textAnchor = 'start'
    else if (cosVal < -0.3) textAnchor = 'end'

    let dominantBaseline = 'central'
    if (sinVal > 0.4) dominantBaseline = 'hanging'
    else if (sinVal < -0.4) dominantBaseline = 'auto'

    const fontSize = count > 8 ? 10 : 11
    const maxLen = count > 8 ? 8 : 10

    return { lx, ly, textAnchor, dominantBaseline, fontSize, maxLen }
  }

  const handleSvgClick = (e) => {
    if (e.target.getAttribute('data-bg') === 'true' || e.target.tagName === 'svg') {
      onSelectNode?.(null)
    }
  }

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', borderRadius: 24, backgroundColor: colors.card, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <svg
          viewBox="0 0 560 560"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', maxWidth: '100%', display: 'block', cursor: 'pointer' }}
          onClick={handleSvgClick}
        >
          {/* Background overlay target for clearing selection */}
          <rect width="560" height="560" fill="transparent" data-bg="true" />

          {/* Concentric Guide Rings */}
          <circle cx={cx} cy={cy} r={R1} fill="none" stroke={colors.ring} strokeDasharray="4 6" strokeWidth={1.5} opacity={selectedCircleId ? 0.3 : 1} />
          <circle cx={cx} cy={cy} r={R2} fill="none" stroke={colors.ring} strokeDasharray="4 6" strokeWidth={1} opacity={selectedCircleId ? 0.3 : 1} />

          {/* Empty State */}
          {ring1Nodes.length === 0 && ring2Nodes.length === 0 && (
            <text x={cx} y={cy + R1 + 20} textAnchor="middle" fill={colors.labelOther} fontSize={13} fontStyle="italic">
              Join circles or add connections to grow your network
            </text>
          )}

          {/* Default Edges: Center to Ring 1 Connections ONLY */}
          {ring1Nodes.map((node) => (
            <line
              key={`edge-you-${node.id}`}
              x1={cx}
              y1={cy}
              x2={node.x}
              y2={node.y}
              stroke={colors.edge}
              strokeWidth={1}
              strokeOpacity={selectedCircleId ? 0.08 : 0.25}
              style={{ transition: 'stroke-opacity 0.3s ease' }}
            />
          ))}

          {/* Selected Circle Member Arc Edges */}
          {memberArcNodes.map((m) => (
            <line
              key={`edge-arc-${m.id}`}
              x1={m.circleX}
              y1={m.circleY}
              x2={m.x}
              y2={m.y}
              stroke={colors.edge}
              strokeWidth={1.5}
              strokeDasharray="2 2"
              strokeOpacity={0.8}
            />
          ))}

          {/* CENTER NODE: Current User */}
          {(() => {
            const userRadius = 32 // 64px diameter
            const isDimmed = selectedCircleId !== null
            return (
              <g
                transform={`translate(${cx}, ${cy})`}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.3s ease' }}
                onClick={(e) => { e.stopPropagation(); onSelectNode?.({ id: 'you', type: 'user', label: currentUser?.name }) }}
              >
                <circle cx={0} cy={0} r={userRadius + 8} fill="none" stroke={colors.glow1} strokeWidth="2" />
                <circle cx={0} cy={0} r={userRadius + 16} fill="none" stroke={colors.glow2} strokeWidth="1" />
                <foreignObject x={-userRadius} y={-userRadius} width={userRadius * 2} height={userRadius * 2}>
                  <img src={avatarFor({ avatar: currentUser?.avatar, name: currentUser?.name })} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                </foreignObject>
                <circle cx={0} cy={0} r={userRadius} fill="none" stroke={colors.youBorder} strokeWidth="2" />
                <text x={0} y={userRadius + 18} textAnchor="middle" fontSize={13} fontWeight={600} fill={colors.labelYou} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {(currentUser?.name || 'You').split(' ')[0]}
                </text>
              </g>
            )
          })()}

          {/* RING 1 NODES: Direct Connections */}
          {ring1Nodes.map((node) => {
            const isDimmed = selectedCircleId !== null
            if (node.type === 'overflow_connections') {
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.3s ease' }}
                  onClick={(e) => { e.stopPropagation(); onOpenTab?.('connections') }}
                >
                  <circle cx={0} cy={0} r={node.radius} fill={colors.personNodeBg} stroke={colors.youBorder} strokeWidth="1.5" />
                  <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill={colors.youBorder}>
                    {node.label}
                  </text>
                </g>
              )
            }

            const p = node.data
            const labelProps = getRing1LabelProps(node.angle, ring1Nodes.length)
            const truncatedLabel = p.name ? (p.name.length > labelProps.maxLen ? p.name.slice(0, labelProps.maxLen) + '…' : p.name) : 'User'

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.3s ease' }}
                onPointerDown={(e) => { e.stopPropagation(); onSelectNode?.({ id: node.id, type: 'person', personId: p.id, label: p.name, avatar: p.avatar }) }}
              >
                <foreignObject x={-node.radius} y={-node.radius} width={node.radius * 2} height={node.radius * 2}>
                  <img src={avatarFor({ avatar: p.avatar, name: p.name })} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', backgroundColor: colors.personNodeBg }} />
                </foreignObject>
                <circle cx={0} cy={0} r={node.radius} fill="none" stroke={colors.personNodeBorder} strokeWidth="1.5" />
                <text
                  x={labelProps.lx}
                  y={labelProps.ly}
                  textAnchor={labelProps.textAnchor}
                  dominantBaseline={labelProps.dominantBaseline}
                  fontSize={labelProps.fontSize}
                  fontWeight={500}
                  fill={colors.labelOther}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {truncatedLabel}
                </text>
              </g>
            )
          })}

          {/* RING 2 NODES: Circles */}
          {ring2Nodes.map((node) => {
            const isSelected = selectedCircleId === node.circleId
            const isDimmed = selectedCircleId !== null && !isSelected

            if (node.type === 'overflow_circles') {
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 0.6, transition: 'opacity 0.3s ease' }}
                  onClick={(e) => { e.stopPropagation(); onOpenTab?.('circles') }}
                >
                  <circle cx={0} cy={0} r={node.radius} fill={colors.circleNodeBg} stroke={colors.circleNodeBorder} strokeWidth="1.5" />
                  <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill={colors.circleNodeBorder}>
                    {node.label}
                  </text>
                </g>
              )
            }

            const c = node.data
            const nodeOpacity = isSelected ? 1.0 : isDimmed ? 0.3 : 0.6

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer', opacity: nodeOpacity, transition: 'opacity 0.3s ease' }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isSelected) {
                    onSelectNode?.(null)
                  } else {
                    onSelectNode?.({ id: node.id, type: 'circle', circleId: c.id, label: c.name, name: c.name, emoji: c.emoji, icon: c.icon })
                  }
                }}
              >
                <circle cx={0} cy={0} r={node.radius} fill={colors.circleNodeBg} stroke={isSelected ? colors.youBorder : colors.circleNodeBorder} strokeWidth={isSelected ? 2.5 : 1.5} />
                <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={colors.circleNodeBorder}>
                  {(c.name || '?').charAt(0).toUpperCase()}
                </text>
                {/* Circle Label: HIDDEN by default, shown ONLY when selected */}
                {isSelected && (
                  <text x={0} y={node.radius + 14} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.labelYou} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {c.name}
                  </text>
                )}
              </g>
            )
          })}

          {/* SELECTED CIRCLE MEMBER ARC AVATARS */}
          {memberArcNodes.map((m) => (
            <g
              key={m.id}
              transform={`translate(${m.x}, ${m.y})`}
              style={{ cursor: 'pointer', animation: 'tsFadeIn 0.2s ease-out both' }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectNode?.({ id: `person-${m.personId}`, type: 'person', personId: m.personId, label: m.name, avatar: m.avatar })
              }}
            >
              <foreignObject x={-m.radius} y={-m.radius} width={m.radius * 2} height={m.radius * 2}>
                <img src={avatarFor({ avatar: m.avatar, name: m.name })} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', backgroundColor: colors.personNodeBg }} />
              </foreignObject>
              <circle cx={0} cy={0} r={m.radius} fill="none" stroke={colors.personNodeBorder} strokeWidth="1.5" />
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, padding: '0 4px', fontSize: 11, color: colors.labelOther, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.youBorder }} /> You</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${colors.personNodeBorder}` }} /> Connection (Ring 1)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.circleNodeBg, border: `1.5px solid ${colors.circleNodeBorder}` }} /> Circle (Ring 2)</span>
      </div>
    </div>
  )
}

export default function Circles() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, joinedCircles, joinCircle, startDM, chatState, connections, circleMembershipVersion, blockedUserIds, refreshProfile } = useAppContext()
  const kbHeight = useKeyboardHeight()

  const [searchParams, setSearchParams] = useSearchParams()
  const validTabs = ['circles', 'connections', 'memories', 'network']
  const tabFromUrl = searchParams.get('tab')
  const activeTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'circles'
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true })
  // Saved order first, then any newly joined circles at the end (item 11).
  const [localOrder, setLocalOrder] = useState(null)
  const circleOrder = useMemo(() => {
    const saved = localOrder || currentUser?.circleOrder || []
    const joined = new Set(joinedCircles)
    const kept = saved.filter(id => joined.has(id))
    const keptSet = new Set(kept)
    return [...kept, ...joinedCircles.filter(id => !keptSet.has(id))]
  }, [localOrder, currentUser?.circleOrder, joinedCircles])
  const [isEditMode, setIsEditMode] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragStart = () => {
    import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
      .catch(() => {})
  }
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const next = arrayMove(circleOrder, circleOrder.indexOf(active.id), circleOrder.indexOf(over.id))
    setLocalOrder(next)
    if (currentUser?.id) {
      updateProfile(currentUser.id, { circle_order: next })
        .then(() => refreshProfile?.())
        .catch(err => console.error('[Circles] saving circle order failed', err))
    }
  }

  const [networkFilter, setNetworkFilter] = useState('all')
  const [selectedNode, setSelectedNode] = useState(null)
  const [discoverSearch, setDiscoverSearch] = useState('')

  const [connectionFilter, setConnectionFilter] = useState('all')
  const [connectionSearch, setConnectionSearch] = useState('')

  // Cached lists render instantly; the fetch below refreshes them (issue 5).
  const [circles, setCircles] = useState(() => readCache('circles.page') || [])
  const [circlesLoading, setCirclesLoading] = useState(() => !readCache('circles.page'))
  const [circlesError, setCirclesError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  useRefreshOnTabReturn(() => setReloadKey(k => k + 1))

  const [people, setPeople] = useState(() => readCache('circles.people') || [])
  useEffect(() => {
    let cancelled = false
    listProfiles({ excludeUserId: currentUser?.id })
      .then(list => {
        if (cancelled) return
        setPeople(list)
        writeCache('circles.people', list)
      })
      .catch(err => console.error('[Circles] listProfiles failed', err))
    return () => { cancelled = true }
  }, [currentUser?.id, reloadKey])

  useEffect(() => {
    let cancelled = false
    getCirclesPage()
      .then(({ circles }) => {
        if (cancelled) return
        setCircles(circles)
        writeCache('circles.page', circles)
        setCirclesError(null)
      })
      .catch(err => { if (!cancelled) setCirclesError(err) })
      .finally(() => { if (!cancelled) setCirclesLoading(false) })
    return () => { cancelled = true }
  }, [currentUser?.id, circleMembershipVersion, reloadKey])

  const rankedConnections = useMemo(() => {
    const seen = new Set()
    const result = []
    const activeBlockedIds = blockedUserIds || []

    connections.forEach((person) => {
      if (seen.has(person.id) || person.id === currentUser?.id || activeBlockedIds.includes(person.id)) return
      seen.add(person.id)
      result.push({
        ...person,
        score: getInteractionScore(person, chatState, circles, joinedCircles),
        sharedCircles: joinedCircles
          .map((cid) => circles.find((c) => c.id === cid))
          .filter((c) => c && (c.members || []).some((m) => m.id === person.id)),
      })
    })

    return result.sort((a, b) => b.score - a.score)
  }, [connections, joinedCircles, chatState, circles, currentUser?.id, blockedUserIds])

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
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const orderedCircleObjects = circleOrder.map(id => circles.find(c => c.id === id)).filter(Boolean)

  const unjoinedCircleObjects = useMemo(() => {
    const query = discoverSearch.trim().toLowerCase()
    const unjoined = circles.filter(c => !joinedCircles.includes(c.id))
    const browsable = query
      ? unjoined
      : unjoined.filter(isDiscoverable)
    return browsable.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.interestTag?.toLowerCase().includes(query)
    )
  }, [discoverSearch, joinedCircles, circles])

  if (circlesError && circles.length === 0) {
    // A failed load used to look exactly like "no circles" (L6).
    return (
      <div style={{ padding: 40, textAlign: 'center', color: clr.textMid }}>
        <p style={{ margin: '0 0 12px' }}>Couldn&apos;t load circles.</p>
        <button type="button" onClick={() => window.location.reload()} style={{
          minHeight: 44, padding: '10px 18px', borderRadius: 999, border: 'none',
          backgroundColor: clr.indigo, color: 'var(--on-ink)', fontWeight: 700, cursor: 'pointer',
        }}>Try again</button>
      </div>
    )
  }

  if (circlesLoading && circles.length === 0) {
    return <PageSkeleton />
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: clr.bg, paddingBottom: 110 + kbHeight, fontFamily: 'inherit' }}>
      <LargeTitle>Circles</LargeTitle>
      <Tabs
        tabs={[
          { id: 'circles', label: 'My circles' },
          { id: 'connections', label: 'Connections' },
          { id: 'memories', label: 'Memories' },
          { id: 'network', label: 'Network' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
      />

      <div style={{ padding: '0 16px', margin: '0 auto' }}>
        {activeTab === 'circles' && (
          <div style={{ animation: 'tsTabIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: clr.textDark, margin: 0 }}>Your circles</h2>
              {joinedCircles.length > 0 && (
                <button onClick={() => setIsEditMode(!isEditMode)} style={{ background: 'none', border: 'none', color: 'var(--textMid)', fontSize: 15, fontWeight: 500, cursor: 'pointer', padding: '6px 0' }}>
                  {isEditMode ? 'Done' : 'Edit order'}
                </button>
              )}
            </div>

            {joinedCircles.length === 0 ? (
              <p style={{ fontSize: 15, color: clr.textMid, textAlign: 'center', padding: '40px 20px', backgroundColor: clr.white, borderRadius: 24, margin: '0 0 32px' }}>
                Join some circles from the feed to see your rankings.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedCircleObjects.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {orderedCircleObjects.map((circle, rankIndex) => (
                  <SortableCircleRow key={circle.id} id={circle.id} disabled={!isEditMode}>
                  {({ setNodeRef, handleProps, style: dragStyle, isDragging }) => (
                  <div ref={setNodeRef}
                    onClick={() => { if (!isEditMode) navigate(`/circles/${circle.id}`) }}
                    style={{
                      ...dragStyle,
                      backgroundColor: clr.white, borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 12,
                      boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.18)' : '0 0 0 1px var(--border)',
                      border: isDragging ? `2px solid ${clr.indigo}` : '2px solid transparent',
                      cursor: isEditMode ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', backgroundColor: clr.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: clr.textMid, flexShrink: 0,
                    }}>
                      {rankIndex + 1}
                    </div>
                    {(() => {
                      const cover = resolveCircleCover(circle)
                      return (
                        <div style={{
                          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                          background: cover.kind === 'image' ? `center/cover no-repeat url("${cover.url}")` : cover.value,
                        }} />
                      )
                    })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {circle.name}
                      </div>
                      <p style={{ fontSize: 14, color: clr.textMid, margin: '2px 0 0' }}>
                        {circle.memberCount ?? (circle.members || []).length ?? 0} members
                      </p>
                    </div>
                    {isEditMode ? (
                      <button type="button" {...handleProps} aria-label={`Reorder ${circle.name}`} style={{
                        width: 44, height: 44, margin: '-8px -8px -8px 0', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'none', border: 'none', color: clr.textLight,
                        cursor: 'grab', touchAction: 'none',
                      }}>
                        <GripVertical size={20} />
                      </button>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </div>
                  )}
                  </SortableCircleRow>
                ))}
              </div>
              </SortableContext>
              </DndContext>
            )}

            <h2 style={{ fontSize: 18, fontWeight: 800, color: clr.textDark, margin: '0 0 16px' }}>Discover More</h2>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
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
          <div style={{ animation: 'tsTabIn 0.2s ease-out' }}>


            <div style={{ position: 'relative', marginBottom: 14 }}>
              <svg width="16" height="16" fill="none" stroke={clr.textLight} strokeWidth="2.5" viewBox="0 0 24 24" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={connectionSearch} onChange={e => setConnectionSearch(e.target.value)} placeholder="Search connections..." style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px 12px 42px', borderRadius: 999, border: `1.5px solid ${clr.border}`, backgroundColor: clr.white, fontSize: 14, color: clr.textDark, outline: 'none', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, margin: '0 -16px', padding: '0 16px 16px', scrollbarWidth: 'none' }}>
              {['all', 'professional', 'social', 'activity'].map(f => (
                <button key={f} onClick={() => setConnectionFilter(f)} style={{
                  padding: '8px 16px', borderRadius: 999, border: 'none',
                  backgroundColor: connectionFilter === f ? clr.indigo : clr.white,
                  color: connectionFilter === f ? 'var(--on-ink)' : clr.textMid,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  boxShadow: connectionFilter === f ? 'none' : '0 0 0 1px var(--border)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {f === 'all' ? 'All' : f === 'professional' ? <><Briefcase size={14} color="currentColor" /> Professional</> : f === 'social' ? <><PartyPopper size={14} color="currentColor" /> Social</> : <><Activity size={14} color="currentColor" /> Activity</>}
                </button>
              ))}
            </div>

            {rankedConnections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Users size={48} color={clr.indigo} style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 18, fontWeight: 700, color: clr.textDark, margin: '0 0 8px 0' }}>No connections yet</p>
                <p style={{ fontSize: 14, color: clr.textMid, margin: 0 }}>Join circles and start chatting to build your network</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
                {filteredConnections.map((person, idx) => {
                  const tier = getConnectionTier(person.score)
                  const hasDM = Object.values(chatState ?? {}).some(c => c.type === 'dm' && c.personId === person.id)

                  return (
                    <div key={person.id} onClick={() => navigate(`/user/${person.id}`)} style={{ backgroundColor: clr.white, borderRadius: 20, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 0 0 1px var(--border)', cursor: 'pointer' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, width: 20, textAlign: 'center', flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={avatarFor(person)} alt={person.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tier.dot}` }} />
                        {person.online && (
                          <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', backgroundColor: '#22C55E', border: `2px solid ${clr.white}` }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {person.name}
                          </span>
                          <span title="Momentum Streak" style={{ fontSize: 11, fontWeight: 700, backgroundColor: tier.bg, color: tier.color, padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                            {Math.max(1, Math.floor(person.score / 15))}
                          </span>
                        </div>
                        <div style={{ marginBottom: 5 }}>
                          <div style={{ height: 3, borderRadius: 999, backgroundColor: clr.bg, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(person.score, 100)}%`, borderRadius: 999, background: `var(--indigo)`, transition: 'width 0.8s ease' }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {person.sharedCircles.slice(0, 2).map(c => (
                            <span key={c.id} style={{ fontSize: 10, color: clr.textLight, backgroundColor: clr.bg, padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CircleIcon circle={c} size={12} color={clr.textLight} /> {c.name.slice(0, 12)}
                            </span>
                          ))}
                          {hasDM && (
                            <span style={{ fontSize: 10, color: clr.indigo, backgroundColor: clr.indigoLt, padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <MessageCircle size={10} color={clr.indigo} /> DM
                            </span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={async (e) => { e.stopPropagation(); try { const chatId = await startDM(person); navigate(`/chat/${chatId}`) } catch (err) { console.error('[Circles] startDM failed', err) } }} style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: 'none', background: `var(--indigo)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'none' }}>
                        <svg width="16" height="16" fill="none" stroke="var(--on-ink)" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'memories' && (
          <div style={{ animation: 'tsTabIn 0.2s ease-out' }}>
            <Memories embedded />
          </div>
        )}

        {activeTab === 'network' && (
          <div style={{ animation: 'tsTabIn 0.2s ease-out' }}>
            {joinedCircles.length === 0 && connections.length === 0 ? (
              <p style={{ fontSize: 15, color: clr.textMid, textAlign: 'center', padding: '60px 20px', backgroundColor: clr.white, borderRadius: 24 }}>
                Join some circles or make connections to see your network graph 🕸️
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, margin: '0 -16px', padding: '0 16px 16px', scrollbarWidth: 'none' }}>
                  {['all', 'professional', 'social', 'activity'].map(f => (
                    <button key={f} onClick={() => setNetworkFilter(f)} style={{
                      padding: '8px 16px', borderRadius: 999, border: 'none',
                      backgroundColor: networkFilter === f ? clr.indigo : clr.white,
                      color: networkFilter === f ? 'var(--on-ink)' : clr.textMid,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      boxShadow: networkFilter === f ? 'none' : '0 0 0 1px var(--border)',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {f === 'all' ? 'All' : f === 'professional' ? <><Briefcase size={14} color="currentColor" /> Professional</> : f === 'social' ? <><PartyPopper size={14} color="currentColor" /> Social</> : <><Activity size={14} color="currentColor" /> Activity</>}
                    </button>
                  ))}
                </div>

                <NetworkGraph filter={networkFilter} connections={rankedConnections} circles={circles} joinedCircles={joinedCircles} currentUser={currentUser} onSelectNode={setSelectedNode} selectedNode={selectedNode} onOpenTab={setActiveTab} />

                {selectedNode && (
                  <div style={{
                    position: 'fixed', bottom: 85, left: 0, right: 0, zIndex: 100, padding: '0 16px', animation: 'tsSheetUp 0.34s cubic-bezier(0.32, 0.72, 0, 1) both',
                    display: 'flex', justifyContent: 'center'
                  }}>
                    <div style={{
                      backgroundColor: clr.white, borderRadius: 24, padding: 20, width: '100%', maxWidth: 560,
                      boxShadow: '0 -4px 32px rgba(0,0,0,0.15)', position: 'relative'
                    }}>
                      <div style={{ width: 32, height: 4, borderRadius: 999, backgroundColor: clr.border, margin: '0 auto 16px' }} />

                      {selectedNode.type === 'circle' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: clr.indigoLt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CircleIcon circle={selectedNode} size={26} color={clr.indigo} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, margin: '0 0 4px 0' }}>{selectedNode.label}</p>
                            <ActivityBadge score={Math.min(getMemberCount(circles.find(c => c.id === selectedNode.circleId)) * 5, 100)} />
                          </div>
                          <button onClick={() => navigate(`/circles/${selectedNode.circleId}`)} style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: `var(--indigo)`, color: 'var(--on-ink)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>View →</button>
                        </div>
                      ) : selectedNode.type === 'person' ? (
                        <div onClick={() => navigate(`/user/${selectedNode.personId}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                          <img src={avatarFor({ avatar: selectedNode.avatar, name: selectedNode.label })} alt={selectedNode.label} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 16, fontWeight: 700, color: clr.textDark, margin: '0 0 4px 0' }}>{selectedNode.label}</p>
                            <p style={{ fontSize: 12, color: clr.textLight, margin: 0 }}>In your network</p>
                          </div>
                          <button onClick={async (e) => { e.stopPropagation(); const person = connections.find(p => p.id === selectedNode.personId) || people.find(p => p.id === selectedNode.personId); if (person) { try { const chatId = await startDM(person); navigate(`/chat/${chatId}`) } catch (err) { console.error('[Circles] startDM failed', err) } } }} style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: `var(--indigo)`, color: 'var(--on-ink)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Message →</button>
                        </div>
                      ) : null}

                      <button onClick={() => setSelectedNode(null)} style={{ position: 'absolute', top: 16, right: 16, background: clr.bg, border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="12" height="12" fill="none" stroke={clr.textMid} strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
