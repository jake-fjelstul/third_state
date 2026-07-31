import { useRef, useState, useEffect } from 'react'

const ACTION_W = 88
const OPEN_AT = 44
const LONG_PRESS_MS = 500

export default function SwipeableRow({
  enabled = true, isOpen, onOpenChange, onDelete,
  onLongPress, onClick, background, children,
}) {
  const [dx, setDx] = useState(0)
  const [animating, setAnimating] = useState(true)
  const [finePointer, setFinePointer] = useState(false)
  const [hovered, setHovered] = useState(false)

  const dxRef = useRef(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef(null)
  const moved = useRef(false)
  const lpTimer = useRef(null)
  const lpFired = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const apply = () => setFinePointer(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const setOffset = (v) => { dxRef.current = v; setDx(v) }

  useEffect(() => { if (!isOpen) setOffset(0) }, [isOpen])

  const clearLp = () => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
  }

  const handleTouchStart = (e) => {
    if (!enabled) return
    const t = e.touches[0]
    startX.current = t.clientX
    startY.current = t.clientY
    axis.current = null
    moved.current = false
    lpFired.current = false
    setAnimating(false)
    clearLp()
    lpTimer.current = setTimeout(() => {
      lpFired.current = true
      onOpenChange(false)
      onLongPress?.()
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = (e) => {
    if (!enabled) return
    const t = e.touches[0]
    const mX = t.clientX - startX.current
    const mY = t.clientY - startY.current
    if (axis.current === null) {
      if (Math.abs(mX) > 8 || Math.abs(mY) > 8) {
        axis.current = Math.abs(mX) > Math.abs(mY) ? 'h' : 'v'
        clearLp()
      }
    }
    if (axis.current !== 'h') return
    moved.current = true
    const base = isOpen ? -ACTION_W : 0
    setOffset(Math.min(0, Math.max(-ACTION_W, base + mX)))
  }

  const handleTouchEnd = () => {
    clearLp()
    if (!enabled) return
    setAnimating(true)
    if (axis.current === 'h') {
      const open = dxRef.current <= -OPEN_AT
      setOffset(open ? -ACTION_W : 0)
      onOpenChange(open)
    }
  }

  const handleClick = () => {
    if (moved.current || lpFired.current) return
    if (isOpen) { onOpenChange(false); return }
    onClick()
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {enabled && (
        <button
          type="button"
          onClick={onDelete}
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: ACTION_W, border: 'none', cursor: 'pointer',
            backgroundColor: '#FF3B30', color: '#FFFFFF',
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          Delete
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          if (finePointer && enabled) onLongPress?.()
        }}
        style={{
          position: 'relative',
          backgroundColor: background,
          transform: `translateX(${dx}px)`,
          transition: animating ? 'transform 0.22s ease' : 'none',
          touchAction: 'pan-y',
          WebkitUserSelect: 'none', userSelect: 'none',
          cursor: 'pointer',
        }}
      >
        {children}
        {enabled && finePointer && (
          <button
            type="button"
            aria-label="Conversation options"
            onClick={(e) => { e.stopPropagation(); onLongPress?.() }}
            style={{
              position: 'absolute', right: 12, top: '50%',
              transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: 999,
              border: 'none', backgroundColor: 'rgba(0,0,0,0.06)',
              color: '#666', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontFamily: 'inherit',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s ease',
              pointerEvents: hovered ? 'auto' : 'none',
            }}
          >
            ···
          </button>
        )}
      </div>
    </div>
  )
}
