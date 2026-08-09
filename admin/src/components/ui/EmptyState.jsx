export function EmptyState({ message, heading = 'Nothing here yet', body }) {
  const displayMessage = message || body || 'No data to show.'

  return (
    <div className="py-12 px-4 text-center max-w-md mx-auto space-y-2">
      <h4 className="font-display font-bold text-[15px] text-text">
        {heading}
      </h4>
      <p className="font-body text-[13px] text-muted leading-relaxed">
        {displayMessage}
      </p>
    </div>
  )
}
