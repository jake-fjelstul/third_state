export function Bar({ value = 0, max = 100, tone = 'indigo', className = '' }) {
  const toneClasses = {
    indigo: 'bg-indigo',
    mint: 'bg-mint',
    amber: 'bg-amber',
    rose: 'bg-rose',
    neutral: 'bg-muted',
  }

  const fillClass = toneClasses[tone] || toneClasses.indigo
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div className={`h-[6px] w-full bg-raised rounded-full overflow-hidden ${className}`}>
      {pct > 0 && (
        <div
          className={`h-full rounded-full transition-all duration-500 ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  )
}
