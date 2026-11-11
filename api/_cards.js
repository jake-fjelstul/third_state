// Link-preview helpers for api/card.js (plan Part 4, Layer A). Pure functions
// so they can be unit tested; files starting with "_" are not Vercel routes.

export const SITE = 'https://third-space-app.com'
const DEFAULT_IMAGE = `${SITE}/og-icon.png`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE = /^[A-Za-z0-9_-]{3,64}$/

export function validId(type, id) {
  if (type === 'invite') return CODE.test(id || '')
  return UUID.test(id || '')
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const CATEGORY_LABEL = { study: 'Studying', food: 'Food & coffee', hang: 'Hanging out', active: 'Active' }

function whenLabel(iso, tz = 'America/New_York') {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz })
}

/** { title, description, image, large } for a card, or null for the default. */
export function describe(type, card) {
  if (!card) return null
  if (type === 'event') {
    const bits = [whenLabel(card.startsAt), card.location, card.circleName].filter(Boolean)
    const going = card.going > 0 ? ` · ${card.going} going` : ''
    return {
      title: card.title || 'An event on Third Space',
      description: `${bits.join(' · ')}${going}. RSVP on Third Space.`,
      image: card.coverImageUrl || DEFAULT_IMAGE,
      large: !!card.coverImageUrl,
    }
  }
  if (type === 'checkin') {
    if (!card.public) {
      return {
        title: 'A friend is out right now',
        description: 'Open Third Space to see where and pull up.',
        image: DEFAULT_IMAGE,
        large: false,
      }
    }
    const who = card.hostFirstName || 'Someone'
    const what = CATEGORY_LABEL[card.category] || 'Out'
    const more = card.people > 1 ? ` with ${card.people - 1} other${card.people > 2 ? 's' : ''}` : ''
    return {
      title: `${who} is at ${card.placeName || 'a spot nearby'}`,
      description: `${what}${more}. Pull up on Third Space.`,
      image: DEFAULT_IMAGE,
      large: false,
    }
  }
  if (type === 'poll') {
    const opts = (card.options || []).map(o => `${whenLabel(o.at)}${o.count ? ` (${o.count})` : ''}`)
    return {
      title: card.set ? `${card.title} is on` : `When works for ${card.title}?`,
      description: card.set
        ? `${card.hostFirstName || 'Someone'} picked a time${card.place ? ` at ${card.place}` : ''}. See it on Third Space.`
        : `${opts.join(' · ')}. Tap the times that work for you.`,
      image: DEFAULT_IMAGE,
      large: false,
    }
  }
  if (type === 'invite') {
    if (card.circle_name) {
      return {
        title: `Join ${card.circle_name} on Third Space`,
        description: card.inviter_name ? `${card.inviter_name.split(' ')[0]} invited you.` : 'You have an invite.',
        image: DEFAULT_IMAGE,
        large: false,
      }
    }
    return {
      title: card.inviter_name ? `${card.inviter_name.split(' ')[0]} invited you to Third Space` : 'You have an invite to Third Space',
      description: 'Find people who share your interests and meet up in person.',
      image: DEFAULT_IMAGE,
      large: false,
    }
  }
  return null
}

/** Put the card's tags into the app's index.html (all other markup untouched). */
export function injectMeta(html, info, url) {
  if (!info) return html
  const t = escapeHtml(info.title)
  const d = escapeHtml(info.description)
  const img = escapeHtml(info.image)
  const u = escapeHtml(url)
  const set = (re, tag) => (re.test(html) ? (html = html.replace(re, tag)) : (html = html.replace('</head>', `    ${tag}\n  </head>`)))
  set(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${d}" />`)
  set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${u}" />`)
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${t}" />`)
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${d}" />`)
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${u}" />`)
  set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${img}" />`)
  set(/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="${info.large ? 'summary_large_image' : 'summary'}" />`)
  set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${t}" />`)
  set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${d}" />`)
  set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${img}" />`)
  return html
}
