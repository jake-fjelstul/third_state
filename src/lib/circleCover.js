/**
 * Deterministic circle cover gradients.
 *
 * Each circle maps to a fixed palette entry derived from a hash of its id, so
 * the same circle always renders the same cover across devices and sessions,
 * with no stored value required. Palette is restricted to deep jewel tones to
 * match the app's create wheel and assistant ring.
 */

const PALETTE = [
  ['#3E3D96', '#25254F'], // indigo
  ['#12655B', '#0B3B36'], // teal
  ['#5B3A8C', '#33204F'], // violet
  ['#8A6410', '#4E3809'], // bronze
  ['#8C3A4E', '#4F1F2B'], // rose
  ['#1E5A7A', '#123646'], // steel blue
  ['#4A6B2A', '#2A3D18'], // moss
  ['#7A3E1E', '#452312'], // terracotta
]

const ANGLES = [135, 150, 160, 120]

/** FNV-1a style string hash. Stable across platforms; always non-negative. */
function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function seedFor(circle) {
  return String(
    circle?.id ||
    circle?.name ||
    circle?.coverGradient ||
    'third-space'
  )
}

export function circleGradientFor(circle) {
  const h = hashString(seedFor(circle))
  const [from, to] = PALETTE[h % PALETTE.length]
  const angle = ANGLES[(h >> 3) % ANGLES.length]
  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`
}

export function resolveCircleCover(circle) {
  if (circle?.coverImageUrl) return { kind: 'image', url: circle.coverImageUrl }
  return {
    kind: 'gradient',
    value: circleGradientFor(circle),
  }
}
