import { supabase } from './supabase'

export async function signUp({ email, password, name, age, city }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, age, city } },
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
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
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
  const name =
    meta.name ||
    meta.full_name ||
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
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
