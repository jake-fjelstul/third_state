// spots-import: fills public.spots with real places around a point.
//
// The map is cut into 0.1 degree tiles (about 11 km). The app calls this with
// the user's location; any tile around it that has never been imported (or is
// older than 30 days) is fetched from OpenStreetMap's Overpass API and stored
// with the service role. Tiles already imported return immediately, so the
// call is cheap after the first person in an area.
//
// The place source lives only in this file: swapping or adding a provider
// (for example one with photos) means changing fetchTile() and nothing else.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-import-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })

const TILE = 0.1
const STALE_DAYS = 30
const MAX_TILES_PER_CALL = 1
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

type Tags = Record<string, string>

// Which OpenStreetMap tags we import, and the app category each maps to.
function categorize(t: Tags): { category: string; kind: string } | null {
  const a = t.amenity, l = t.leisure, to = t.tourism, s = t.shop, n = t.natural
  if (a === 'cafe') return { category: 'coffee', kind: 'cafe' }
  if (a === 'restaurant' || a === 'ice_cream' || a === 'food_court') return { category: 'food', kind: a }
  if (s === 'bakery') return { category: 'food', kind: 'bakery' }
  if (a === 'bar' || a === 'pub' || a === 'biergarten' || a === 'nightclub') return { category: 'drinks', kind: a }
  if (l === 'park' || l === 'garden' || l === 'nature_reserve' || l === 'dog_park') return { category: 'outdoors', kind: l }
  if (to === 'viewpoint' || n === 'beach') return { category: 'outdoors', kind: to || n }
  if (to === 'museum' || to === 'gallery') return { category: 'arts', kind: to }
  if (a === 'theatre' || a === 'cinema' || a === 'arts_centre') return { category: 'arts', kind: a }
  if (l === 'bowling_alley' || l === 'miniature_golf' || l === 'escape_game' || l === 'ice_rink'
    || l === 'amusement_arcade' || l === 'trampoline_park') return { category: 'active', kind: l }
  if (t.sport === 'climbing' && (l === 'sports_centre' || l === 'sports_hall')) return { category: 'active', kind: 'climbing' }
  if (s === 'books' || s === 'music' || s === 'second_hand' || s === 'games') return { category: 'browse', kind: s }
  if (a === 'marketplace') return { category: 'browse', kind: 'market' }
  if (to === 'attraction' || to === 'zoo' || to === 'aquarium' || to === 'theme_park') return { category: 'sights', kind: to }
  return null
}

function query(s: number, w: number, n: number, e: number) {
  const b = `(${s},${w},${n},${e})`
  return `[out:json][timeout:40];(
    nwr["name"]["amenity"~"^(cafe|restaurant|ice_cream|food_court|bar|pub|biergarten|nightclub|theatre|cinema|arts_centre|marketplace)$"]${b};
    nwr["name"]["leisure"~"^(park|garden|nature_reserve|dog_park|bowling_alley|miniature_golf|escape_game|ice_rink|amusement_arcade|trampoline_park)$"]${b};
    nwr["name"]["sport"="climbing"]["leisure"~"^(sports_centre|sports_hall)$"]${b};
    nwr["name"]["tourism"~"^(viewpoint|museum|gallery|attraction|zoo|aquarium|theme_park)$"]${b};
    nwr["name"]["natural"="beach"]${b};
    nwr["name"]["shop"~"^(bakery|books|music|second_hand|games)$"]${b};
  );out tags center 4000;`
}

async function fetchTile(tx: number, ty: number) {
  const s = ty * TILE, w = tx * TILE
  const body = 'data=' + encodeURIComponent(query(s, w, s + TILE, w + TILE))
  const errs: string[] = []
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'accept': 'application/json, */*',
          'user-agent': 'ThirdSpace/1.0 (+https://third-space-app.com)',
        },
        body,
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) { errs.push(`${new URL(url).host} answered ${res.status}: ${(await res.text()).slice(0, 160)}`); continue }
      const data = await res.json()
      return (data.elements || []) as Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags }>
    } catch (err) {
      errs.push(`${new URL(url).host}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  throw new Error(errs.join('; '))
}

const tileKey = (tx: number, ty: number) => `${tx}:${ty}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Signed-in users, or the server itself (seeding) with the shared secret.
  const secret = Deno.env.get('SPOTS_IMPORT_SECRET')
  const viaSecret = !!secret && req.headers.get('x-import-secret') === secret
  if (!viaSecret) {
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data?.user?.id) return json({ error: 'Not authenticated' }, 401)
  }

  let body: { lat?: number; lng?: number }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const lat = Number(body.lat), lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
    return json({ error: 'lat and lng are required' }, 400)
  }

  // The tile the person is in first, then its neighbours nearest to them.
  const cx = Math.floor(lng / TILE), cy = Math.floor(lat / TILE)
  const wanted: Array<{ tx: number; ty: number; d: number }> = []
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const tx = cx + dx, ty = cy + dy
    const mx = (tx + 0.5) * TILE, my = (ty + 0.5) * TILE
    wanted.push({ tx, ty, d: dx === 0 && dy === 0 ? -1 : Math.hypot(mx - lng, my - lat) })
  }
  wanted.sort((a, b) => a.d - b.d)

  const { data: known } = await admin.from('spot_tiles').select('tile_key, fetched_at')
    .in('tile_key', wanted.map(t => tileKey(t.tx, t.ty)))
  const fresh = new Set((known || [])
    .filter(k => Date.now() - new Date(k.fetched_at).getTime() < STALE_DAYS * 86400000)
    .map(k => k.tile_key))
  const todo = wanted.filter(t => !fresh.has(tileKey(t.tx, t.ty))).slice(0, MAX_TILES_PER_CALL)

  let imported = 0
  const errors: string[] = []
  for (const t of todo) {
    const key = tileKey(t.tx, t.ty)
    // Claim the tile first so two people opening the app together don't both fetch it.
    await admin.from('spot_tiles').upsert({ tile_key: key, fetched_at: new Date().toISOString() })
    try {
      const elements = await fetchTile(t.tx, t.ty)
      const rows = []
      for (const el of elements) {
        const tags = el.tags || {}
        const name = (tags.name || '').trim()
        const la = el.lat ?? el.center?.lat, lo = el.lon ?? el.center?.lon
        const cat = categorize(tags)
        if (!name || name.length > 120 || la == null || lo == null || !cat) continue
        const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
        rows.push({
          source: 'osm', source_id: `${el.type}/${el.id}`, name,
          category: cat.category, kind: cat.kind, latitude: la, longitude: lo,
          address: street || null, city: tags['addr:city'] || null,
          website: tags.website || tags['contact:website'] || null,
          opening_hours: tags.opening_hours || null,
          cuisine: tags.cuisine ? tags.cuisine.split(';')[0].replace(/_/g, ' ') : null,
          tile_key: key, updated_at: new Date().toISOString(),
        })
      }
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from('spots').upsert(rows.slice(i, i + 500), { onConflict: 'source,source_id' })
        if (error) throw new Error(error.message)
      }
      await admin.from('spot_tiles').update({ spot_count: rows.length }).eq('tile_key', key)
      imported += rows.length
    } catch (err) {
      // Release the claim so the next open retries this tile.
      await admin.from('spot_tiles').delete().eq('tile_key', key)
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return json({ tilesFetched: todo.length - errors.length, imported, pending: wanted.length - fresh.size - todo.length + errors.length, errors })
})
