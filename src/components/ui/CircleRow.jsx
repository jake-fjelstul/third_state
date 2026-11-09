import { Lock } from 'lucide-react'
import { resolveCircleCover } from '../../lib/circleCover'
import { requiresApplication } from '../../lib/circles'
import { Button } from './ds.jsx'

/** A circle in a list (design v2): cover thumbnail, name, meta, one action. */
export default function CircleRow({ circle, isJoined, onJoin, onClick }) {
  const cover = resolveCircleCover(circle)
  const isPrivate = circle.type === 'private'
  const applies = requiresApplication(circle)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter') onClick?.() }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer' }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: cover.kind === 'image' ? `center/cover no-repeat url("${cover.url}")` : cover.value,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--textDark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {circle.name}
          </span>
          {isPrivate && <Lock size={13} color="var(--textLight)" style={{ flexShrink: 0 }} aria-label="Private" />}
        </div>
        <div style={{ fontSize: 14, color: 'var(--textMid)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[circle.interestTag, `${circle.memberCount ?? (circle.members || []).length ?? 0} members`].filter(Boolean).join(' · ')}
        </div>
      </div>
      <Button
        size="sm"
        variant={isJoined ? 'secondary' : 'primary'}
        disabled={isJoined}
        onClick={e => {
          e.stopPropagation()
          if (isJoined) return
          if (applies || isPrivate) { onClick?.(); return }
          onJoin?.()
        }}
        style={{ opacity: 1 }}
      >
        {isJoined ? 'Joined' : applies ? 'Apply' : 'Join'}
      </Button>
    </div>
  )
}
