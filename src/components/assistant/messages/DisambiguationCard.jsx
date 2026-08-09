export default function DisambiguationCard({ message, clr, onSelectCandidate }) {
  const { candidates } = message

  return (
    <div style={{
      backgroundColor: clr.white,
      borderRadius: 18,
      padding: 14,
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: clr.textDark }}>
        Multiple matches found:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectCandidate(c)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '10px 14px',
              borderRadius: 12,
              border: `1.5px solid ${clr.border}`,
              backgroundColor: clr.bg,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: clr.textDark }}>{c.title}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: clr.indigo, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {c.kind}
              </span>
            </div>
            {c.subtitle && (
              <span style={{ fontSize: 12, color: clr.textMid, marginTop: 2 }}>
                {c.subtitle}
              </span>
            )}
            {c.reason && (
              <span style={{ fontSize: 11, color: clr.textMid, opacity: 0.8, marginTop: 4, fontStyle: 'italic' }}>
                Reason: {c.reason}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
