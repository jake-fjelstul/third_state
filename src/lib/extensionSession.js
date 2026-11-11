// Signs the iMessage extension in (plan Part 4, Layer B).
//
// The extension can't share the app's refresh token (Supabase rotates it, so
// one side would sign the other out). Instead the app asks the
// extension-session function for a second session for the same user and
// stores it under Preferences key ts.ext.session. AppDelegate.swift copies that
// key into the App Group the extension reads; after that the extension
// refreshes its own token.
import { supabase } from './supabase'

export const EXT_SESSION_KEY = 'ts.ext.session'

async function nativePrefs() {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.getPlatform() !== 'ios') return null
  const { Preferences } = await import('@capacitor/preferences')
  return Preferences
}

/** Make sure the extension has a session for this user. Safe to call often. */
export async function ensureExtensionSession(userId) {
  try {
    const Preferences = await nativePrefs()
    if (!Preferences || !userId) return
    const { value } = await Preferences.get({ key: EXT_SESSION_KEY })
    if (value) {
      try { if (JSON.parse(value).user_id === userId) return } catch { /* rewrite it */ }
    }
    const { data, error } = await supabase.functions.invoke('extension-session', { method: 'POST' })
    if (error || !data?.refresh_token || data.user_id !== userId) return
    await Preferences.set({ key: EXT_SESSION_KEY, value: JSON.stringify(data) })
  } catch (err) {
    console.warn('[extensionSession] could not sign in the iMessage app', err)
  }
}

/** Sign the extension out with the app. */
export async function clearExtensionSession() {
  try {
    const Preferences = await nativePrefs()
    if (Preferences) await Preferences.remove({ key: EXT_SESSION_KEY })
  } catch { /* nothing to clear */ }
}
