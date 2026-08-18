import { useState } from 'react'

export default function CollapsibleSection({ title, defaultOpen = true, titleFontSize = 18, children }) {
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
          padding: '0 4px',
          marginBottom: 12,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <h2 style={{ fontSize: titleFontSize, fontWeight: 700, color: 'var(--textDark)', margin: 0 }}>
          {title}
        </h2>
        <svg
          width="18"
          height="18"
          fill="none"
          stroke="var(--textDark)"
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
