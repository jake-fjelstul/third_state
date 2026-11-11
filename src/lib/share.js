// Smart links (plan Part 4, Layer A): shareable URLs with rich previews.
import { supabase } from './supabase'
import { PUBLIC_APP_URL } from './invites.js'

export const PENDING_LINK_KEY = 'ts.pendingLink'

export const eventShareUrl = (id) => `${PUBLIC_APP_URL}/e/${id}`
export const checkinShareUrl = (id) => `${PUBLIC_APP_URL}/s/${id}`

/** Public preview data for a shared link (works signed out). */
export async function getPublicCard(type, id) {
  const fn = type === 'event' ? 'public_event_card' : 'public_checkin_card'
  const { data, error } = await supabase.rpc(fn, { p_id: id })
  if (error) throw error
  return data || null
}

/** Remember a shared link so we can open it right after sign-in. */
export function rememberPendingLink(path) {
  try { window.localStorage.setItem(PENDING_LINK_KEY, path) } catch { /* private mode */ }
}
export function takePendingLink() {
  try {
    const v = window.localStorage.getItem(PENDING_LINK_KEY)
    if (v) window.localStorage.removeItem(PENDING_LINK_KEY)
    return v && /^\/(e|s|p)\/[0-9a-f-]{36}$/i.test(v) ? v : null
  } catch { return null }
}

/**
 * Native share sheet (iMessage turns the URL into a preview card), then the
 * Web Share API, then copy to clipboard. Returns 'shared' | 'copied' | 'failed'.
 */
export async function shareLink({ url, title, text }) {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text, url, dialogTitle: title })
      return 'shared'
    }
  } catch (err) {
    if (/cancel/i.test(String(err?.message))) return 'shared'
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared' }
    catch (err) { if (err?.name === 'AbortError') return 'shared' }
  }
  try {
    await navigator.clipboard.writeText(`${text ? `${text} ` : ''}${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
