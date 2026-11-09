// A "natural moment" to (re)offer push notifications: first connection,
// first message sent. PushPrompt listens for this.
export const PUSH_MOMENT_EVENT = 'ts:push-moment'

export function signalPushMoment() {
  try { window.dispatchEvent(new Event(PUSH_MOMENT_EVENT)) } catch { /* noop */ }
}
