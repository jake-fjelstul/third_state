// extension-session (plan Part 4, Layer B).
//
// The iMessage extension needs to be signed in as the same person as the app,
// but it must not share the app's refresh token: Supabase rotates refresh
// tokens, so whichever side refreshed second would be signed out. Instead the
// signed-in app asks for a second, independent session for the same user.
// The app stores it in the shared App Group; the extension owns it from then.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: who, error: whoErr } = await admin.auth.getUser(jwt)
  const user = who?.user
  if (whoErr || !user) return json({ error: 'Not authenticated' }, 401)
  if (!user.email) return json({ error: 'This account has no email; sign in to the extension separately' }, 400)

  // A one-time magic-link token, exchanged here and never emailed.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email })
  const tokenHash = link?.properties?.hashed_token
  if (linkErr || !tokenHash) return json({ error: 'Could not issue a session' }, 500)

  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  const s = verified?.session
  if (verifyErr || !s || verified.user?.id !== user.id) return json({ error: 'Could not issue a session' }, 500)

  return json({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    user_id: user.id,
  })
})
