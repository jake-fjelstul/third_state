import { describe, expect, it } from 'vitest'
import { describe as describeCard, injectMeta, validId, escapeHtml } from '../../../api/_cards.js'

const PAGE = `<html><head>
    <title>Third Space</title>
    <meta name="description" content="old" />
    <link rel="canonical" href="https://third-space-app.com/" />
    <meta property="og:title" content="old" />
    <meta property="og:description" content="old" />
    <meta property="og:url" content="https://third-space-app.com/" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="old" />
    <meta name="twitter:description" content="old" />
  </head><body><div id="root"></div></body></html>`

describe('smart-link previews', () => {
  it('only accepts real ids', () => {
    expect(validId('event', '061666d0-1274-44c6-a573-675339823679')).toBe(true)
    expect(validId('event', "x' or 1=1")).toBe(false)
    expect(validId('invite', 'AbC123')).toBe(true)
    expect(validId('invite', '<script>')).toBe(false)
  })

  it('describes an event and uses its cover as a large image', () => {
    const info = describeCard('event', {
      title: 'Sunset run', startsAt: '2026-11-12T22:00:00Z', location: 'Piedmont Park',
      circleName: 'Run Club', going: 4, coverImageUrl: 'https://x/c.jpg',
    })
    expect(info.title).toBe('Sunset run')
    expect(info.description).toMatch(/Piedmont Park · Run Club · 4 going/)
    expect(info).toMatchObject({ image: 'https://x/c.jpg', large: true })
  })

  it('keeps narrow check-ins vague', () => {
    const info = describeCard('checkin', { public: false })
    expect(info.title).toBe('A friend is out right now')
    expect(info.description).not.toMatch(/at /)
  })

  it('writes escaped tags into the page and adds missing ones', () => {
    const html = injectMeta(PAGE, { title: 'Tom & "Jerry" <3', description: 'd', image: 'https://i/x.png', large: false }, 'https://third-space-app.com/e/1')
    expect(html).toContain('<title>Tom &amp; &quot;Jerry&quot; &lt;3</title>')
    expect(html).toContain('<meta property="og:image" content="https://i/x.png" />')
    expect(html).toContain('<meta property="og:url" content="https://third-space-app.com/e/1" />')
    expect(html).toContain('<div id="root"></div>')
    expect(escapeHtml('<a>')).toBe('&lt;a&gt;')
  })

  it('leaves the page alone when there is no card', () => {
    expect(injectMeta(PAGE, null, 'x')).toBe(PAGE)
  })
})

describe('time poll previews', () => {
  it('lists the times while voting and says it is on once set', () => {
    const open = describeCard('poll', { title: 'Climbing', options: [{ at: '2026-11-14T22:00:00Z', count: 2 }, { at: '2026-11-15T18:00:00Z', count: 0 }] })
    expect(open.title).toBe('When works for Climbing?')
    expect(open.description).toMatch(/\(2\).*Tap the times/)
    const set = describeCard('poll', { title: 'Climbing', set: true, hostFirstName: 'Jake', place: 'Stone Summit' })
    expect(set.title).toBe('Climbing is on')
    expect(set.description).toMatch(/Jake picked a time at Stone Summit/)
  })
})
