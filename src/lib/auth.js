import { supabase } from './supabase'

function isMissingColumnError(error, columnName) {
  return error?.code === 'PGRST204' && String(error?.message || '').includes(`'${columnName}'`)
}

export async function signUp({ email, password, name, age, city, latitude, longitude }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, age, city, latitude, longitude },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signInWithGoogle({ redirectTo } = {}) {
  let isNative = false
  try {
    const { Capacitor } = await import('@capacitor/core')
    isNative = Capacitor.isNativePlatform()
  } catch {}

  const fallback = isNative
    ? 'thirdspace://auth/callback'
    : `${window.location.origin}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo ?? fallback,
      queryParams: { prompt: 'select_account' },
      // On native we must open the URL ourselves in an in-app browser
      // rather than letting the WebView navigate away from the app.
      skipBrowserRedirect: isNative,
    },
  })
  if (error) throw error

  if (isNative && data?.url) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: data.url, presentationStyle: 'popover' })
  }
  return data
}

function cryptoRandom() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function signInWithApple({ redirectTo } = {}) {
  let isNative = false
  try {
    const { Capacitor } = await import('@capacitor/core')
    isNative = Capacitor.isNativePlatform()
  } catch {}

  if (isNative) {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
    const rawNonce = cryptoRandom()
    const hashedNonce = await sha256Hex(rawNonce)

    const result = await SignInWithApple.authorize({
      clientId: 'com.thirdspace.social',   // bundle ID for native, NOT the Service ID
      redirectURI: 'thirdspace://auth/callback',
      scopes: 'email name',
      nonce: hashedNonce,        // Apple receives the HASHED nonce
      state: cryptoRandom(),
    })

    const identityToken = result?.response?.identityToken
    if (!identityToken) throw new Error('Apple did not return an identity token')

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce: rawNonce,           // Supabase receives the RAW nonce
    })
    if (error) throw error

    // Apple returns the user's name ONLY on the very first consent.
    // Capture it now or it is lost permanently.
    const given = result?.response?.givenName || ''
    const family = result?.response?.familyName || ''
    const fullName = [given, family].filter(Boolean).join(' ').trim()
    if (fullName && data?.user) {
      try {
        await supabase.auth.updateUser({ data: { full_name: fullName } })
        await supabase.from('profiles').update({ name: fullName }).eq('id', data.user.id)
      } catch (e) {
        console.warn('[apple] could not save name', e)
      }
    }
    return data
  }

  const fallback = `${window.location.origin}/auth/callback`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: redirectTo ?? fallback,
      scopes: 'name email',
    },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth?reset=1`,
  })
  if (error) throw error
}

/** Derive initial profile fields from Supabase Auth user (aligned with handle_new_user). */
export function profileRowFromAuthUser(user) {
  const meta = user?.user_metadata ?? {}
  const email = user?.email ?? ''
  const local = email.includes('@') ? email.split('@')[0] : email
  const given = meta.given_name || ''
  const family = meta.family_name || ''
  const appleName = [given, family].filter(Boolean).join(' ').trim()
  const name =
    meta.full_name ||
    meta.name ||
    (appleName ? appleName : null) ||
    (local ? local : null) ||
    'Friend'
  let age = null
  if (meta.age != null && meta.age !== '') {
    const n = parseInt(String(meta.age), 10)
    if (!Number.isNaN(n)) age = n
  }
  return {
    id: user.id,
    name,
    age,
    city: meta.city || null,
    latitude: meta.latitude != null ? Number(meta.latitude) : null,
    longitude: meta.longitude != null ? Number(meta.longitude) : null,
    avatar_url: meta.avatar_url || meta.picture || null,
  }
}

/** JWT/session exists locally but auth user id is missing from DB (wrong project, stale token, deleted user). */
export function isProfileSessionFatalError(error) {
  if (!error) return false
  const code = error.code
  if (code === '23503') return true
  const msg = String(error.message ?? '')
  if (msg.includes('profiles_id_fkey')) return true
  if (msg.includes('Key is not present in table') && msg.includes('users')) return true
  return false
}

/**
 * Load profile by id; returns null if no row (no PGRST116).
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Load profile for the signed-in user, inserting a row from auth metadata if missing.
 */
export async function fetchProfileForUser(user) {
  if (!user?.id) throw new Error('fetchProfileForUser: missing user.id')
  const existing = await getProfile(user.id)
  if (existing) return existing

  const row = profileRowFromAuthUser(user)
  const { data, error } = await supabase.from('profiles').insert(row).select().single()
  if (!error) return data
  if (error.code === '23505') {
    const again = await getProfile(user.id)
    if (again) return again
  }
  throw error
}

export async function updateProfile(userId, patch) {
  const payload = { ...patch, updated_at: new Date().toISOString() }
  const runUpdate = async (updatePatch) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updatePatch)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  let currentPatch = { ...payload }
  let attempts = 0
  
  while (attempts < 3) {
    try {
      return await runUpdate(currentPatch)
    } catch (error) {
      const missingLat = isMissingColumnError(error, 'latitude')
      const missingLon = isMissingColumnError(error, 'longitude')
      const missingPriv = isMissingColumnError(error, 'privacy')
      const missingNotifs = isMissingColumnError(error, 'notification_prefs')
      const missingIntentAt = isMissingColumnError(error, 'intent_captured_at')
      const missingIntentNote = isMissingColumnError(error, 'intent_note')
      
      if (!missingLat && !missingLon && !missingPriv && !missingNotifs && !missingIntentAt && !missingIntentNote) throw error
      
      if (missingLat || missingLon) {
        delete currentPatch.latitude
        delete currentPatch.longitude
      }
      if (missingPriv) {
        delete currentPatch.privacy
      }
      if (missingNotifs) delete currentPatch.notification_prefs
      if (missingIntentAt) delete currentPatch.intent_captured_at
      if (missingIntentNote) delete currentPatch.intent_note
      
      attempts++
    }
  }
  throw new Error("Failed to update profile after multiple fallback attempts")
}
