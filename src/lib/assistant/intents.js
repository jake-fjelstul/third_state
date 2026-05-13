/**
 * Intent classifier for the Feed Assistant.
 * Pattern-based. Returns { intent, topic } or { intent: 'help' } if nothing matches.
 *
 * NOTE: This file is the SOLE point of intent recognition. When we add AI later,
 * `classifyIntent` will be replaced with an Anthropic Edge Function call returning
 * the same { intent, topic } shape. Handlers + UI stay identical.
 */

export const INTENTS = {
  FIND_PEOPLE:   'find_people',
  FIND_CIRCLES:  'find_circles',
  FIND_EVENTS:   'find_events',
  CREATE_EVENT:  'create_event',
  CREATE_CIRCLE: 'create_circle',
  NAVIGATE:      'navigate',
  HELP:          'help',
}

// Ordered: more specific patterns first.
const PATTERNS = [
  // CREATE first so "create event about coffee" doesn't match find_events.
  {
    intent: INTENTS.CREATE_EVENT,
    patterns: [
      /\b(create|host|hosting|make|set up|organize|plan|throw|start)( an?| my| a new| a)? (event|meetup|gathering|party|hangout|get-?together)\b/i,
      // "host a coffee meetup saturday" — verb + optional article + any word + meetup/event
      /\b(host|organize|plan|throw|create|make|start)\s+\w.*?\s+(meetup|event|gathering)\b/i,
      /\bi (want|need|wanna) to (host|organize|plan|throw)\b/i,
      /\bnew event\b/i,
    ],
  },
  {
    intent: INTENTS.CREATE_CIRCLE,
    patterns: [
      /\b(create|make|start|found|launch|build|begin)( an?| my| a new| a)? (circle|group|community|club)\b/i,
      // "create a yoga circle" / "start my photography group"
      /\b(create|make|start|found|launch|build)\s+\w.*?\s+(circle|group|community|club)\b/i,
      /\bnew (circle|group|community)\b/i,
    ],
  },
  {
    intent: INTENTS.FIND_EVENTS,
    patterns: [
      /\b(find|show|show me|browse|see|any|what'?s)( an?| some)? (event|meetup|happening|going on|to do)/i,
      /\b(events?|meetups?)\b/i,
      /\bthings? to do\b/i,
      /\bwhat'?s (going on|happening|on)\b/i,
      /\b(tonight|this weekend|tomorrow)\b/i,
    ],
  },
  {
    intent: INTENTS.FIND_CIRCLES,
    patterns: [
      /\b(find|join|browse|show me|see|discover)( an?| some| any)? (circle|group|community|club)/i,
      /\b(circles?|groups?|communities|clubs?)\b/i,
    ],
  },
  {
    intent: INTENTS.FIND_PEOPLE,
    patterns: [
      /\b(meet|find|connect with|introduce|see)(\s+(?:some|new|more|a few))*\s+(people|someone|friends|folks|peeps)\b/i,
      /\b(looking|searching) for (people|friends|someone|new connections)\b/i,
      /\b(make|making) (new )?friends\b/i,
      /\bpeople\b/i,
      /\bnetwork(ing)?\b/i,
    ],
  },
  {
    intent: INTENTS.HELP,
    patterns: [
      /\b(help|what can you do|how does this work|what'?s this|examples?)\b/i,
      /^\s*\?\s*$/,
    ],
  },
]

// Page-keyword map for the NAVIGATE fallback.
export const PAGE_KEYWORDS = [
  { path: '/profile',       label: 'Profile',       keywords: ['profile', 'bio', 'avatar', 'interests', 'my info', 'edit profile'] },
  { path: '/settings',      label: 'Settings',      keywords: ['settings', 'preferences', 'theme', 'dark mode', 'notification', 'privacy', 'radius'] },
  { path: '/notifications', label: 'Notifications', keywords: ['notification', 'alerts', 'nudge', 'inbox'] },
  { path: '/chat',          label: 'Chats',         keywords: ['chat', 'message', 'dm', 'inbox', 'conversation'] },
  { path: '/schedule',      label: 'Schedule',      keywords: ['schedule', 'calendar', 'agenda', 'my events', 'upcoming'] },
  { path: '/circles',       label: 'Circles',       keywords: ['my circles', 'all circles', 'browse circles'] },
]

export function classifyIntent(rawText) {
  const text = (rawText || '').trim()
  if (!text) return { intent: INTENTS.HELP, topic: null }

  for (const def of PATTERNS) {
    for (const pat of def.patterns) {
      if (pat.test(text)) {
        return { intent: def.intent, topic: extractTopic(text, def.intent) }
      }
    }
  }

  // No intent match — try NAVIGATE via page keywords
  const lower = text.toLowerCase()
  for (const p of PAGE_KEYWORDS) {
    if (p.keywords.some(k => lower.includes(k))) {
      return { intent: INTENTS.NAVIGATE, topic: p.path }
    }
  }

  return { intent: INTENTS.HELP, topic: null }
}

/**
 * Pull a topic out of phrases like:
 *   "find people who like hiking" -> "hiking"
 *   "circles about photography" -> "photography"
 *   "events tonight" -> "tonight"
 *   "create a yoga circle" -> "yoga"
 */
export function extractTopic(text, intent) {
  const t = text.trim()
  // Strip leading intent verbs/nouns
  const stripped = t
    .replace(/^(find|show me|show|browse|discover|see|meet|connect with|introduce|create|make|start|host|plan|organize|throw|set up|launch|build|join)\s+/i, '')
    .replace(/^(some |an? |the |my |new |more )+/i, '')
    .replace(/^(people|someone|friends|folks|circles?|groups?|communities|clubs?|events?|meetups?|hangouts?)\s+/i, '')
    .replace(/^(who |that |which |about |for |on |interested in |into |like |love |that love )/i, '')
    .replace(/^(i want to |i wanna |i need to |i would like to )/i, '')
    .trim()

  if (!stripped || stripped.length < 2) return null
  // Cap at ~60 chars so we don't pass huge strings to filters
  return stripped.slice(0, 60)
}
