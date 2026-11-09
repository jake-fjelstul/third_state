// Content-shaped loading placeholders (issue 5): a header block and rows that
// look like the list that's coming, instead of "Loading…" text.
export function SkeletonBlock({ height = 16, width = '100%', radius = 8, style }) {
  return <div className="ts-skeleton" aria-hidden="true" style={{ height, width, borderRadius: radius, ...style }} />
}

export function SkeletonRows({ count = 5, avatar = 44 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {avatar > 0 && <SkeletonBlock height={avatar} width={avatar} radius={avatar / 2} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock height={14} width={`${60 - (i % 3) * 10}%`} />
            <SkeletonBlock height={12} width={`${40 + (i % 2) * 15}%`} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Full-page placeholder: optional cover, a title, then rows. */
export function PageSkeleton({ cover = false }) {
  return (
    <div role="status" aria-label="Loading" style={{ padding: cover ? 0 : '20px 20px' }}>
      {cover && <SkeletonBlock height={220} radius={0} />}
      <div style={{ padding: cover ? '20px' : 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SkeletonBlock height={28} width="55%" />
        <SkeletonBlock height={14} width="35%" />
        <SkeletonRows count={5} />
      </div>
    </div>
  )
}
