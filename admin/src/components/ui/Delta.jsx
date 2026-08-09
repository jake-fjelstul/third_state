import { deltaPct } from '../../lib/format'

export function Delta({ now, prev }) {
  const pctValue = deltaPct(now, prev)

  if (pctValue === null || pctValue === undefined) {
    return <span className="font-mono text-[11px] font-medium text-faint">—</span>
  }

  if (pctValue > 0) {
    return (
      <span className="font-mono text-[11px] font-medium text-mint flex items-center gap-0.5">
        <span>↑</span>
        <span>+{pctValue.toFixed(1)}%</span>
      </span>
    )
  }

  if (pctValue < 0) {
    return (
      <span className="font-mono text-[11px] font-medium text-rose flex items-center gap-0.5">
        <span>↓</span>
        <span>−{Math.abs(pctValue).toFixed(1)}%</span>
      </span>
    )
  }

  return <span className="font-mono text-[11px] font-medium text-faint">0.0%</span>
}
