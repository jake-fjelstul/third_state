export function Stat({ label, value, delta, className = '' }) {
  return (
    <div className={`bg-panel border border-line rounded-xl p-5 ${className}`}>
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint mb-2">
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display font-bold text-26px md:text-[26px] tracking-tight text-text leading-none">
          {value}
        </div>
        {delta && <div>{delta}</div>}
      </div>
    </div>
  )
}
