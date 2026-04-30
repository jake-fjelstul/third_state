import { useEffect, useRef, useState } from 'react'
import { reverseGeocode, searchCities } from '../../lib/geocoding'

export default function CityAutocomplete({ value, onChange, placeholder = 'Start typing a city...', clr }) {
  const [query, setQuery] = useState(value?.label || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    setQuery(value?.label || '')
  }, [value?.label])

  const onInput = (e) => {
    const q = e.target.value
    setQuery(q)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
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
        const list = await searchCities(q, { signal: ctrl.signal })
        setResults(list)
      } catch (err) {
        if (err.name !== 'AbortError') console.error('[CityAutocomplete] search failed', err)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const pick = (item) => {
    onChange(item)
    setQuery(item.label)
    setOpen(false)
    setResults([])
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const item = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          pick(item)
        } catch (err) {
          console.error('[CityAutocomplete] reverse failed', err)
        }
      },
      (err) => console.error('[CityAutocomplete] geolocation denied', err),
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
          borderRadius: 12,
          border: `1.5px solid ${clr?.border || '#E5E7EB'}`,
          backgroundColor: clr?.white || '#FFF',
          fontSize: 15,
          color: clr?.textDark || '#111',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
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

      {open && (results.length > 0 || loading) && (
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
          {results.map((r, i) => (
            <button
              key={`${r.label}-${i}`}
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
                fontSize: 14,
                color: clr?.textDark || '#111',
                fontFamily: 'inherit',
                borderBottom: i < results.length - 1 ? `1px solid ${clr?.border || '#F1F1F1'}` : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
