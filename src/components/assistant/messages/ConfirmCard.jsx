export default function ConfirmCard({ clr, title, subtitle, primaryLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <div style={{
      backgroundColor: clr.white, borderRadius: 18, padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: clr.textDark }}>{title}</p>
      {subtitle && (
        <p style={{ margin: '0 0 14px', fontSize: 13, color: clr.textMid }}>{subtitle}</p>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onCancel} style={{
          flex: 1, padding: 12, borderRadius: 999,
          border: `1.5px solid ${clr.border}`, backgroundColor: clr.white,
          color: clr.textMid, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} style={{
          flex: 2, padding: 12, borderRadius: 999, border: 'none',
          background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
          color: '#FFF', fontSize: 14, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
        }}>
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}
