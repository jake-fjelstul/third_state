import { useEffect, useRef, useState } from 'react'
import { reverseGeocode, searchVenues } from '../../lib/geocoding'

export default function LocationAutocomplete({ 
  value, 
  onChange, 
  biasNear, 
  placeholder = 'Coffee shop, park, address…', 
  clr 
}) {
  const [query, setQuery] = useState(value?.name || value?.address || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    setQuery(value?.name || value?.address || '')
  }, [value?.name, value?.address])

  const onInput = (e) => {
    const q = e.target.value
    setQuery(q)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    
    // Clear the selected value since the user is typing something new
    if (value) onChange(null)

    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const list = await searchVenues(q, { near: biasNear, signal: ctrl.signal })
        setResults(list)
      } catch (err) {
        if (err.name !== 'AbortError') console.error('[LocationAutocomplete] search failed', err)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const pick = (item) => {
    // searchVenues returns { name, address, lat, lng }
    onChange({ name: item.name, address: item.address, lat: item.lat, lng: item.lng })
    setQuery(item.name || item.address)
    setOpen(false)
    setResults([])
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const item = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          // reverseGeocode returns { label, lat, lng }
          // Map to the shape expected by onChange
          const loc = { name: item.label, address: item.label, lat: item.lat, lng: item.lng }
          onChange(loc)
          setQuery(loc.name)
          setOpen(false)
          setResults([])
        } catch (err) {
          console.error('[LocationAutocomplete] reverse failed', err)
        }
      },
      (err) => console.error('[LocationAutocomplete] geolocation denied', err),
      { timeout: 10000 }
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 14px',
          paddingLeft: 40,
          borderRadius: 12,
          border: `1.5px solid ${clr?.border || '#E5E7EB'}`,
          backgroundColor: clr?.bg || '#FFF',
          fontSize: 16,
          color: clr?.textDark || '#111',
          outline: 'none',
          fontFamily: 'inherit',
        }}
        onFocus={(e) => { e.target.style.borderColor = clr?.indigo || '#5B5FEF'; setOpen(true); }}
        onBlur={(e) => { e.target.style.borderColor = clr?.border || '#E5E7EB'; setTimeout(() => setOpen(false), 150); }}
      />
      <svg width="16" height="16" fill="none" stroke={clr?.textLight || '#9CA3AF'} strokeWidth="2" viewBox="0 0 24 24"
        style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <button
        type="button"
        onClick={useMyLocation}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: clr?.indigo || '#5B5FEF',
        }}
      >
        📍
      </button>

      {open && (results.length > 0 || loading || (query.trim().length >= 2 && results.length === 0)) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: clr?.white || '#FFF',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: `1px solid ${clr?.border || '#E5E7EB'}`,
            zIndex: 100,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {loading && <div style={{ padding: 12, fontSize: 13, color: clr?.textMid || '#666' }}>Searching...</div>}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div style={{ padding: 12, fontSize: 13, color: clr?.textMid || '#666' }}>
              No matches. Tap a result above or type a different name.
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.name}-${i}`}
              type="button"
              onMouseDown={() => pick(r)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                borderBottom: i < results.length - 1 ? `1px solid ${clr?.border || '#F1F1F1'}` : 'none',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: clr?.textDark || '#111', margin: '0 0 2px 0' }}>
                {r.name || r.address}
              </div>
              {r.address && r.address !== r.name && (
                <div style={{ fontSize: 12, color: clr?.textMid || '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.address}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
