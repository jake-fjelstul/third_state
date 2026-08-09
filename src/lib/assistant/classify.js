/**
 * Scored, additive Intent Classifier for Feed Assistant.
 * Replaces first-match-wins with deterministic weighted signal scoring.
 */

import { PAGE_KEYWORDS } from './intents.js'

export const INTENT_TYPES = {
  FIND_PEOPLE:   'find_people',
  FIND_CIRCLES:  'find_circles',
  FIND_EVENTS:   'find_events',
  CREATE_EVENT:  'create_event',
  CREATE_CIRCLE: 'create_circle',
  START_DM:      'start_dm',
  CONNECT_PERSON:'connect_person',
  JOIN_CIRCLE:   'join_circle',
  RSVP_EVENT:    'rsvp_event',
  NAVIGATE:      'navigate',
  HELP:          'help',
}

export function classify(text = '', slots = {}, entityCandidates = []) {
  const t = (text || '').trim().toLowerCase()
  if (!t || t === '?') {
    return {
      intent: INTENT_TYPES.HELP,
      confidence: 1.0,
      scores: { [INTENT_TYPES.HELP]: 100 },
      matchedSignals: ['empty query or question mark']
    }
  }

  const scores = {
    [INTENT_TYPES.FIND_PEOPLE]: 0,
    [INTENT_TYPES.FIND_CIRCLES]: 0,
    [INTENT_TYPES.FIND_EVENTS]: 0,
    [INTENT_TYPES.CREATE_EVENT]: 0,
    [INTENT_TYPES.CREATE_CIRCLE]: 0,
    [INTENT_TYPES.START_DM]: 0,
    [INTENT_TYPES.CONNECT_PERSON]: 0,
    [INTENT_TYPES.JOIN_CIRCLE]: 0,
    [INTENT_TYPES.RSVP_EVENT]: 0,
    [INTENT_TYPES.NAVIGATE]: 0,
    [INTENT_TYPES.HELP]: 0,
  }

  const matchedSignals = []

  // --- Signal 1: Verb Match (Weight 30) ---
  if (/\b(create|host|hosting|make|set up|organize|plan|throw)\b/i.test(t)) {
    if (/\b(event|meetup|gathering|party|hangout)\b/i.test(t)) {
      scores[INTENT_TYPES.CREATE_EVENT] += 30
      matchedSignals.push('verb: create event (+30)')
    } else if (/\b(circle|group|community|club)\b/i.test(t)) {
      scores[INTENT_TYPES.CREATE_CIRCLE] += 30
      matchedSignals.push('verb: create circle (+30)')
    } else {
      scores[INTENT_TYPES.CREATE_EVENT] += 15
      scores[INTENT_TYPES.CREATE_CIRCLE] += 15
    }
  }

  if (/\b(message|text|dm|chat with|send message|write to)\b/i.test(t)) {
    scores[INTENT_TYPES.START_DM] += 30
    matchedSignals.push('verb: start dm (+30)')
  }

  if (/\b(connect with|introduce me to|add friend|connect me to)\b/i.test(t)) {
    scores[INTENT_TYPES.CONNECT_PERSON] += 30
    matchedSignals.push('verb: connect person (+30)')
  }

  if (/\b(rsvp|going to|attend|sign up for event)\b/i.test(t)) {
    scores[INTENT_TYPES.RSVP_EVENT] += 30
    matchedSignals.push('verb: rsvp event (+30)')
  }

  if (/\b(join|sign up for circle)\b/i.test(t) && !/\b(meetup|event)\b/i.test(t)) {
    scores[INTENT_TYPES.JOIN_CIRCLE] += 30
    matchedSignals.push('verb: join circle (+30)')
  }

  if (/\b(find|show|browse|discover|see|meet|looking for|search|is anyone|who likes|who are|any)\b/i.test(t)) {
    if (/\b(people|someone|friends|folks|peeps|who)\b/i.test(t)) {
      scores[INTENT_TYPES.FIND_PEOPLE] += 30
      matchedSignals.push('verb: find people (+30)')
    }
    if (/\b(circles?|groups?|communities|clubs?)\b/i.test(t)) {
      scores[INTENT_TYPES.FIND_CIRCLES] += 30
      matchedSignals.push('verb: find circles (+30)')
    }
    if (/\b(events?|meetups?|happening|going on|to do)\b/i.test(t)) {
      scores[INTENT_TYPES.FIND_EVENTS] += 30
      matchedSignals.push('verb: find events (+30)')
    }
  }

  if (/\b(go to|open|take me to|navigate to|view|show me page)\b/i.test(t)) {
    scores[INTENT_TYPES.NAVIGATE] += 30
    matchedSignals.push('verb: navigate (+30)')
  }

  if (/\b(help|what can you do|how does this work|examples)\b/i.test(t)) {
    scores[INTENT_TYPES.HELP] += 30
    matchedSignals.push('verb: help (+30)')
  }

  // --- Signal 2: Object-Noun Match (Weight 25) ---
  if (/\b(events?|meetups?|gathering|party|hangout|chess event)\b/i.test(t)) {
    scores[INTENT_TYPES.FIND_EVENTS] += 25
    if (scores[INTENT_TYPES.CREATE_EVENT] > 0) scores[INTENT_TYPES.CREATE_EVENT] += 15
    matchedSignals.push('noun: event (+25)')
  }

  if (/\b(circles?|groups?|communities|clubs?)\b/i.test(t)) {
    scores[INTENT_TYPES.FIND_CIRCLES] += 25
    if (scores[INTENT_TYPES.CREATE_CIRCLE] > 0) scores[INTENT_TYPES.CREATE_CIRCLE] += 15
    matchedSignals.push('noun: circle (+25)')
  }

  // Bare "people" noun gives weight, but does not override event object if event object is present
  if (/\b(people|friends|someone|folks|peeps)\b/i.test(t) && !/\b(going to the|attending the|in the event|at the meetup)\b/i.test(t)) {
    scores[INTENT_TYPES.FIND_PEOPLE] += 20
    matchedSignals.push('noun: people (+20)')
  }

  // --- Signal 3: Slot Presence (Weight 20) ---
  if (slots.person?.name) {
    scores[INTENT_TYPES.START_DM] += 20
    scores[INTENT_TYPES.CONNECT_PERSON] += 20
    scores[INTENT_TYPES.FIND_PEOPLE] += 15
    matchedSignals.push('slot: person present (+20)')
  }

  if (slots.time?.kind && slots.time.kind !== 'none') {
    scores[INTENT_TYPES.FIND_EVENTS] += 20
    matchedSignals.push('slot: time present (+20)')
  }

  if (slots.circle?.name) {
    scores[INTENT_TYPES.FIND_CIRCLES] += 20
    scores[INTENT_TYPES.JOIN_CIRCLE] += 15
    matchedSignals.push('slot: circle present (+20)')
  }

  if (slots.distance?.miles != null) {
    scores[INTENT_TYPES.FIND_EVENTS] += 15
    scores[INTENT_TYPES.FIND_PEOPLE] += 15
    matchedSignals.push('slot: distance present (+15)')
  }

  // --- Signal 4: Entity Kind Match from Index Lookup (Weight 25) ---
  if (entityCandidates.length > 0) {
    const topKind = entityCandidates[0].kind
    if (topKind === 'event') {
      scores[INTENT_TYPES.FIND_EVENTS] += 25
      matchedSignals.push('entity: top event match (+25)')
    } else if (topKind === 'person') {
      if (scores[INTENT_TYPES.START_DM] > 0 || scores[INTENT_TYPES.CONNECT_PERSON] > 0) {
        scores[INTENT_TYPES.START_DM] += 25
      } else {
        scores[INTENT_TYPES.FIND_PEOPLE] += 25
      }
      matchedSignals.push('entity: top person match (+25)')
    } else if (topKind === 'circle') {
      scores[INTENT_TYPES.FIND_CIRCLES] += 25
      matchedSignals.push('entity: top circle match (+25)')
    } else if (topKind === 'page' || topKind === 'setting' || topKind === 'game') {
      scores[INTENT_TYPES.NAVIGATE] += 25
      matchedSignals.push('entity: top page/setting match (+25)')
    }
  }

  // --- Signal 5: Page-Keyword Match (Weight 15) ---
  for (const pageDef of PAGE_KEYWORDS) {
    if (pageDef.keywords.some(k => t.includes(k))) {
      scores[INTENT_TYPES.NAVIGATE] += 15
      matchedSignals.push(`page-keyword: ${pageDef.label} (+15)`)
      break
    }
  }

  // Rank intents deterministically
  const rankedIntents = Object.entries(scores)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0]) // alphabetical tie-breaker
    })

  const topIntent = rankedIntents[0]
  const secondIntent = rankedIntents[1]

  const topScore = topIntent[1]
  const secondScore = secondIntent[1]

  let confidence = 0
  if (topScore > 0) {
    confidence = topScore / (topScore + Math.max(1, secondScore))
    confidence = Math.round(confidence * 100) / 100
  } else {
    // If no signals matched at all, default to HELP with low confidence
    return {
      intent: INTENT_TYPES.HELP,
      confidence: 0.1,
      scores,
      matchedSignals: ['no signals matched']
    }
  }

  return {
    intent: topIntent[0],
    alternativeIntent: confidence >= 0.4 && confidence < 0.65 && secondScore > 0 ? secondIntent[0] : null,
    confidence,
    scores,
    matchedSignals
  }
}
