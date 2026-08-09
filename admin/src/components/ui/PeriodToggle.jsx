export function PeriodToggle({ value = 30, onChange }) {
  const periods = [7, 30, 90]

  return (
    <div className="inline-flex items-center bg-panel border border-line rounded-lg p-0.5">
      {periods.map((days) => {
        const isActive = value === days
        return (
          <button
            key={days}
            type="button"
            onClick={() => onChange && onChange(days)}
            className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-colors ${
              isActive
                ? 'bg-raised text-text shadow-xs'
                : 'text-faint hover:text-text'
            }`}
          >
            {days}D
          </button>
        )
      })}
    </div>
  )
}
