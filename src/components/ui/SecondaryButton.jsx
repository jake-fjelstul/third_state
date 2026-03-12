export default function SecondaryButton({
  children,
  onClick,
  type = 'button',
  fullWidth = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-primary/60 hover:text-primary ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      {children}
    </button>
  )
}

