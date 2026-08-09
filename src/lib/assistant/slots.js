/**
 * Pure slot extractor for the Feed Assistant.
 * All functions are pure and depend ONLY on text and explicitly passed `now`.
 */

export function parseSlots(rawText = '', nowParam = new Date(), options = {}) {
  const text = (rawText || '').trim()
  const now = nowParam instanceof Date ? new Date(nowParam.getTime()) : new Date(nowParam)
  const defaultRadius = options.userRadius || options.searchRadius || 10
  const availableCategories = options.categories || [
    'sports', 'fitness', 'tech', 'technology', 'social', 'gaming', 'games',
    'arts', 'culture', 'music', 'food', 'drink', 'outdoors', 'wellness',
    'reading', 'books', 'career', 'hobbies'
  ]

  let workingText = text

  // 1. Time Slot
  const time = extractTime(workingText, now)
  if (time.rawText) {
    workingText = removeSubstring(workingText, time.rawText)
  }

  // 2. Distance Slot
  const distance = extractDistance(workingText, defaultRadius)
  if (distance.rawText) {
    workingText = removeSubstring(workingText, distance.rawText)
  }

  // 3. Negations
  const negations = extractNegations(workingText)
  if (negations && negations.length > 0) {
    negations.forEach(n => {
      if (n.rawText) workingText = removeSubstring(workingText, n.rawText)
    })
  }

  // 4. Circle Slot
  const circle = extractCircle(workingText)
  if (circle.rawText) {
    workingText = removeSubstring(workingText, circle.rawText)
  }

  // 5. Person Slot
  const person = extractPerson(workingText)
  if (person.rawText) {
    workingText = removeSubstring(workingText, person.rawText)
  }

  // 6. Category Slot
  const category = extractCategory(workingText, availableCategories)
  if (category.rawText) {
    workingText = removeSubstring(workingText, category.rawText)
  }

  // 7. Topic Slot (Residual text)
  const topic = extractResidualTopic(workingText)

  return {
    time,
    distance,
    person,
    circle,
    category,
    topic,
    negations: negations || []
  }
}

function removeSubstring(text, sub) {
  if (!sub) return text
  // Replace the substring with whitespace to avoid gluing adjacent words together
  return text.replace(sub, ' ').replace(/\s+/g, ' ').trim()
}

export function extractTime(text, now) {
  const lower = text.toLowerCase()

  // helper to clone and set time
  const startOfDay = (d) => {
    const res = new Date(d.getTime())
    res.setHours(0, 0, 0, 0)
    return res
  }
  const endOfDay = (d) => {
    const res = new Date(d.getTime())
    res.setHours(23, 59, 59, 999)
    return res
  }

  // 'tonight'
  const tonightMatch = lower.match(/\b(tonight|this evening)\b/i)
  if (tonightMatch) {
    const from = new Date(now.getTime())
    from.setHours(18, 0, 0, 0)
    const to = endOfDay(now)
    return {
      kind: 'range',
      from: from.toISOString(),
      to: to.toISOString(),
      label: tonightMatch[1].toLowerCase(),
      rawText: tonightMatch[0]
    }
  }

  // 'today'
  const todayMatch = lower.match(/\b(today)\b/i)
  if (todayMatch) {
    const from = startOfDay(now)
    const to = endOfDay(now)
    return {
      kind: 'day',
      from: from.toISOString(),
      to: to.toISOString(),
      label: 'today',
      rawText: todayMatch[0]
    }
  }

  // 'tomorrow'
  const tomorrowMatch = lower.match(/\b(tomorrow)\b/i)
  if (tomorrowMatch) {
    const tom = new Date(now.getTime())
    tom.setDate(tom.getDate() + 1)
    const from = startOfDay(tom)
    const to = endOfDay(tom)
    return {
      kind: 'day',
      from: from.toISOString(),
      to: to.toISOString(),
      label: 'tomorrow',
      rawText: tomorrowMatch[0]
    }
  }

  // 'this weekend' / 'weekend'
  const weekendMatch = lower.match(/\b(this weekend|weekend)\b/i)
  if (weekendMatch) {
    const dayOfWeek = now.getDay() // 0 = Sun, 6 = Sat
    const satOffset = (6 - dayOfWeek + 7) % 7
    const sat = new Date(now.getTime())
    sat.setDate(sat.getDate() + satOffset)

    const sun = new Date(sat.getTime())
    sun.setDate(sun.getDate() + 1)

    const from = startOfDay(sat)
    const to = endOfDay(sun)
    return {
      kind: 'range',
      from: from.toISOString(),
      to: to.toISOString(),
      label: 'this weekend',
      rawText: weekendMatch[0]
    }
  }

  // 'next week'
  const nextWeekMatch = lower.match(/\b(next week)\b/i)
  if (nextWeekMatch) {
    const dayOfWeek = now.getDay()
    const daysUntilNextMon = ((8 - dayOfWeek) % 7) || 7
    const mon = new Date(now.getTime())
    mon.setDate(mon.getDate() + daysUntilNextMon)

    const sun = new Date(mon.getTime())
    sun.setDate(sun.getDate() + 6)

    return {
      kind: 'range',
      from: startOfDay(mon).toISOString(),
      to: endOfDay(sun).toISOString(),
      label: 'next week',
      rawText: nextWeekMatch[0]
    }
  }

  // 'this month'
  const thisMonthMatch = lower.match(/\b(this month)\b/i)
  if (thisMonthMatch) {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      kind: 'range',
      from: startOfDay(firstDay).toISOString(),
      to: endOfDay(lastDay).toISOString(),
      label: 'this month',
      rawText: thisMonthMatch[0]
    }
  }

  // Weekdays: 'monday', 'next friday', 'this friday', etc.
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const weekdayMatch = lower.match(/\b(this\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)
  if (weekdayMatch) {
    const prefix = (weekdayMatch[1] || '').trim().toLowerCase()
    const dayName = weekdayMatch[2].toLowerCase()
    const targetDayIndex = days.indexOf(dayName)

    let currentDayIndex = now.getDay()
    let diff = (targetDayIndex - currentDayIndex + 7) % 7
    if (diff === 0 && prefix === 'next') {
      diff = 7
    } else if (diff === 0 && !prefix) {
      // e.g. "friday" on Friday -> today
      diff = 0
    } else if (diff !== 0 && prefix === 'next') {
      diff += 7
    }

    const targetDate = new Date(now.getTime())
    targetDate.setDate(targetDate.getDate() + diff)

    return {
      kind: 'day',
      from: startOfDay(targetDate).toISOString(),
      to: endOfDay(targetDate).toISOString(),
      label: weekdayMatch[0].toLowerCase(),
      rawText: weekdayMatch[0]
    }
  }

  return { kind: 'none', from: null, to: null, label: null, rawText: null }
}

