export default function HelpMessage({ clr }) {
  const items = [
    { icon: '👋', text: 'Find people: "people into hiking"' },
    { icon: '⭕', text: 'Find circles: "photography circles"' },
    { icon: '📅', text: 'Find events: "events this weekend"' },
    { icon: '✨', text: 'Create: "host a yoga meetup Saturday"' },
    { icon: '🗺️', text: 'Navigate: "open my schedule"' },
  ]
  return (
    <div style={{
      backgroundColor: clr.white, borderRadius: 18, padding: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: clr.textDark, fontWeight: 700 }}>
        Hey! I can help you find people, circles, events — or create new ones.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(i => (
          <div key={i.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{i.icon}</span>
            <span style={{ fontSize: 13, color: clr.textMid }}>{i.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
