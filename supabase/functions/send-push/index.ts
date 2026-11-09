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

// ---- FCM HTTP v1 (Android) ---------------------------------------------
// Inactive until FCM_SERVICE_ACCOUNT (the Firebase service-account JSON) is
// set in Supabase secrets. Never commit that file.

let fcmToken: string | null = null
let fcmTokenExp = 0

async function getFcmAccessToken(sa: { client_email: string; private_key: string; token_uri?: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (fcmToken && now < fcmTokenExp - 60) return fcmToken
  const enc = new TextEncoder()
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })))
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claim}`)))
  const assertion = `${header}.${claim}.${b64url(sig)}`
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`)
  fcmToken = data.access_token
  fcmTokenExp = now + (data.expires_in || 3600)
  return fcmToken!
}

async function sendFcm(
  token: string,
  msg: { title?: string; body: string; threadId?: string; data?: Record<string, unknown> },
): Promise<SendResult> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) return { ok: false, reason: 'FcmNotConfigured', status: 0 }
  const sa = JSON.parse(raw)
  const access = await getFcmAccessToken(sa)
  // FCM data values must be strings.
  const data: Record<string, string> = {}
  for (const [k, v] of Object.entries(msg.data || {})) if (v !== null && v !== undefined) data[k] = String(v)
  const isMessage = data.type === 'message'
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title || 'Third Space', body: msg.body },
        data,
        android: {
          priority: 'high',
          notification: {
            channel_id: isMessage ? 'messages' : 'activity',
            tag: msg.threadId || undefined,
            sound: 'default',
          },
        },
      },
    }),
  })
  if (res.ok) return { ok: true, reason: '', status: 200 }
  const text = await res.text()
  let reason = ''
  try { reason = JSON.parse(text)?.error?.details?.[0]?.errorCode || JSON.parse(text)?.error?.status || '' } catch { /* ignore */ }
  console.error('[send-push] FCM rejected', res.status, reason, text)
  return { ok: false, reason, status: res.status }
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
    .select('id, token, environment, platform')
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

  const hasIos = tokens.some(t => (t.platform || 'ios') === 'ios')
  const jwt = hasIos ? await getProviderToken() : ''
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
    if (t.platform === 'android') {
      try {
        const r = await sendFcm(t.token, { title, body: message, threadId, data })
        if (r.ok) { sent++; return }
        if (r.status === 404 || r.reason === 'UNREGISTERED' || r.reason === 'INVALID_ARGUMENT') dead.push(t.id)
      } catch (err) {
        console.error('[send-push] FCM request failed', err)
      }
      return
    }
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
