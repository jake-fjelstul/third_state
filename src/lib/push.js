import { supabase } from './supabase'

/** APNs sandbox for dev/TestFlight builds, production for App Store builds. */
const APNS_ENVIRONMENT = import.meta.env.VITE_APNS_ENVIRONMENT || 'sandbox'

let lastToken = null

export function getLastPushToken() { return lastToken }

async function isNative() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch { return false }
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
export async function initPush({ onTokenRegistered } = {}) {
  if (!(await isNative())) return () => {}
  const { PushNotifications } = await import('@capacitor/push-notifications')

  const registration = await PushNotifications.addListener('registration', async (t) => {
    lastToken = t.value
    try {
      await supabase.rpc('register_device_token', {
        p_token: t.value,
        p_platform: 'ios',
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

  return () => {
    registration.remove().catch(() => {})
    registrationError.remove().catch(() => {})
  }
}

/** Called on sign-out so the next user on this device does not inherit pushes. */
export async function unregisterPush() {
  if (!(await isNative())) return
  if (!lastToken) return
  try {
    await supabase.rpc('unregister_device_token', { p_token: lastToken })
  } catch (err) {
    console.error('[push] unregister_device_token failed', err)
  }
  lastToken = null
}
