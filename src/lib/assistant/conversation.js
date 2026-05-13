// Message shapes used throughout the assistant UI.
// All messages have: { id, role, kind, ...payload, createdAt }
// role: 'user' | 'assistant'

let _id = 0
export const nextId = () => `msg_${Date.now()}_${++_id}`

export function userMessage(text) {
  return { id: nextId(), role: 'user', kind: 'text', text, createdAt: Date.now() }
}

export function assistantText(text) {
  return { id: nextId(), role: 'assistant', kind: 'text', text, createdAt: Date.now() }
}

export function assistantPeople(text, people) {
  return { id: nextId(), role: 'assistant', kind: 'people', text, payload: { people }, createdAt: Date.now() }
}

export function assistantCircles(text, circles) {
  return { id: nextId(), role: 'assistant', kind: 'circles', text, payload: { circles }, createdAt: Date.now() }
}

export function assistantEvents(text, events) {
  return { id: nextId(), role: 'assistant', kind: 'events', text, payload: { events }, createdAt: Date.now() }
}

export function assistantEventForm(text, prefill) {
  return { id: nextId(), role: 'assistant', kind: 'event_form', text, payload: { prefill }, createdAt: Date.now() }
}

export function assistantCircleForm(text, prefill) {
  return { id: nextId(), role: 'assistant', kind: 'circle_form', text, payload: { prefill }, createdAt: Date.now() }
}

export function assistantNavigate(text, path, label) {
  return { id: nextId(), role: 'assistant', kind: 'navigate', text, payload: { path, label }, createdAt: Date.now() }
}

export function assistantHelp() {
  return {
    id: nextId(),
    role: 'assistant',
    kind: 'help',
    text: "Here's what I can do — try one of these, or type anything in your own words.",
    createdAt: Date.now(),
  }
}

export function assistantThinking() {
  return { id: nextId(), role: 'assistant', kind: 'thinking', createdAt: Date.now() }
}
