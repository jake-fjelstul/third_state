// "Take me home": the logo, and the Home tab when you're already on Home,
// ask the Feed to close search and any open sheet and return to the top (J4).
export const HOME_RESET_EVENT = 'ts:home-reset'

export function requestHomeReset() {
  try { window.dispatchEvent(new Event(HOME_RESET_EVENT)) } catch { /* noop */ }
}
