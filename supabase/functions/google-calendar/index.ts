import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------------------
// Signed OAuth state (audit C7). The callback runs without a JWT, so the user
// id must come from a value only this function could have produced.
// ---------------------------------------------------------------------------
const STATE_TTL_MS = 10 * 60 * 1000
const DEFAULT_WEB_REDIRECT = 'https://third-space-app.com/schedule?calendar_ok=1'
const NATIVE_REDIRECT = 'com.thirdspace.social://calendar-callback?ok=1'

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET')
  if (!secret) throw new Error('OAUTH_STATE_SECRET is not set')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = new TextEncoder().encode(JSON.stringify(payload))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), body))
  return `${b64url(body)}.${b64url(sig)}`
}

// deno-lint-ignore no-explicit-any
async function verifyState(state: string): Promise<any | null> {
  const [bodyPart, sigPart] = state.split('.')
  if (!bodyPart || !sigPart) return null
  const body = b64urlDecode(bodyPart)
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(), b64urlDecode(sigPart), body)
  if (!ok) return null
  const data = JSON.parse(new TextDecoder().decode(body))
  if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
  return data
}

// Only send the browser back to our own app.
function safeWebRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return DEFAULT_WEB_REDIRECT
  try {
    const u = new URL(raw)
    const host = u.hostname
    const allowed =
      (u.protocol === 'https:' && (host === 'third-space-app.com' || host === 'www.third-space-app.com')) ||
      (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1'))
    return allowed ? u.toString() : DEFAULT_WEB_REDIRECT
  } catch {
    return DEFAULT_WEB_REDIRECT
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const pathname = url.pathname

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('VITE_GOOGLE_CLIENT_ID') || ''
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''

  const redirectUri = `${supabaseUrl}/functions/v1/google-calendar/callback`

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  // ---------------------------------------------------------------------------
  // Action 2: CALLBACK (GET /callback or action: 'callback')
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/callback') || url.searchParams.has('code')) {
    const code = url.searchParams.get('code')
    const stateRaw = url.searchParams.get('state')

    if (!code || !stateRaw) {
      return new Response('Missing code or state', { status: 400, headers: corsHeaders })
    }

    try {
      const stateData = await verifyState(stateRaw).catch(() => null)
      if (!stateData?.uid) {
        return new Response('Invalid or expired state. Please try connecting again.', { status: 400, headers: corsHeaders })
      }
      const userId: string = stateData.uid
      const platform: string = stateData.platform
      const webRedirectUrl = safeWebRedirect(stateData.ret)

      // Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      const tokenData = await tokenRes.json()

      if (!tokenRes.ok || tokenData.error) {
        console.error('[google-calendar-callback] Token exchange error:', tokenData)
        return new Response(`Token exchange failed: ${tokenData.error_description || tokenData.error}`, { status: 400, headers: corsHeaders })
      }

      const { access_token, refresh_token, expires_in, scope } = tokenData
      const expires_at = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

      // Upsert into google_calendar_tokens
      const { error: dbErr } = await supabaseAdmin
        .from('google_calendar_tokens')
        .upsert({
          user_id: userId,
          refresh_token,
          access_token,
          expires_at,
          scope,
          updated_at: new Date().toISOString(),
        })

      if (dbErr) {
        console.error('[google-calendar-callback] DB error:', dbErr)
        return new Response(`Database store failed: ${dbErr.message}`, { status: 500, headers: corsHeaders })
      }

      // Determine redirect location
      if (platform === 'native') {
        return Response.redirect(NATIVE_REDIRECT, 302)
      }
      return Response.redirect(webRedirectUrl, 302)
    } catch (err: any) {
      console.error('[google-calendar-callback] Exception:', err)
      return new Response('Callback failed', { status: 500, headers: corsHeaders })
    }
  }

  // ---------------------------------------------------------------------------
  // Authenticated Actions (start, token, disconnect)
  // ---------------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.replace('Bearer ', '').trim()
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const user = userData.user

  let body: any = {}
  try {
    body = await req.json()
  } catch {}

  const action = body.action || url.searchParams.get('action') || (pathname.split('/').pop())

  // Action 1: START
  if (action === 'start') {
    const platform = body.platform === 'native' ? 'native' : 'web'
    const state = await signState({
      uid: user.id,
      platform,
      ret: safeWebRedirect(body.webRedirectUrl),
      nonce: crypto.randomUUID(),
      exp: Date.now() + STATE_TTL_MS,
    })

    const authUrlParams = new URLSearchParams({
      response_type: 'code',
      client_id: googleClientId,
      redirect_uri: redirectUri,
      // calendar.events: add Third Space plans to the user's calendar.
      // calendar.freebusy: busy blocks only (never titles) for availability.
      scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy',
      include_granted_scopes: 'true',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authUrlParams.toString()}`

    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Action 5: FREEBUSY — busy blocks for a connection who opted in (item 2).
  // Returns only { start, end } pairs, never event titles.
  if (action === 'freebusy') {
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    const targetId = String(body.targetId || '')
    const timeMin = new Date(body.from || Date.now())
    const timeMax = new Date(body.to || Date.now() + 14 * 86400000)
    if (!targetId || isNaN(timeMin.getTime()) || isNaN(timeMax.getTime())) return json({ error: 'Bad request' }, 400)
    if (timeMax.getTime() - timeMin.getTime() > 31 * 86400000) return json({ error: 'Range too large' }, 400)

    if (targetId !== user.id) {
      const { data: conn } = await supabaseAdmin.from('connections').select('user_id')
        .eq('user_id', user.id).eq('connected_user_id', targetId).maybeSingle()
      if (!conn) return json({ busy: [], source: 'none' })
      const { data: blocked } = await supabaseAdmin.from('blocks').select('blocker_id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${user.id})`)
        .limit(1)
      if (blocked && blocked.length) return json({ busy: [], source: 'none' })
    }

    const { data: prof } = await supabaseAdmin.from('profiles')
      .select('share_calendar_busy, privacy').eq('id', targetId).maybeSingle()
    const showAvailability = prof?.privacy?.showAvailability !== false
    if (!prof?.share_calendar_busy || !showAvailability) return json({ busy: [], source: 'none' })

    const { data: row } = await supabaseAdmin.from('google_calendar_tokens')
      .select('*').eq('user_id', targetId).maybeSingle()
    if (!row) return json({ busy: [], source: 'none' })
    if (!String(row.scope || '').includes('calendar.freebusy')) {
      return json({ busy: [], source: 'none', needsReconnect: targetId === user.id })
    }

    let accessToken = row.access_token
    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0
    if (!accessToken || expiresAtMs <= Date.now() + 60000) {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: googleClientId, client_secret: googleClientSecret,
          refresh_token: row.refresh_token, grant_type: 'refresh_token',
        }),
      })
      const d = await r.json()
      if (!r.ok || d.error) return json({ busy: [], source: 'none', needsReconnect: targetId === user.id })
      accessToken = d.access_token
      await supabaseAdmin.from('google_calendar_tokens').update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', targetId)
    }

    const fb = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: 'primary' }] }),
    })
    if (!fb.ok) {
      console.error('[google-calendar-freebusy] Google error', fb.status, await fb.text())
      return json({ busy: [], source: 'none' })
    }
    const fbData = await fb.json()
    const busy = (fbData?.calendars?.primary?.busy || []).map((b: { start: string; end: string }) => ({ start: b.start, end: b.end }))
    return json({ busy, source: 'google' })
  }

  // Action 3: TOKEN
  if (action === 'token') {
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: 'Not connected' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0
    const nowMs = Date.now()

    // If access token is valid for > 60 seconds, return stored access token
    if (row.access_token && expiresAtMs > nowMs + 60000) {
      return new Response(JSON.stringify({ access_token: row.access_token }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Refresh token at Google token endpoint
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: row.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const refreshData = await refreshRes.json()

    if (!refreshRes.ok || refreshData.error) {
      if (refreshData.error === 'invalid_grant') {
        // Token has been revoked or expired; delete row so user can reconnect
        await supabaseAdmin.from('google_calendar_tokens').delete().eq('user_id', user.id)
        return new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: refreshData.error_description || refreshData.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newAccessToken = refreshData.access_token
    const newExpiresIn = refreshData.expires_in || 3600
    const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString()

    await supabaseAdmin
      .from('google_calendar_tokens')
      .update({
        access_token: newAccessToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return new Response(JSON.stringify({ access_token: newAccessToken }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Action 4: DISCONNECT
  if (action === 'disconnect') {
    const { data: row } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (row?.refresh_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, {
          method: 'POST',
        })
      } catch (revokeErr) {
        console.warn('[google-calendar-disconnect] revoke warning', revokeErr)
      }
    }

    await supabaseAdmin.from('google_calendar_tokens').delete().eq('user_id', user.id)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
