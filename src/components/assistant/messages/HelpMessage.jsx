import { UserPlus, Circle, Calendar, Sparkles, Compass } from 'lucide-react'

export default function HelpMessage({ clr }) {
  const items = [
    { Icon: UserPlus, text: 'Find people: "people into hiking"' },
    { Icon: Circle, text: 'Find circles: "photography circles"' },
    { Icon: Calendar, text: 'Find events: "events this weekend"' },
    { Icon: Sparkles, text: 'Create: "host a yoga meetup Saturday"' },
    { Icon: Compass, text: 'Navigate: "open my schedule"' },
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
        {items.map(({ Icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={16} color={clr.indigo} />
            <span style={{ fontSize: 13, color: clr.textMid }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
