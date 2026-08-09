export function Chip({ label, tone = 'neutral', className = '' }) {
  const toneClasses = {
    neutral: 'text-muted bg-muted/12',
    indigo: 'text-indigo bg-indigo/12',
    mint: 'text-mint bg-mint/12',
    amber: 'text-amber bg-amber/12',
    rose: 'text-rose bg-rose/12',
  }

  const selectedTone = toneClasses[tone] || toneClasses.neutral

  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] font-medium uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap ${selectedTone} ${className}`}
    >
      {label}
    </span>
  )
}
