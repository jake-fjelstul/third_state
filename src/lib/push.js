import { supabase } from './supabase'

/**
 * Initial guess only — the send-push function auto-corrects a wrong value on
 * the first BadDeviceToken. Xcode debug builds are sandbox; TestFlight AND
 * App Store builds are BOTH production.
 */
const APNS_ENVIRONMENT = import.meta.env.VITE_APNS_ENVIRONMENT || 'sandbox'

const TOKEN_KEY = 'ts.push.lastToken'

let lastToken = null

export function getLastPushToken() { return lastToken }

async function isNative() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch { return false }
}

async function getPlatform() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.getPlatform() // 'ios' | 'android'
  } catch { return 'ios' }
}

// The token survives app restarts so sign-out can always unregister it, even
// if 'registration' never fired this session (audit H5).
async function saveToken(token) {
  lastToken = token
  try {
    const { Preferences } = await import('@capacitor/preferences')
    if (token) await Preferences.set({ key: TOKEN_KEY, value: token })
    else await Preferences.remove({ key: TOKEN_KEY })
  } catch { /* non-fatal */ }
}

async function loadToken() {
  if (lastToken) return lastToken
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: TOKEN_KEY })
    return value || null
  } catch { return null }
}

/**
 * Ask iOS for permission and begin registration.
 * Returns 'granted' | 'denied' | 'unsupported'.
 * Safe to call on web — returns 'unsupported' without side effects.
 */
export async function requestPushPermission() {
  if (!(await isNative())) return 'unsupported'
  const { PushNotifications } = await import('@capacitor/push-notifications')

  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') return 'denied'

  // Fires the 'registration' listener asynchronously — see initPush.
  await PushNotifications.register()
  return 'granted'
}

export async function getPushPermission() {
  if (!(await isNative())) return 'unsupported'
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const perm = await PushNotifications.checkPermissions()
  return perm.receive
}

/**
 * Attach listeners. Call ONCE per app session, after the user is signed in.
 * Returns a cleanup function.
 */
export async function initPush({ onTokenRegistered, onTapped, onForeground } = {}) {
  if (!(await isNative())) return () => {}
  const { PushNotifications } = await import('@capacitor/push-notifications')

  const registration = await PushNotifications.addListener('registration', async (t) => {
    await saveToken(t.value)
    try {
      await supabase.rpc('register_device_token', {
        p_token: t.value,
        p_platform: await getPlatform(),
        p_environment: APNS_ENVIRONMENT,
      })
      onTokenRegistered?.(t.value)
    } catch (err) {
      console.error('[push] register_device_token failed', err)
    }
  })

  const registrationError = await PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] APNs registration failed', err)
  })

  // Fired when the app is in the FOREGROUND.
  const received = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    onForeground?.(notification)
  })

  // Fired when the user TAPS a banner (including launching from a killed state).
  const actioned = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    onTapped?.(action.notification)
  })

  // Android 8+: messages and activity get separate, user-controllable channels.
  if ((await getPlatform()) === 'android') {
    try {
      await PushNotifications.createChannel({ id: 'messages', name: 'Messages', description: 'Direct and circle messages', importance: 4, sound: 'default', vibration: true })
      await PushNotifications.createChannel({ id: 'activity', name: 'Activity', description: 'Invites, requests, reminders', importance: 3 })
    } catch (err) {
      console.error('[push] createChannel failed', err)
    }
  }

  // Already allowed: register on every launch so this device's token is tied
  // to whoever is signed in now, and rotated tokens get picked up.
  try {
    const perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'granted') await PushNotifications.register()
  } catch (err) {
    console.error('[push] register on launch failed', err)
  }

  return () => {
    registration.remove().catch(() => {})
    registrationError.remove().catch(() => {})
    received.remove().catch(() => {})
    actioned.remove().catch(() => {})
  }
}

/** Called on sign-out so the next user on this device does not inherit pushes. */
export async function unregisterPush() {
  if (!(await isNative())) return
  const token = await loadToken()
  if (!token) return
  try {
    const { error } = await supabase.rpc('unregister_device_token', { p_token: token })
    if (error) throw error
  } catch (err) {
    console.error('[push] unregister_device_token failed', err)
  }
  await saveToken(null)
}

export async function setBadgeCount(count) {
  if (!(await isNative())) return
  const { PushNotifications } = await import('@capacitor/push-notifications')
  try {
    if (count > 0) await PushNotifications.removeAllDeliveredNotifications()
  } catch { /* non-fatal */ }
}

/** Clear the badge and any banners still sitting in Notification Center. */
export async function clearDeliveredNotifications() {
  if (!(await isNative())) return
  const { PushNotifications } = await import('@capacitor/push-notifications')
  try { await PushNotifications.removeAllDeliveredNotifications() }
  catch (err) { console.error('[push] clear delivered failed', err) }
}
