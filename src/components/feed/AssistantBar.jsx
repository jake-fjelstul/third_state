import { useEffect, useRef, useState } from 'react'

const EXAMPLES = [
  'find people into hiking',
  'circles about photography',
  'events this weekend',
  'create a yoga circle',
  'host a coffee meetup Saturday',
  'meet someone new',
]

export default function AssistantBar({ onSubmit, clr, value, onChange, placeholder }) {
  const [exampleIdx, setExampleIdx] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setExampleIdx(i => (i + 1) % EXAMPLES.length)
    }, 4000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const submit = (e) => {
    e?.preventDefault?.()
    const t = (value || '').trim()
    onSubmit(t)
    onChange?.('')
  }

  // Tapping the rotating example auto-submits that prompt.
  const submitExample = () => {
    onSubmit(EXAMPLES[exampleIdx])
    onChange?.('')
  }

  return (
    <section style={{ marginBottom: 24 }}>
      {/* Shimmer wrapper: static color ring with a gliding highlight */}
      <div
        style={{
          position: 'relative',
          borderRadius: 24,
          padding: 2,
          overflow: 'hidden',
          isolation: 'isolate',
          // iOS Safari does not reliably clip transformed children with
          // overflow:hidden + border-radius alone.
          clipPath: 'inset(0 round 24px)',
          WebkitClipPath: 'inset(0 round 24px)',
          transform: 'translateZ(0)',
          boxShadow: '0 0 22px rgba(99,102,241,0.14), 0 4px 14px rgba(0,0,0,0.10)',
        }}
      >
        {/* Layer 1 — static colorful base. Defines the border's color identity. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-100%',
            background:
              'conic-gradient(from 0deg, ' +
              '#4340A8 0deg, ' +
              '#5B4CBF 72deg, ' +
              '#8E4A8C 144deg, ' +
              '#A8556A 216deg, ' +
              '#A87A3C 288deg, ' +
              '#4340A8 360deg)',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Layer 2 — rotating bright highlight overlay. Mostly transparent. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-100%',
            background:
              'conic-gradient(from 0deg, ' +
              'transparent 0deg, ' +
              'transparent 74deg, ' +
              'rgba(255,255,255,0.34) 90deg, ' +
              'rgba(255,255,255,0.72) 100deg, ' +
              'rgba(255,255,255,0.34) 110deg, ' +
              'transparent 128deg, ' +
              'transparent 360deg)',
            animation: 'shimmerSpin 5s linear infinite',
            mixBlendMode: 'screen',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Inner card — sits on top, only 2px ring of gradient shows at edges */}
        <form
          onSubmit={submit}
          style={{
            position: 'relative',
            zIndex: 2,
            backgroundColor: clr.white,
            borderRadius: 22,
            padding: '16px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              value={value || ''}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={placeholder || 'What are you looking for?'}
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 16,
                fontWeight: 600,
                color: clr.textDark,
                backgroundColor: 'transparent',
                fontFamily: 'inherit',
                minWidth: 0,
                padding: 0,
                margin: 0,
                lineHeight: '20px',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                border: 'none',
                background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
                color: '#FFF',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
                flexShrink: 0,
              }}
            >
              Ask
            </button>
          </div>

          {/* Rotating example row — tappable */}
          <div style={{ overflow: 'hidden', minHeight: 18 }}>
            <button
              key={EXAMPLES[exampleIdx]}
              type="button"
              onClick={submitExample}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                textAlign: 'left',
                color: clr.textMid,
                fontSize: 12,
                fontStyle: 'italic',
                fontFamily: 'inherit',
                lineHeight: '18px',
                animation: 'exampleFade 0.4s ease',
                opacity: 0.7,
                width: '100%',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
              aria-label={`Try: ${EXAMPLES[exampleIdx]}`}
            >
              Try:{' '}
              <span style={{ color: clr.indigo, fontStyle: 'normal', fontWeight: 700 }}>
                "{EXAMPLES[exampleIdx]}"
              </span>
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