export function extractDistance(text, userRadius = 10) {
  const lower = text.toLowerCase()

  // 'walking distance' -> 1 mile
  const walkingMatch = lower.match(/\b(walking distance)\b/i)
  if (walkingMatch) {
    return { miles: 1, rawText: walkingMatch[0] }
  }

  // 'near me' / 'nearby'
  const nearMatch = lower.match(/\b(near me|nearby|close to me|in my area)\b/i)
  if (nearMatch) {
    return { miles: Number(userRadius) || 10, rawText: nearMatch[0] }
  }

  // 'within N miles' / 'within N mi' / 'N miles away'
  const distNumMatch = text.match(/\b(?:within\s+)?(\d+(?:\.\d+)?)\s*(miles?|mi|km)?(?:\s+away)?\b/i)
  if (distNumMatch && (distNumMatch[0].includes('mile') || distNumMatch[0].includes('within') || distNumMatch[0].includes('mi'))) {
    const num = parseFloat(distNumMatch[1])
    const unit = (distNumMatch[2] || '').toLowerCase()
    const miles = unit === 'km' ? num * 0.621371 : num
    return { miles: Math.round(miles * 10) / 10, rawText: distNumMatch[0] }
  }

  return { miles: null, rawText: null }
}

export function extractNegations(text) {
  const matches = [...text.matchAll(/\b(not|except|without|no)\s+([a-zA-Z0-9_-]+)\b/gi)]
  if (!matches.length) return []
  return matches.map(m => ({
    term: m[2].toLowerCase(),
    rawText: m[0]
  }))
}

export function extractCircle(text) {
  const match = text.match(/\b(?:in the|in my|circle called|circle named|group called|group named)\s+([a-zA-Z0-9\s'-]+?)(?=\s+(?:this|next|near|with|by|for|not|except)|$)/i)
  if (match) {
    const raw = match[0]
    const name = match[1].trim()
    if (name) {
      return { name, rawText: raw }
    }
  }
  return { name: null, rawText: null }
}

export function extractPerson(text) {
  // Check explicit verbs first: 'message Sarah', 'dm Alex', 'connect with John', 'text Bob', etc.
  const verbMatch = text.match(/\b(?:message|text|dm|connect (?:with|me to)|introduce me to|chat with)\s+([A-Z][a-z0-9'-]+(?:\s+[A-Z][a-z0-9'-]+)*|[a-z0-9'-]+)/i)
  if (verbMatch) {
    const raw = verbMatch[0]
    const name = verbMatch[1].trim()
    if (name && !['me', 'them', 'someone', 'people', 'anyone', 'friends'].includes(name.toLowerCase())) {
      return { name, rawText: raw }
    }
  }

  // Capitalised proper names (e.g. "is Sarah coming")
  const capitalizedMatch = text.match(/\b([A-Z][a-z0-9'-]+(?:\s+[A-Z][a-z0-9'-]+)*)\b/)
  if (capitalizedMatch) {
    const name = capitalizedMatch[1].trim()
    // Exclude common starting capitalized words
    const ignoreList = ['Are', 'Is', 'What', 'Where', 'When', 'Who', 'How', 'Find', 'Show', 'Create', 'Join', 'Connect', 'Message', 'Events', 'Circles', 'People', 'Help']
    if (!ignoreList.includes(name)) {
      return { name, rawText: capitalizedMatch[0] }
    }
  }

  return { name: null, rawText: null }
}

export function extractCategory(text, categories = []) {
  const lower = text.toLowerCase()
  for (const cat of categories) {
    const reg = new RegExp(`\\b${cat.toLowerCase()}\\b`, 'i')
    const m = lower.match(reg)
    if (m) {
      return { name: cat, rawText: m[0] }
    }
  }
  return { name: null, rawText: null }
}

export function extractResidualTopic(text) {
  if (!text) return { value: null, rawText: null }

  // Strip generic action words, pronouns, articles, intent phrases
  let cleaned = text
    .replace(/\b(rsvp me|rsvp|sign me up for|sign up for|join|leave|create|host|plan|organize|throw|start|message|text|dm|connect with|connect me to|introduce me to|open|go to|attend|are there|is there|is anyone|are any|can i|how to|do we have|show me|find|browse|discover|search for|look for|see|going to|free|happening|available)\b/gi, ' ')
    .replace(/\b(events?|meetups?|circles?|groups?|communities|clubs?|people|someone|friends|folks|peeps|page|section)\b/gi, ' ')
    .replace(/\b(a|an|the|some|any|my|this|that|near|me|in|for|about|with|to)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 2) {
    return { value: null, rawText: null }
  }

  return { value: cleaned, rawText: cleaned }
}
