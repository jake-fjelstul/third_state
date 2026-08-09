export function Loading({ className = 'h-32 w-full', count = 1 }) {
  return (
    <div className="space-y-4 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`bg-raised/60 animate-pulse rounded-xl ${className}`}
        />
      ))}
    </div>
  )
}
