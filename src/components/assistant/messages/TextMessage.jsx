export default function TextMessage({ message, clr, muted }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: 18,
        background: isUser
          ? `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`
          : clr.white,
        color: isUser ? '#FFF' : (muted ? clr.textMid : clr.textDark),
        fontSize: 14, lineHeight: 1.4,
        fontStyle: muted ? 'italic' : 'normal',
        boxShadow: isUser ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {message.text}
      </div>
    </div>
  )
}
