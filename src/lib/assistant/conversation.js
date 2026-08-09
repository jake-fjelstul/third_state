// Message shapes used throughout the assistant UI.
// All messages have: { id, role, kind, ...payload, createdAt }
// role: 'user' | 'assistant'

let _id = 0
export const resetIdCounter = () => { _id = 0 }
export const nextId = (prefix = 'msg') => `${prefix}_${++_id}`

export function userMessage(text, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('user')
  return { id, role: 'user', kind: 'text', text, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantText(text, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_text')
  return { id, role: 'assistant', kind: 'text', text, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantPeople(text, people, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_people')
  return { id, role: 'assistant', kind: 'people', text, payload: { people }, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantCircles(text, circles, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_circles')
  return { id, role: 'assistant', kind: 'circles', text, payload: { circles }, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantEvents(text, events, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_events')
  return { id, role: 'assistant', kind: 'events', text, payload: { events }, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantEventForm(text, prefill, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_event_form')
  return { id, role: 'assistant', kind: 'event_form', text, payload: { prefill }, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantCircleForm(text, prefill, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_circle_form')
  return { id, role: 'assistant', kind: 'circle_form', text, payload: { prefill }, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantNavigate(text, path, label, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_nav')
  return { id, role: 'assistant', kind: 'navigate', text, payload: { path, label }, createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantHelp(options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_help')
  return {
    id,
    role: 'assistant',
    kind: 'help',
    text: "Here's what I can do — try one of these, or type anything in your own words.",
    createdAt: options.now ? new Date(options.now).getTime() : 0,
  }
}

export function assistantThinking(options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_thinking')
  return { id, role: 'assistant', kind: 'thinking', createdAt: options.now ? new Date(options.now).getTime() : 0 }
}

export function assistantDisambiguation(text, query, candidates, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_disambiguate')
  return {
    id,
    role: 'assistant',
    kind: 'disambiguation',
    text,
    query,
    candidates,
    createdAt: options.now ? new Date(options.now).getTime() : 0
  }
}

export function assistantActionConfirmation(text, actionId, actionLabel, description, slots, entity, reason, options = {}) {
  const id = typeof options === 'string' ? options : options.id || nextId('msg_confirm')
  return {
    id,
    role: 'assistant',
    kind: 'action_confirmation',
    text,
    actionId,
    actionLabel,
    description,
    slots,
    entity,
    reason,
    createdAt: options.now ? new Date(options.now).getTime() : 0
  }
}

