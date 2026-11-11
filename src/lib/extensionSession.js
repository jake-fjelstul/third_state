// Signs the iMessage extension in (plan Part 4, Layer B).
//
// The extension can't share the app's refresh token (Supabase rotates it, so
// one side would sign the other out). Instead the app asks the
// extension-session function for a second session for the same user and
// stores it under Preferences key ts.ext.session. AppDelegate.swift copies that
// key into the App Group the extension reads; after that the extension
// refreshes its own token. ts.ext.status carries a short reason when it fails,
// which the extension shows on its sign-in banner.
import { supabase } from './supabase'

export const EXT_SESSION_KEY = 'ts.ext.session'
export const EXT_STATUS_KEY = 'ts.ext.status'

async function nativePrefs() {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.getPlatform() !== 'ios') return null
  const { Preferences } = await import('@capacitor/preferences')
  return Preferences
}

let inFlight = null

/** Make sure the extension has a session for this user. Safe to call often. */
export function ensureExtensionSession(userId) {
  if (!inFlight) inFlight = mint(userId).finally(() => { inFlight = null })
  return inFlight
}

async function mint(userId) {
  let Preferences = null
  try {
    Preferences = await nativePrefs()
    if (!Preferences || !userId) return
    const { value } = await Preferences.get({ key: EXT_SESSION_KEY })
    if (value) {
      try { if (JSON.parse(value).user_id === userId) return } catch { /* rewrite it */ }
    }
    const { data, error } = await supabase.functions.invoke('extension-session', { method: 'POST' })
    if (error) {
      let detail = error.message
      try { detail = (await error.context?.json?.())?.error || detail } catch { /* not json */ }
      throw new Error(detail)
    }
    if (!data?.refresh_token) throw new Error('No session came back')
    if (data.user_id !== userId) throw new Error('Session was for a different account')
    await Preferences.set({ key: EXT_SESSION_KEY, value: JSON.stringify(data) })
    await Preferences.remove({ key: EXT_STATUS_KEY })
  } catch (err) {
    console.warn('[extensionSession] could not sign in the iMessage app', err)
    try { await Preferences?.set({ key: EXT_STATUS_KEY, value: String(err?.message || err).slice(0, 140) }) } catch { /* ignore */ }
  }
}

/**
 * Keep the extension signed in while this user is signed in: now, and every
 * time the app comes back to the foreground (the iMessage banner sends people
 * here to fix sign-in). Returns a cleanup function.
 */
export function watchExtensionSession(userId) {
  let handle = null
  let stopped = false
  ensureExtensionSession(userId)
  import('@capacitor/core').then(async ({ Capacitor }) => {
    if (Capacitor.getPlatform() !== 'ios') return
    const { App } = await import('@capacitor/app')
    const h = await App.addListener('appStateChange', s => { if (s.isActive) ensureExtensionSession(userId) })
    if (stopped) h.remove(); else handle = h
  }).catch(() => {})
  return () => { stopped = true; handle?.remove() }
}

/** Sign the extension out with the app. */
export async function clearExtensionSession() {
  try {
    const Preferences = await nativePrefs()
    if (Preferences) {
      await Preferences.remove({ key: EXT_SESSION_KEY })
      await Preferences.remove({ key: EXT_STATUS_KEY })
    }
  } catch { /* nothing to clear */ }
}
