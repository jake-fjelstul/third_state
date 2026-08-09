export function compactNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0'
  const n = Number(val)
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (Math.abs(n) >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  }
  return n.toLocaleString('en-US')
}

export function pct(val, digits = 1) {
  if (val === null || val === undefined || isNaN(val)) return '0%'
  const n = Number(val)
  return `${n.toFixed(digits)}%`
}

export function deltaPct(now, prev) {
  if (prev === null || prev === undefined || prev === 0 || isNaN(prev)) return null
  if (now === null || now === undefined || isNaN(now)) return null
  const nNow = Number(now)
  const nPrev = Number(prev)
  const diff = ((nNow - nPrev) / nPrev) * 100
  return isNaN(diff) ? null : Number(diff.toFixed(1))
}

export function relativeTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '—'
  
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths}mo ago`
}

export function dateLabel(isoStr) {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  if (isNaN(date.getTime())) return String(isoStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
