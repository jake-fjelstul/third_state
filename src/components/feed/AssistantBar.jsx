import { Search, X } from 'lucide-react'

/*
 * Search field (design v2): one quiet rounded field, no glow. Typing filters
 * the Feed live; return just dismisses the keyboard. Tapping the field opens
 * search (suggestions show until you type); Cancel closes it.
 */
export default function AssistantBar({ onSubmit, value, onChange, placeholder, active, onFocus, onCancel }) {
  // Return dismisses the keyboard so the results underneath are visible.
  // The text stays; results are already live below the field.
  const submit = (e) => {
    e?.preventDefault?.()
    e?.currentTarget?.querySelector?.('input')?.blur()
    onSubmit?.((value || '').trim())
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 8px' }}>
    <form onSubmit={submit} role="search" data-tour="search" style={{
      flex: 1, minWidth: 0, height: 40, borderRadius: 12, background: 'var(--surface-2)',
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px',
    }}>
      <Search size={18} color="var(--textLight)" aria-hidden="true" style={{ flexShrink: 0 }} />
      <input
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
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
    <button
      type="button"
      onClick={(e) => { e.currentTarget.parentElement.querySelector('input')?.blur(); onCancel?.() }}
      aria-hidden={!active}
      tabIndex={active ? 0 : -1}
      style={{
        border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        fontSize: 16, color: 'var(--textDark)', height: 40, overflow: 'hidden', whiteSpace: 'nowrap',
        width: active ? 68 : 0, padding: 0, opacity: active ? 1 : 0, textAlign: 'right',
        transition: 'width 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
      }}
    >Cancel</button>
    </div>
  )
}
