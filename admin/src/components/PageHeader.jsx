import { RotateCw } from 'lucide-react'
import { PeriodToggle } from './ui/PeriodToggle'

export function PageHeader({
  title,
  period,
  onPeriodChange,
  onRefresh,
  loading = false,
  children,
}) {
  return (
    <header className="sticky top-0 z-20 bg-ink/80 backdrop-blur-md pb-6 pt-2 mb-6 flex items-center justify-between border-b border-line/40">
      <h1 className="font-display font-bold text-22px md:text-[22px] text-text">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        {children}
        {period !== undefined && onPeriodChange && (
          <PeriodToggle value={period} onChange={onPeriodChange} />
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 bg-panel border border-line rounded-lg text-muted hover:text-text hover:bg-raised transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo' : ''}`} />
          </button>
        )}
      </div>
    </header>
  )
}
