export default function PillTag({ children, tone = 'neutral', className = '' }) {
  const toneClasses =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : tone === 'soft'
        ? 'bg-primary-soft text-primary'
        : 'bg-slate-100 text-slate-600'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${toneClasses} ${className}`}
    >
      {children}
    </span>
  )
}

