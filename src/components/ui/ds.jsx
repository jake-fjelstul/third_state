/*
 * Third Space design system v2 — the shared building blocks.
 * Every redesigned screen uses these instead of hand-styled inline elements,
 * so sizes, radii and colors stay consistent. Tokens live in index.css.
 */
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { avatarFor } from '../../lib/avatar'
import { useHardwareBack } from '../../lib/hardwareBack.js'

export const type = {
  largeTitle: { fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: 'var(--font-display)' },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: 'var(--font-display)' },
  headline: { fontSize: 17, fontWeight: 600, lineHeight: 1.3 },
  body: { fontSize: 17, fontWeight: 400, lineHeight: 1.35 },
  secondary: { fontSize: 15, fontWeight: 400, lineHeight: 1.35, color: 'var(--textMid)' },
  caption: { fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: 'var(--textLight)' },
}

/* ── Buttons ──────────────────────────────────────────────────────────── */

const BUTTON_VARIANTS = {
  primary: { background: 'var(--ink)', color: 'var(--on-ink)', border: 'none' },
  secondary: { background: 'var(--surface-2)', color: 'var(--textDark)', border: 'none' },
  accent: { background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' },
  outline: { background: 'transparent', color: 'var(--textDark)', border: '1px solid var(--border)' },
  ghost: { background: 'transparent', color: 'var(--textDark)', border: 'none' },
  danger: { background: 'transparent', color: 'var(--bad)', border: '1px solid var(--border)' },
}
const BUTTON_SIZES = {
  sm: { height: 34, padding: '0 14px', fontSize: 15, borderRadius: 10 },
  md: { height: 44, padding: '0 18px', fontSize: 16, borderRadius: 14 },
  lg: { height: 50, padding: '0 22px', fontSize: 17, borderRadius: 14 },
}

export function Button({ variant = 'primary', size = 'md', block = false, icon = null, children, style, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled}
      {...props}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
        width: block ? '100%' : undefined, opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
        ...BUTTON_SIZES[size], ...BUTTON_VARIANTS[variant], ...style,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

/** 44pt square tap target around an icon. */
export function IconButton({ label, children, style, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      style={{
        width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--textDark)',
        position: 'relative', flexShrink: 0, ...style,
      }}
    >
      {children}
    </button>
  )
}

/* ── Chips ────────────────────────────────────────────────────────────── */

export function Chip({ selected = false, children, style, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
        borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
        background: selected ? 'var(--ink)' : 'var(--surface-2)',
        color: selected ? 'var(--on-ink)' : 'var(--textDark)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/* ── Avatars ──────────────────────────────────────────────────────────── */

/**
 * Round photo (people) or rounded square (`square`, for circles/groups).
 * `ring` draws the story-style accent ring used for "Free now".
 */
export function Avatar({ person, src, name, size = 44, ring = false, square = false, style }) {
  const url = src || (person ? avatarFor(person) : '')
  const label = name || person?.name || ''
  const radius = square ? Math.round(size * 0.28) : '50%'
  const img = url ? (
    <img src={url} alt={label} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', display: 'block', backgroundColor: 'var(--surface-2)' }} />
  ) : (
    <div aria-label={label} style={{
      width: size, height: size, borderRadius: radius, backgroundColor: 'var(--surface-3)', color: 'var(--textMid)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.38),
    }}>
      {(label || '?').trim().charAt(0).toUpperCase()}
    </div>
  )
  if (!ring) return <div style={{ flexShrink: 0, ...style }}>{img}</div>
  return (
    <div style={{ padding: 2.5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, ...style }}>
      <div style={{ padding: 2.5, borderRadius: '50%', background: 'var(--bg)' }}>{img}</div>
    </div>
  )
}

/* ── Text blocks ──────────────────────────────────────────────────────── */

/** Left-aligned large title with an optional trailing control. */
export function LargeTitle({ children, right, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 8px 20px', ...style }}>
      <h1 style={{ margin: 0, ...type.largeTitle, color: 'var(--textDark)' }}>{children}</h1>
      {right}
    </div>
  )
}

export function SectionHeader({ title, action, onAction, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 20px', margin: '20px 0 12px', ...style }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--textDark)', fontFamily: 'var(--font-display)' }}>{title}</h2>
      {action && (
        <button type="button" onClick={onAction} style={{
          background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 15, fontWeight: 500, color: 'var(--textMid)',
        }}>
          {action}
        </button>
      )}
    </div>
  )
}

/* ── Rows and cards ───────────────────────────────────────────────────── */

/** Edge-to-edge list row: leading visual, title/subtitle, trailing meta. */
export function ListRow({ leading, title, subtitle, meta, trailing, onClick, unread = false, chevron = false, style }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        background: 'none', border: 'none', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit', color: 'var(--textDark)', minHeight: 56, ...style,
      }}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: unread ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontSize: 15, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: unread ? 'var(--textDark)' : 'var(--textMid)', fontWeight: unread ? 600 : 400,
          }}>{subtitle}</div>
        )}
      </div>
      {(meta || unread) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, alignSelf: 'stretch', paddingTop: 4 }}>
          {meta && <span style={{ fontSize: 13, color: 'var(--textLight)' }}>{meta}</span>}
          {unread && <span aria-label="Unread" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)' }} />}
        </div>
      )}
      {trailing}
      {chevron && <ChevronRight size={18} color="var(--textLight)" style={{ flexShrink: 0 }} />}
    </Tag>
  )
}

