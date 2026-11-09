export default function TextMessage({ message, clr, muted }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: 18,
        background: isUser
          ? `var(--indigo)`
          : clr.white,
        color: isUser ? '#FFF' : (muted ? clr.textMid : clr.textDark),
        fontSize: 14, lineHeight: 1.4,
        fontStyle: muted ? 'italic' : 'normal',
        boxShadow: isUser ? 'none' : '0 0 0 1px var(--border)',
      }}>
        {message.text}
        {message.alternative && (
          <div style={{
            marginTop: 6,
            padding: '4px 10px',
            borderRadius: 999,
            backgroundColor: clr.indigoLt,
            color: clr.indigo,
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-block'
          }}>
            {message.alternative}
          </div>
        )}
      </div>
    </div>
  )
}
