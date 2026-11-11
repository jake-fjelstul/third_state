import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

/*
 * Card stack for "Meet someone new" (plan J2).
 *
 * Everything that moves during a drag is a framer-motion value, so the
 * screen never re-renders while your finger moves. The card follows your
 * finger on both axes, tilts with x, and the card underneath grows into
 * place as you pull. Release decides by distance or speed and throws the
 * card off with your finger's velocity; otherwise it springs back without
 * bouncing. The Pass / Like buttons run the same throw.
 *
 * onCommit(dir, card) -> 'advance' | 'hold' | 'restore' (or a Promise of one)
 *   advance  the parent removes the card; the next one is already in place
 *   hold     keep the card off screen (a sheet opened); call restore() or
 *            let the parent remove it later
 *   restore  spring the card back (the action was cancelled or failed)
 */

const THRESHOLD_RATIO = 0.3     // of card width
const FLICK_VELOCITY = 600      // px/s
const SPRING_BACK = { type: 'spring', stiffness: 500, damping: 38 }

function haptic(style) {
  import('@capacitor/haptics')
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle[style] || ImpactStyle.Light }))
    .catch(() => {})
}

function TopCard({ card, renderCard, renderStamp, progress, onCommit, registerControls, disabled }) {
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12])
  const likeOpacity = useTransform(x, [20, 110], [0, 1])
  const passOpacity = useTransform(x, [-110, -20], [1, 0])
  const fade = useTransform(x, (v) => (reduced ? 1 - Math.min(1, Math.abs(v) / 400) : 1))
  const elRef = useRef(null)
  const crossed = useRef(false)
  const busy = useRef(false)

  const width = () => elRef.current?.offsetWidth || 340

  // The card underneath scales with how far this one has travelled.
  useEffect(() => x.on('change', (v) => {
    const p = Math.min(1, Math.abs(v) / (width() * THRESHOLD_RATIO))
    progress.set(p)
    if (p >= 1 && !crossed.current) { crossed.current = true; haptic('Light') }
    if (p < 1) crossed.current = false
  }), [x, progress])

  const springBack = useCallback(() => {
    animate(x, 0, SPRING_BACK)
    animate(y, 0, SPRING_BACK)
  }, [x, y])

  const throwCard = useCallback(async (dir, velocityX = 0, velocityY = 0) => {
    if (busy.current) return
    busy.current = true
    haptic('Medium')
    const distance = (typeof window !== 'undefined' ? window.innerWidth : 400) * 1.2
    const target = dir * distance
    const opts = reduced
      ? { duration: 0.18, ease: 'easeOut' }
      : { type: 'spring', stiffness: 260, damping: 32, velocity: Math.max(Math.abs(velocityX), 900) * dir }
    animate(y, y.get() + velocityY * 0.12, { type: 'spring', stiffness: 260, damping: 32 })
    await animate(x, target, opts)
    let result = 'advance'
    try { result = (await onCommit(dir, card)) || 'advance' } catch { result = 'restore' }
    if (result === 'restore') {
      busy.current = false
      springBack()
    } else if (result === 'hold') {
      // Stay off screen until the parent restores or removes us.
    }
  }, [card, onCommit, reduced, springBack, x, y])

  const restore = useCallback(() => { busy.current = false; springBack() }, [springBack])

  useEffect(() => registerControls({ throwCard, restore }), [registerControls, throwCard, restore])

  return (
    <motion.div
      ref={elRef}
      drag={!disabled}
      // 1:1 with the finger; we decide where it goes on release.
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const w = width()
        const dx = info.offset.x
        const vx = info.velocity.x
        if (dx > w * THRESHOLD_RATIO || vx > FLICK_VELOCITY) throwCard(1, vx, info.velocity.y)
        else if (dx < -w * THRESHOLD_RATIO || vx < -FLICK_VELOCITY) throwCard(-1, vx, info.velocity.y)
        else springBack()
      }}
      whileTap={{ cursor: 'grabbing' }}
      style={{
        x, y, rotate, opacity: fade,
        position: 'absolute', width: '88%', maxWidth: 400, zIndex: 3,
        cursor: 'grab', touchAction: 'none', willChange: 'transform',
      }}
    >
      <motion.div style={{ opacity: likeOpacity, position: 'absolute', top: 28, left: 24, zIndex: 10, pointerEvents: 'none' }}>
        {renderStamp(card, 1)}
      </motion.div>
      <motion.div style={{ opacity: passOpacity, position: 'absolute', top: 28, right: 24, zIndex: 10, pointerEvents: 'none' }}>
        {renderStamp(card, -1)}
      </motion.div>
      {renderCard(card)}
    </motion.div>
  )
}

function UnderCard({ card, renderCard, progress, depth }) {
  // depth 1 = next (grows into place with the drag), 2 = the one after.
  const scale = useTransform(progress, [0, 1], depth === 1 ? [0.94, 1] : [0.88, 0.94])
  // Smaller and centred, so it sits fully behind the top card (no peeking text).
  const y = useTransform(progress, [0, 1], [0, 0])
  const opacity = useTransform(progress, [0, 1], depth === 1 ? [0.75, 1] : [0, 0.75])
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{ position: 'absolute', width: '88%', maxWidth: 400, zIndex: 3 - depth, pointerEvents: 'none' }}
    >
      <motion.div style={{ scale, y, opacity }}>{renderCard(card)}</motion.div>
    </motion.div>
  )
}

const SwipeDeck = forwardRef(function SwipeDeck({ cards, cardKey, renderCard, renderStamp, onCommit, disabled, empty }, ref) {
  const progress = useMotionValue(0)
  const controls = useRef(null)
  const registerControls = useCallback((c) => { controls.current = c }, [])
  const top = cards[0]
  const topKey = top ? cardKey(top) : null

  // A new top card starts from rest; the one under it starts small again.
  useEffect(() => { progress.set(0) }, [topKey, progress])

  useImperativeHandle(ref, () => ({
    swipe: (dir) => controls.current?.throwCard(dir, dir * 1200, 0),
    restore: () => controls.current?.restore(),
  }), [])

  // Size cards to the space available (fixed 520 px overflowed short phones).
  const boxRef = useRef(null)
  const [cardH, setCardH] = useState(520)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCardH(Math.max(360, Math.min(520, Math.round(entry.contentRect.height - 36))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={boxRef} style={{
      flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', padding: '0 20px', '--deck-card-h': `${cardH}px`,
    }}>
      {!top && empty}
      {cards[2] && <UnderCard key={cardKey(cards[2])} card={cards[2]} renderCard={renderCard} progress={progress} depth={2} />}
      {cards[1] && <UnderCard key={cardKey(cards[1])} card={cards[1]} renderCard={renderCard} progress={progress} depth={1} />}
      {top && (
        <TopCard
          key={topKey}
          card={top}
          renderCard={renderCard}
          renderStamp={renderStamp}
          progress={progress}
          onCommit={onCommit}
          registerControls={registerControls}
          disabled={disabled}
        />
      )}
    </div>
  )
})

export default SwipeDeck
