export default function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  fullWidth = false,
  size = 'md',
}) {
  const sizeClasses =
    size === 'sm'
      ? 'px-6 py-2 text-[11px]'
      : size === 'lg'
        ? 'px-10 py-3 text-xs'
        : 'px-8 py-2.5 text-xs'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full bg-primary text-white font-semibold shadow-lg shadow-primary/20 transition-transform duration-150 hover:bg-[#5558e8] hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none ${
        fullWidth ? 'w-full' : 'min-w-[140px]'
      } ${sizeClasses}`}
    >
      {children}
    </button>
  )
}

