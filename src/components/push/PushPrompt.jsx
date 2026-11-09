import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Bell } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import { PUSH_MOMENT_EVENT } from '../../lib/pushMoment.js'
import { useHardwareBack } from '../../lib/hardwareBack.js'

const clr = {
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  border: 'var(--border)',
}

const STATE_KEY = 'ts.pushPrompt'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000


async function readState() {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: STATE_KEY })
    return value ? JSON.parse(value) : { dismissals: 0, snoozeUntil: 0 }
  } catch { return { dismissals: 0, snoozeUntil: 0 } }
}

async function writeState(state) {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: STATE_KEY, value: JSON.stringify(state) })
  } catch { /* noop */ }
}

/**
 * Friendly explainer before the OS permission dialog (audit H5, item 8).
 * Shown once after onboarding; if dismissed, it may come back once more at
 * the next natural moment after the 7-day snooze. Settings still has the
 * manual toggle after that.
 */
export default function PushPrompt() {
  const { currentUser } = useAppContext()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const onboarded = !!currentUser?.intentCapturedAt

  const maybeShow = useCallback(async ({ moment }) => {
    if (!Capacitor.isNativePlatform()) return
    const { getPushPermission } = await import('../../lib/push')
    const perm = await getPushPermission()
    if (perm !== 'prompt' && perm !== 'prompt-with-rationale') return
    const st = await readState()
    if (st.dismissals >= 2) return
    if (Date.now() < (st.snoozeUntil || 0)) return
    // First showing: right after onboarding. Second: only at a natural moment.
    if (st.dismissals === 1 && !moment) return
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!onboarded) return
    const t = setTimeout(() => { maybeShow({ moment: false }) }, 1500)
    return () => clearTimeout(t)
  }, [onboarded, maybeShow])

  useEffect(() => {
    const onMoment = () => { if (onboarded) maybeShow({ moment: true }) }
    window.addEventListener(PUSH_MOMENT_EVENT, onMoment)
    return () => window.removeEventListener(PUSH_MOMENT_EVENT, onMoment)
  }, [onboarded, maybeShow])

  const turnOn = async () => {
    setBusy(true)
    try {
      const { requestPushPermission } = await import('../../lib/push')
      await requestPushPermission()
    } catch (err) {
      console.error('[PushPrompt] requestPushPermission failed', err)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  const notNow = async () => {
    const st = await readState()
    await writeState({ dismissals: (st.dismissals || 0) + 1, snoozeUntil: Date.now() + SNOOZE_MS })
    setOpen(false)
  }

  useHardwareBack(open, notNow)

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="push-prompt-title" style={{
      position: 'fixed', inset: 0, zIndex: 400, backgroundColor: 'rgba(15,15,30,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={notNow}>
      <div onClick={e => e.stopPropagation()} className="ts-sheet-up" style={{
        width: '100%', maxWidth: 520, backgroundColor: clr.white,
        borderRadius: '24px 24px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom))',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', backgroundColor: clr.indigoLt,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
        }}>
          <Bell size={26} color="var(--indigo)" />
        </div>
        <h2 id="push-prompt-title" style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: clr.textDark }}>
          Don't miss your people
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.5, color: clr.textMid }}>
          Get a heads-up when someone messages you, wants to connect, or invites you to something.
          No marketing, ever. You can change this in Settings.
        </p>
        <button type="button" onClick={turnOn} disabled={busy} style={{
          width: '100%', padding: '15px 0', borderRadius: 999, border: 'none',
          background: 'linear-gradient(135deg, #5B5FEF 0%, #7B6FFF 100%)', color: '#fff',
          fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 10, minHeight: 44,
        }}>
          {busy ? 'One sec…' : 'Turn on notifications'}
        </button>
        <button type="button" onClick={notNow} style={{
          width: '100%', padding: '12px 0', borderRadius: 999, border: 'none',
          background: 'transparent', color: clr.textMid, fontSize: 15, fontWeight: 600, cursor: 'pointer', minHeight: 44,
        }}>
          Not now
        </button>
      </div>
    </div>
  )
}
