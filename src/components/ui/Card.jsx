export default function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-card border border-slate-100 bg-surface shadow-soft ${className}`}
    >
      {children}
    </div>
  )
}

