import { Search, X } from 'lucide-react'

/*
 * Search field (design v2): one quiet rounded field, no glow. Typing filters
 * the Feed live; return just dismisses the keyboard.
 */
export default function AssistantBar({ onSubmit, value, onChange, placeholder }) {
  // Return dismisses the keyboard so the results underneath are visible.
  // The text stays; results are already live below the field.
  const submit = (e) => {
    e?.preventDefault?.()
    e?.currentTarget?.querySelector?.('input')?.blur()
    onSubmit?.((value || '').trim())
  }

  return (
    <form onSubmit={submit} role="search" data-tour="search" style={{
      height: 40, borderRadius: 12, background: 'var(--surface-2)',
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', margin: '0 0 8px',
    }}>
      <Search size={18} color="var(--textLight)" aria-hidden="true" style={{ flexShrink: 0 }} />
      <input
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || 'Search people, circles, events'}
        aria-label="Search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        style={{
          flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
          fontSize: 16, color: 'var(--textDark)', fontFamily: 'inherit', padding: 0,
          appearance: 'none', WebkitAppearance: 'none',
        }}
      />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange?.('')} style={{
          width: 28, height: 28, border: 'none', background: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--textLight)',
        }}>
          <X size={16} />
        </button>
      ) : null}
    </form>
  )
}
