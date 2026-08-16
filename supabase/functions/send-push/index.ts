import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APNS_KEY_ID      = Deno.env.get('APNS_KEY_ID')!
const APNS_TEAM_ID     = Deno.env.get('APNS_TEAM_ID')!
const APNS_BUNDLE_ID   = Deno.env.get('APNS_BUNDLE_ID')!
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')!
const HOOK_SECRET      = Deno.env.get('PUSH_HOOK_SECRET')!

const HOSTS = {
  sandbox:    'https://api.sandbox.push.apple.com',
  production: 'https://api.push.apple.com',
}

type SendResult = { ok: boolean; reason: string; status: number }

async function sendOne(host: string, token: string, jwt: string, payload: string): Promise<SendResult> {
  const res = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      'authorization': `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: payload,
  })
  if (res.status === 200) return { ok: true, reason: '', status: 200 }
  const text = await res.text()
  let reason = ''
  try { reason = JSON.parse(text)?.reason || '' } catch { /* ignore */ }
  console.error('[send-push] APNs rejected', res.status, reason, text)
  return { ok: false, reason, status: res.status }
}

// ---- JWT signing, cached ------------------------------------------------

let cachedJwt: string | null = null
let cachedAt = 0

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importKey(pem: string): Promise<CryptoKey> {
  // The .p8 is PKCS#8 PEM. Strip the header/footer and all whitespace —
  // `supabase secrets set "$(cat ...)"` preserves newlines, so this must
  // tolerate them.
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'pkcs8', der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'])
}

async function getProviderToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  // Apple allows one token refresh per 20 min and expires at 60 min.
  if (cachedJwt && (now - cachedAt) < 3000) return cachedJwt

  const header  = { alg: 'ES256', kid: APNS_KEY_ID }
  const payload = { iss: APNS_TEAM_ID, iat: now }
  const enc = new TextEncoder()
  const signingInput =
    b64url(enc.encode(JSON.stringify(header))) + '.' +
    b64url(enc.encode(JSON.stringify(payload)))

  const key = await importKey(APNS_PRIVATE_KEY)
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput))

  cachedJwt = signingInput + '.' + b64url(new Uint8Array(sig))
  cachedAt = now
  return cachedJwt
}

// ---- handler ------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (req.headers.get('x-push-secret') !== HOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: {
    userId?: string
    title?: string
    body?: string
    badge?: number
    threadId?: string
    data?: Record<string, unknown>
  }
  try { body = await req.json() }
  catch { return new Response('Bad request', { status: 400 }) }

  const { userId, title, body: message, badge, threadId, data } = body
  if (!userId || !message) {
    return new Response(JSON.stringify({ error: 'userId and body are required' }),
      { status: 400, headers: { 'content-type': 'application/json' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: tokens, error } = await supabase
    .from('device_tokens')
    .select('id, token, environment')
    .eq('user_id', userId)

  if (error) {
    console.error('[send-push] token lookup failed', error)
    return new Response(JSON.stringify({ error: 'token lookup failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } })
  }
  if (!tokens?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no devices' }),
      { headers: { 'content-type': 'application/json' } })
  }

  const jwt = await getProviderToken()
  const payload = JSON.stringify({
    aps: {
      alert: title ? { title, body: message } : { body: message },
      sound: 'default',
      ...(badge !== undefined ? { badge } : {}),
      ...(threadId ? { 'thread-id': threadId } : {}),
    },
    ...(data || {}),
  })

  let sent = 0
  const dead: string[] = []
  const corrected: { id: string; environment: string }[] = []

  await Promise.all(tokens.map(async (t) => {
    const primary = (t.environment === 'production' ? 'production' : 'sandbox') as 'production' | 'sandbox'
    const other   = primary === 'production' ? 'sandbox' : 'production'

    try {
      let r = await sendOne(HOSTS[primary], t.token, jwt, payload)

      // A token minted in the other environment reports BadDeviceToken. Retry
      // the opposite host ONCE before concluding the token is dead.
      if (!r.ok && r.reason === 'BadDeviceToken') {
        r = await sendOne(HOSTS[other], t.token, jwt, payload)
        if (r.ok) {
          corrected.push({ id: t.id, environment: other })
        }
      }

      if (r.ok) { sent++; return }

      // Genuinely dead: app deleted, or restored to a different device.
      if (r.status === 410 || r.reason === 'Unregistered' || r.reason === 'BadDeviceToken') {
        dead.push(t.id)
      }
    } catch (err) {
      console.error('[send-push] APNs request failed', err)
    }
  }))

  for (const c of corrected) {
    await supabase.from('device_tokens')
      .update({ environment: c.environment })
      .eq('id', c.id)
  }

  if (dead.length) {
    await supabase.from('device_tokens').delete().in('id', dead)
  }

  return new Response(JSON.stringify({ sent, pruned: dead.length, corrected: corrected.length, total: tokens.length }),
    { headers: { 'content-type': 'application/json' } })
})
