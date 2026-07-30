import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local')
}

// On native, back the session store with Capacitor Preferences (UserDefaults)
// so iOS cannot purge it. On web, leave the default localStorage behavior.
let storageAdapter
if (Capacitor.isNativePlatform()) {
  const { Preferences } = await import('@capacitor/preferences')
  storageAdapter = {
    getItem:    async (key) => (await Preferences.get({ key })).value,
    setItem:    async (key, value) => { await Preferences.set({ key, value }) },
    removeItem: async (key) => { await Preferences.remove({ key }) },
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(storageAdapter ? { storage: storageAdapter } : {}),
  },
})
