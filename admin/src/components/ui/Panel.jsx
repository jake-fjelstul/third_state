export function Panel({ title, action, children, className = '' }) {
  return (
    <div className={`bg-panel border border-line rounded-xl p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
