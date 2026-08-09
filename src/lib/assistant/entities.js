/**
 * Universal Entity Index and Resolver for Feed Assistant.
 * Fully deterministic ranking, scoring, tie-breaking, and reasoning.
 */

import { PAGE_KEYWORDS } from './intents.js'

export function levenshteinDistance(a = '', b = '') {
  const strA = (a || '').toLowerCase()
  const strB = (b || '').toLowerCase()
  if (strA === strB) return 0
  if (!strA) return strB.length
  if (!strB) return strA.length

  const row = new Array(strB.length + 1)
  for (let j = 0; j <= strB.length; j++) row[j] = j

  for (let i = 1; i <= strA.length; i++) {
    let prev = i
    for (let j = 1; j <= strB.length; j++) {
      const val = strA[i - 1] === strB[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1
      row[j - 1] = prev
      prev = val
    }
    row[strB.length] = prev
  }

  return row[strB.length]
}

export function buildIndex(ctx = {}) {
  const index = []

  // 1. People (Connections and Discoverable Profiles)
  const peopleList = ctx.profiles || ctx.people || ctx.allProfiles || []
  const connections = ctx.connections || []
  const connectedUserIds = new Set(connections.map(c => typeof c === 'string' ? c : (c.id || c.peer_id || c.user_id)))

  peopleList.forEach(p => {
    if (!p || !p.id) return
    if (ctx.currentUser && p.id === ctx.currentUser.id) return // skip self
    const isConnected = connectedUserIds.has(p.id)
    index.push({
      kind: 'person',
      id: String(p.id),
      title: p.name || p.username || 'Anonymous',
      subtitle: p.bio || p.city || p.interests?.join(', ') || '',
      keywords: [...(p.interests || []), p.city, p.username].filter(Boolean),
      path: `/profile/${p.id}`,
      data: p,
      isUserBelongs: isConnected,
      relationship: isConnected ? "your connection" : null
    })
  })

  // 2. Circles (Joined and Public)
  const circlesList = ctx.circles || ctx.allCircles || []
  const joinedIds = new Set((ctx.joinedCircles || []).map(id => String(id)))

  circlesList.forEach(c => {
    if (!c || !c.id) return
    const isJoined = joinedIds.has(String(c.id))
    index.push({
      kind: 'circle',
      id: String(c.id),
      title: c.name || 'Unnamed Circle',
      subtitle: c.description || c.category || c.vibe || '',
      keywords: [c.category, c.vibe, c.interestTag, ...(c.tags || [])].filter(Boolean),
      path: `/circles/${c.id}`,
      data: c,
      isUserBelongs: isJoined,
      relationship: isJoined ? "you're in this circle" : null
    })
  })

  // 3. Events
  const eventsList = ctx.meetups || ctx.events || ctx.allEvents || []
  const rsvpdIds = new Set(ctx.rsvpdEventIds ? Array.from(ctx.rsvpdEventIds).map(String) : [])

  eventsList.forEach(e => {
    if (!e || !e.id) return
    const isAttending = rsvpdIds.has(String(e.id))
    index.push({
      kind: 'event',
      id: String(e.id),
      title: e.title || 'Untitled Event',
      subtitle: `${e.date || ''} ${e.time || ''} · ${e.location || e.circleName || ''}`.trim(),
      keywords: [e.circleName, e.location, e.category].filter(Boolean),
      path: `/events/${e.id}`,
      data: e,
      isUserBelongs: isAttending,
      relationship: isAttending ? "you're attending" : null
    })
  })

  // 4. Chats / Channels
  const chatState = ctx.chatState || {}
  Object.values(chatState).forEach(chat => {
    if (!chat || !chat.id) return
    index.push({
      kind: 'chat',
      id: String(chat.id),
      title: chat.name || 'Chat',
      subtitle: chat.lastMessage || 'Direct message',
      keywords: ['chat', 'message', 'dm', chat.type].filter(Boolean),
      path: `/chat/${chat.id}`,
      data: chat,
      isUserBelongs: true,
      relationship: "active chat"
    })
  })

  // 5. Pages
  PAGE_KEYWORDS.forEach(p => {
    index.push({
      kind: 'page',
      id: `page_${p.path}`,
      title: p.label,
      subtitle: `App section: ${p.label}`,
      keywords: p.keywords || [],
      path: p.path,
      data: p,
      isUserBelongs: false,
      relationship: null
    })
  })

  // 6. Games & Interactive
  const games = [
    { id: 'chess', title: 'Chess Game', keywords: ['chess', 'game', 'play chess', 'board game'], path: '/chat' },
    { id: 'trivia', title: 'Trivia Game', keywords: ['trivia', 'quiz', 'game'], path: '/chat' },
    { id: 'daily_question', title: 'Daily Question', keywords: ['daily question', 'icebreaker', 'question'], path: '/feed' }
  ]
  games.forEach(g => {
    index.push({
      kind: 'game',
      id: g.id,
      title: g.title,
      subtitle: 'In-app interactive feature',
      keywords: g.keywords,
      path: g.path,
      data: g,
      isUserBelongs: false,
      relationship: null
    })
  })

  // 7. Settings Sections
  const settings = [
    { id: 'theme', title: 'Dark Mode & Theme', keywords: ['dark mode', 'theme', 'appearance', 'light mode'], path: '/settings' },
    { id: 'radius', title: 'Search Radius', keywords: ['radius', 'distance', 'location radius', 'search radius'], path: '/settings' },
    { id: 'privacy', title: 'Privacy Settings', keywords: ['privacy', 'incognito', 'visibility', 'blocked'], path: '/settings' },
    { id: 'notifications', title: 'Notification Preferences', keywords: ['notifications', 'alerts', 'push'], path: '/settings' }
  ]
  settings.forEach(s => {
    index.push({
      kind: 'setting',
      id: `setting_${s.id}`,
      title: s.title,
      subtitle: 'Settings section',
      keywords: s.keywords,
      path: s.path,
      data: s,
      isUserBelongs: false,
      relationship: null
    })
  })

  return index
}

export function resolve(queryText = '', index = [], options = {}) {
  const query = (queryText || '').trim().toLowerCase()
  if (!query) return []

  const targetKinds = options.kinds ? new Set(options.kinds) : null
  const strictKinds = options.strictKinds !== false && targetKinds !== null
  const limit = options.limit || 10

  const queryTokens = query.split(/\s+/).filter(Boolean)

  const candidates = []

  for (const item of index) {
    if (strictKinds && !targetKinds.has(item.kind)) continue
    let score = 0
    const reasons = []

    const itemTitle = (item.title || '').toLowerCase()
    const itemSub = (item.subtitle || '').toLowerCase()
    const itemKeywords = (item.keywords || []).map(k => (k || '').toLowerCase())

    // 1. Exact title match: 100
    if (itemTitle === query) {
      score += 100
      reasons.push("exact name match")
    }
    // 2. Title starts with query: 60
    else if (itemTitle.startsWith(query)) {
      score += 60
      reasons.push("starts with query")
    }

    // 3. Query is a whole word inside title: 40
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegExp(query)}\\b`, 'i')
    if (itemTitle !== query && wordBoundaryRegex.test(itemTitle)) {
      score += 40
      reasons.push("word in title")
    }

    // 4. All query tokens present in title: 30
    if (queryTokens.length > 1 && queryTokens.every(tok => itemTitle.includes(tok))) {
      score += 30
      reasons.push("all tokens in title")
    }

    // 5. Keyword exact match: 25
    if (itemKeywords.some(k => k === query || queryTokens.includes(k))) {
      score += 25
      reasons.push("keyword match")
    }

    // 6. Subtitle contains query: 15
    if (itemSub.includes(query)) {
      score += 15
      reasons.push("subtitle match")
    }

    // 7. Fuzzy title match: 10
    if (itemTitle.length >= 5 && query.length >= 5) {
      const dist = levenshteinDistance(query, itemTitle)
      if (dist > 0 && dist <= 2) {
        score += 10
        reasons.push("fuzzy name match")
      }
    }

    // If no score was accrued from text matching, skip
    if (score === 0) continue

    // 8. Kind matches classified intent: +20
    if (targetKinds && targetKinds.has(item.kind)) {
      score += 20
      reasons.push(`matches ${item.kind} intent`)
    }

    // 9. Entity user belongs to / connected: +10
    if (item.isUserBelongs) {
      score += 10
      if (item.relationship) {
        reasons.push(item.relationship)
      } else {
        reasons.push("connected item")
      }
    }

    candidates.push({
      ...item,
      score,
      reason: reasons.join(', ') || 'matched query'
    })
  }

  // Pure, deterministic sorting: score desc -> title asc -> id asc
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    const titleCmp = (a.title || '').localeCompare(b.title || '')
    if (titleCmp !== 0) return titleCmp
    return (a.id || '').localeCompare(b.id || '')
  })

  return candidates.slice(0, limit)
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
