const FIELDS = [
  { key: 'interests', label: 'Pick 2+ interests', test: (p) => (p?.interests?.length ?? 0) >= 2 },
  { key: 'intents', label: "Add what you're looking for", test: (p) => (p?.intents?.length ?? 0) >= 1 },
  { key: 'city', label: 'Add your city', test: (p) => !!p?.city?.trim() },
  { key: 'bio', label: 'Write a short bio', test: (p) => !!p?.bio?.trim() },
  { key: 'avatar', label: 'Upload a photo', test: (p) => !!p?.avatar?.trim() },
]

export function profileCompleteness(profile) {
  const results = FIELDS.map((f) => ({ ...f, complete: f.test(profile) }))
  const score = results.filter((r) => r.complete).length
  const max = FIELDS.length
  return {
    score,
    max,
    percent: Math.round((score / max) * 100),
    isComplete: score === max,
    missing: results.filter((r) => !r.complete).map(({ key, label }) => ({ key, label })),
  }
}

export function ProfileProgressRing({ percent, size = 48 }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(100, Math.max(0, percent))
  const offset = c * (1 - p / 100)
  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--indigo)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={Math.max(10, Math.round(size * 0.22))}
        fontWeight={800}
        fill="var(--textDark)"
      >
        {percent}%
      </text>
    </svg>
  )
}
