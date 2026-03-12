export default function SectionHeader({
  title,
  subtitle,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-2 ${className}`}
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="text-xs text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
      {action ? <div className="text-xs text-slate-400">{action}</div> : null}
    </div>
  )
}

