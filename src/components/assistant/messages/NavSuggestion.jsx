import { useNavigate } from 'react-router-dom'

export default function NavSuggestion({ message, clr, onClose }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => { onClose(); navigate(message.payload.path) }}
      style={{
        textAlign: 'left',
        padding: '14px 16px', borderRadius: 16,
        backgroundColor: clr.white,
        border: `1.5px solid ${clr.border}`,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        width: '100%',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 13, color: clr.textMid }}>{message.text}</p>
        <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: clr.indigo }}>
          {message.payload.label} →
        </p>
      </div>
      <svg width="20" height="20" fill="none" stroke={clr.indigo} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
