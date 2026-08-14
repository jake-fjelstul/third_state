const NOMINATIM = 'https://nominatim.openstreetmap.org'

function formatCityLabel(row) {
  const a = row?.address || {}
  const city = a.city || a.town || a.village || a.hamlet || a.county || ''
  const region = a.state || a.region || ''
  const country = a.country_code ? a.country_code.toUpperCase() : ''
  return [city, region, country].filter(Boolean).join(', ')
}

export async function searchCities(query, { signal } = {}) {
  if (!query || query.trim().length < 2) return []
  const params = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    'accept-language': 'en',
    featuretype: 'city',
  })
  const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'ThirdSpace/1.0' },
    signal,
  })
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`)
  const rows = await res.json()
  return (rows || [])
    .filter((r) =>
      r.addresstype === 'city' ||
      r.addresstype === 'town' ||
      r.addresstype === 'village' ||
      r.type === 'administrative'
    )
    .map((r) => ({
      label: formatCityLabel(r),
      lat: Number.parseFloat(r.lat),
      lng: Number.parseFloat(r.lon),
      raw: r,
    }))
}

export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'en',
  })
  const res = await fetch(`${NOMINATIM}/reverse?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'ThirdSpace/1.0' },
  })
  if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.status}`)
  const row = await res.json()
  return {
    label: formatCityLabel(row),
    lat: Number.parseFloat(row.lat),
    lng: Number.parseFloat(row.lon),
    raw: row,
  }
}

/**
 * Search for venues, businesses, parks, addresses — anything Nominatim returns
 * that isn't filtered to administrative places.
 *
 * @param {string} query
 * @param {object} [opts]
 * @param {{lat:number,lng:number}} [opts.near] - center to bias results toward
 * @param {number} [opts.radiusMeters=50000] - ~50km default
 * @param {AbortSignal} [opts.signal]
 */
export async function searchVenues(query, { near, radiusMeters = 50000, signal } = {}) {
  if (!query || query.trim().length < 2) return []
  const params = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    addressdetails: '1',
    namedetails: '1',
    limit: '8',
    'accept-language': 'en',
  })
  if (near?.lat != null && near?.lng != null) {
    // Bounding box around `near` — Nominatim uses (lon_min,lat_min,lon_max,lat_max).
    const dLat = radiusMeters / 111000
    const dLng = radiusMeters / (111000 * Math.cos(near.lat * Math.PI / 180))
    params.set('viewbox', [
      near.lng - dLng, near.lat - dLat,
      near.lng + dLng, near.lat + dLat,
    ].join(','))
    params.set('bounded', '1')
  }
  const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'ThirdSpace/1.0' },
    signal,
  })
  if (!res.ok) throw new Error(`Venue search failed: ${res.status}`)
  const rows = await res.json()
  return (rows || []).map((r) => ({
    name: r.namedetails?.name || r.display_name?.split(',')[0] || '',
    address: r.display_name || '',
    lat: Number.parseFloat(r.lat),
    lng: Number.parseFloat(r.lon),
    raw: r,
  }))
}

/**
 * Build a cross-platform Google Maps URL for a location.
 * Works on iOS Safari (opens Maps or Google Maps app), Android (Google Maps),
 * and desktop browsers.
 */
export function buildMapsUrl({ lat, lng, name, address }) {
  if (lat != null && lng != null) {
    const label = encodeURIComponent(name || address || 'Meetup location')
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${label}`
  }
  const q = encodeURIComponent([name, address].filter(Boolean).join(' ') || 'location')
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}