export function Card({ children, onClick, style, padded = true }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--white)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
        overflow: 'hidden', padding: padded ? 16 : 0, cursor: onClick ? 'pointer' : undefined, ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Divider({ inset = 0, style }) {
  return <div style={{ height: 0.5, background: 'var(--border)', marginLeft: inset, ...style }} />
}

/* ── Navigation ───────────────────────────────────────────────────────── */

/** Header for pushed screens: back chevron, centered title, optional right. */
export function NavBar({ title, onBack, right, children, style }) {
  return (
    <div style={{
      height: 52, display: 'flex', alignItems: 'center', padding: '0 4px',
      borderBottom: '0.5px solid var(--border)', background: 'var(--bg)', ...style,
    }}>
      <div style={{ width: 88, display: 'flex' }}>
        {onBack && <IconButton label="Back" onClick={onBack}><ChevronLeft size={28} strokeWidth={2.2} /></IconButton>}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {children || <span style={{ fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>}
      </div>
      <div style={{ width: 88, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}

/** Underline tabs (circle page, profile). */
export function Tabs({ tabs, value, onChange, style }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 24, padding: '0 20px', borderBottom: '0.5px solid var(--border)', overflowX: 'auto', ...style }} className="noscrollbar">
      {tabs.map(t => {
        const on = t.id === value
        return (
          <button key={t.id} role="tab" aria-selected={on} type="button" onClick={() => onChange(t.id)} style={{
            padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
            color: on ? 'var(--textDark)' : 'var(--textLight)',
            boxShadow: on ? 'inset 0 -2px 0 var(--textDark)' : 'none',
          }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Sheets ───────────────────────────────────────────────────────────── */

/** Bottom sheet rendered at <body>, with scrim, spring and Android back. */
export function Sheet({ open, onClose, title, children, maxHeight = 'var(--sheet-max)' }) {
  const reduced = useReducedMotion()
  useHardwareBack(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <motion.div
            data-sheet
            role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            initial={reduced ? false : { y: '100%' }} animate={{ y: 0 }} exit={reduced ? undefined : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, maxHeight, overflowY: 'auto', background: 'var(--white)', color: 'var(--textDark)',
              borderRadius: '20px 20px 0 0', padding: '8px 20px calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--surface-3)', margin: '0 auto 12px' }} />
            {title && <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
