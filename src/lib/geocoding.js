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
    headers: { Accept: 'application/json' },
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
    headers: { Accept: 'application/json' },
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
