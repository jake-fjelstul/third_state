/* global process */
// Smart-link previews (plan Part 4, Layer A).
//
// vercel.json rewrites /e/:id, /s/:id and /j/:code here. Link-preview bots
// (Messages, Slack, WhatsApp...) don't run JavaScript, so we return the app's
// own index.html with the right title / description / image filled in. People
// get the same page and the app takes over from there.
import { describe, injectMeta, validId, SITE } from './_cards.js'

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cxlzvegqgspuddbrxawr.supabase.co'
// The publishable (anon) key; it ships in the app already and only reaches
// the public card functions, which return preview fields only.
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_cCv3dB71RtaMGoBipFh2ZQ_GOe0vcAc'

const RPC = {
  event: ['public_event_card', 'p_id'],
  checkin: ['public_checkin_card', 'p_id'],
  invite: ['preview_invite', 'p_code'],
}
const PATH = { event: 'e', checkin: 's', invite: 'j' }

async function loadCard(type, id) {
  const [fn, arg] = RPC[type]
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ [arg]: id }),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return Array.isArray(data) ? data[0] ?? null : data
}

export default async function handler(request) {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const id = url.searchParams.get('id') || ''

  const page = await fetch(new URL('/index.html', url))
  let html = await page.text()

  if (RPC[type] && validId(type, id)) {
    try {
      const info = describe(type, await loadCard(type, id))
      html = injectMeta(html, info, `${SITE}/${PATH[type]}/${encodeURIComponent(id)}`)
    } catch {
      // Fall back to the plain app page.
    }
  }

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short cache: RSVP counts and live check-ins change.
      'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
