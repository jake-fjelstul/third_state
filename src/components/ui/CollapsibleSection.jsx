import { useState } from 'react'

// Design v2: a small gray group label (iOS grouped style) that also collapses.
export default function CollapsibleSection({ title, defaultOpen = true, titleFontSize, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          padding: '0 16px',
          marginBottom: 8,
          minHeight: 32,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <h2 style={titleFontSize
          ? { fontSize: titleFontSize, fontWeight: 700, color: 'var(--textDark)', margin: 0, letterSpacing: '-0.01em' }
          : { fontSize: 13, fontWeight: 600, color: 'var(--textMid)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </h2>
        <svg
          width="16"
          height="16"
          fill="none"
          stroke="var(--textLight)"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div style={{ display: isOpen ? 'block' : 'none' }}>
        {children}
      </div>
    </div>
  )
}
