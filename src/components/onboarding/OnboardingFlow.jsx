import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { Bell, Check } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import { updateProfile } from '../../lib/auth.js'
import { uploadAvatar } from '../../lib/storage.js'
import { INTENT_LABELS } from '../../lib/intents.js'
import { INTERESTS } from '../../lib/interests.js'
import { listCircles, isDiscoverable } from '../../lib/circles.js'
import ImageUploader from '../ui/ImageUploader.jsx'
import { useHardwareBack } from '../../lib/hardwareBack.js'
import CityAutocomplete from '../ui/CityAutocomplete.jsx'
import { batteryLevel } from '../battery/SocialBattery.jsx'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

const STEPS = ['You', 'Where', 'Why', 'Interests', 'Get going']
const STEP_KEY = (uid) => `ts.onboarding.step.${uid}`

/**
 * Five short steps (item 5). Every step saves as you go, so quitting halfway
 * keeps what you entered and the flow resumes where you left off. Steps 3+
 * can be skipped. Finishing (or skipping) stamps intent_captured_at.
 */
export default function OnboardingFlow({ onDone }) {
  const { currentUser, refreshProfile, updateMyIntents, joinCircle, joinedCircles } = useAppContext()
  const reduced = useReducedMotion()
  const uid = currentUser?.id

  const [step, setStep] = useState(() => {
    try { return Math.min(Number(window.localStorage.getItem(STEP_KEY(uid))) || 0, STEPS.length - 1) } catch { return 0 }
  })
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(currentUser?.name || '')
  const [avatar, setAvatar] = useState(currentUser?.avatar || '')
  const [city, setCity] = useState(currentUser?.city ? { label: currentUser.city, lat: currentUser.latitude, lng: currentUser.longitude } : null)
  const [age, setAge] = useState(currentUser?.age ? String(currentUser.age) : '')
  const [intents, setIntents] = useState(currentUser?.intents || [])
  const [interests, setInterests] = useState(currentUser?.interests || [])
  const [suggested, setSuggested] = useState([])
  const [joining, setJoining] = useState({})
  const [pushAsked, setPushAsked] = useState(false)

  useEffect(() => {
    try { window.localStorage.setItem(STEP_KEY(uid), String(step)) } catch { /* noop */ }
  }, [step, uid])

  // Suggested circles for the last step, matched to chosen interests.
  useEffect(() => {
    if (step !== 4) return
    let cancelled = false
    listCircles()
      .then(list => {
        if (cancelled) return
        const wanted = new Set(interests.map(i => i.toLowerCase()))
        const open = list.filter(c => isDiscoverable(c) && !joinedCircles.includes(c.id))
        const scored = open
          .map(c => ({ c, score: (wanted.has((c.interestTag || '').toLowerCase()) ? 10 : 0) + Math.min(c.memberCount || 0, 9) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map(x => x.c)
        setSuggested(scored)
      })
      .catch(err => console.error('[Onboarding] listCircles failed', err))
    return () => { cancelled = true }
  }, [step, interests, joinedCircles])

  const go = (next) => {
    setError('')
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  const save = async (patch) => {
    await updateProfile(uid, patch)
    await refreshProfile().catch(() => {})
  }

  const next = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (step === 0) {
        if (!name.trim()) throw new Error('Add your name so people know who you are.')
        await save({ name: name.trim(), ...(avatar ? { avatar_url: avatar } : {}) })
      } else if (step === 1) {
        let ageNum = null
        if (age.trim() !== '') {
          ageNum = Number(age)
          if (!Number.isInteger(ageNum)) throw new Error('Age must be a whole number.')
          if (ageNum < 13 || ageNum > 120) throw new Error('You must be at least 13 to use Third Space.')
        }
        if (!city?.label) throw new Error('Pick your city so we can show you what’s nearby.')
        await save({
          city: city.label,
          ...(city.lat != null ? { latitude: city.lat, longitude: city.lng } : {}),
          ...(ageNum != null ? { age: ageNum } : {}),
        })
      } else if (step === 2) {
        await save({ intents })
      } else if (step === 3) {
        await save({ interests })
      }
      go(step + 1)
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    setBusy(true)
    try {
      await updateMyIntents({ intents, note: currentUser?.intentNote || '' })
      try { window.localStorage.removeItem(STEP_KEY(uid)) } catch { /* noop */ }
      onDone?.()
    } catch (err) {
      setError(err.message || 'Could not finish. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const askPush = async () => {
    setPushAsked(true)
    try {
      const { requestPushPermission } = await import('../../lib/push')
      await requestPushPermission()
    } catch (err) {
      console.error('[Onboarding] push permission failed', err)
    }
  }

  const join = async (circle) => {
    setJoining(j => ({ ...j, [circle.id]: 'busy' }))
    try {
      await joinCircle(circle.id)
      setJoining(j => ({ ...j, [circle.id]: 'done' }))
    } catch (err) {
      console.error('[Onboarding] join failed', err)
      setJoining(j => ({ ...j, [circle.id]: null }))
    }
  }

  // Android Back steps backwards instead of leaving the app mid-setup.
  useHardwareBack(true, () => { if (step > 0) go(step - 1) })

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])

  const chip = (selected) => ({
    padding: '0 16px', borderRadius: 999, height: 40,
    border: 'none',
    backgroundColor: selected ? 'var(--ink)' : 'var(--surface-2)',
    color: selected ? 'var(--on-ink)' : clr.textDark,
    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  })
  const input = {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 14,
    border: `1.5px solid ${clr.border}`, backgroundColor: clr.white, fontSize: 16,
    color: clr.textDark, outline: 'none', fontFamily: 'inherit',
  }
  const level = useMemo(() => batteryLevel(40), [])
  const isNative = Capacitor.isNativePlatform()

  const title = [
    'What should people call you?',
    'Where are you based?',
    'What are you here for?',
    'What are you into?',
    'You’re in',
  ][step]
  const subtitle = [
    'Your name and a photo help people recognize you at meetups.',
    'We use this to show circles and events near you. Your exact location is never shown.',
    'Pick any that fit. You can change this later.',
    'Pick a few. We’ll suggest circles that match.',
    'One last thing before you dive in.',
  ][step]

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" style={{
      position: 'fixed', inset: 0, zIndex: 500, backgroundColor: clr.bg,
      display: 'flex', flexDirection: 'column',
      padding: 'max(16px, env(safe-area-inset-top)) 0 0',
      fontFamily: 'inherit',
    }}>
      {/* Progress */}
      <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Back" style={{
          width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0 : 1,
        }}>
          <svg width="22" height="22" fill="none" stroke="var(--textDark)" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 6 }} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: clr.border, overflow: 'hidden' }}>
              <motion.div
                initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                style={{ height: '100%', backgroundColor: 'var(--ink)' }}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={step >= 2 ? finish : undefined} style={{
          minWidth: 44, height: 44, background: 'none', border: 'none',
          color: clr.textMid, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          visibility: step >= 2 && step < 4 ? 'visible' : 'hidden',
        }}>
          Skip
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={reduced ? false : { x: dir * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? undefined : { x: dir * -40, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ padding: '24px 24px 24px', maxWidth: 520, margin: '0 auto' }}
          >
            <h1 id="onboarding-title" style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: clr.textDark, letterSpacing: '-0.02em' }}>{title}</h1>
            <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.5, color: clr.textMid }}>{subtitle}</p>

            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <ImageUploader
                  currentUrl={avatar || null}
                  shape="circle"
                  label="Add a photo"
                  fallback={
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%', backgroundColor: clr.indigoLt,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 32, fontWeight: 700, color: clr.indigo,
                    }}>
                      {name ? name[0].toUpperCase() : '+'}
                    </div>
                  }
                  onUpload={(file) => uploadAvatar({ userId: uid, file })}
                  onChange={(url) => setAvatar(url)}
                  onRemove={() => setAvatar('')}
                />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" style={input} />
              </div>
            )}

            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <CityAutocomplete value={city} onChange={setCity} clr={clr} />
                <input value={age} onChange={e => setAge(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Age (optional)" style={input} />
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {INTENT_LABELS.map(label => (
                  <button key={label} type="button" aria-pressed={intents.includes(label)} onClick={() => toggle(intents, setIntents, label)} style={chip(intents.includes(label))}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {INTERESTS.map(label => (
                  <button key={label} type="button" aria-pressed={interests.includes(label)} onClick={() => toggle(interests, setInterests, label)} style={chip(interests.includes(label))}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ backgroundColor: clr.white, borderRadius: 18, padding: 16, boxShadow: '0 0 0 1px var(--border)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: clr.textMid, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your social battery</p>
                  <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: level.color }}>{level.word}</p>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: clr.textMid }}>
                    It fills up when you join circles, go to events and message people, and slowly drains when you&apos;re away. It&apos;s a nudge, and only you can see it.
                  </p>
                </div>

                {isNative && (
                  <div style={{ backgroundColor: clr.white, borderRadius: 18, padding: 16, boxShadow: '0 0 0 1px var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Bell size={22} color="var(--indigo)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: clr.textDark }}>Get notified</p>
                      <p style={{ margin: 0, fontSize: 13, color: clr.textMid }}>Messages, invites and requests. Nothing else.</p>
                    </div>
                    <button type="button" onClick={askPush} disabled={pushAsked} style={{
                      minHeight: 40, padding: '8px 14px', borderRadius: 999, border: 'none',
                      backgroundColor: pushAsked ? clr.bg : clr.indigo, color: pushAsked ? clr.textMid : 'var(--on-ink)',
                      fontSize: 14, fontWeight: 700, cursor: pushAsked ? 'default' : 'pointer',
                    }}>
                      {pushAsked ? 'Done' : 'Turn on'}
                    </button>
                  </div>
                )}

                {suggested.length > 0 && (
                  <div>
                    <p style={{ margin: '4px 0 10px', fontSize: 15, fontWeight: 800, color: clr.textDark }}>Circles you might like</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {suggested.map(c => {
                        const state = joining[c.id]
                        return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: clr.white, borderRadius: 16, padding: '12px 14px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                              <p style={{ margin: 0, fontSize: 12, color: clr.textMid }}>{c.memberCount ?? 0} members{c.interestTag ? ` · ${c.interestTag}` : ''}</p>
                            </div>
                            <button type="button" disabled={!!state} onClick={() => join(c)} style={{
                              minHeight: 40, minWidth: 72, padding: '8px 14px', borderRadius: 999, border: 'none',
                              backgroundColor: state === 'done' ? 'var(--surface-2)' : clr.indigo, color: state === 'done' ? 'var(--good)' : 'var(--on-ink)',
                              fontSize: 14, fontWeight: 700, cursor: state ? 'default' : 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            }}>
                              {state === 'done' ? <><Check size={14} /> Joined</> : state === 'busy' ? '…' : 'Join'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <p role="alert" style={{ margin: '16px 0 0', fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{error}</p>}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ padding: '12px 24px calc(16px + env(safe-area-inset-bottom))', maxWidth: 520, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" onClick={step === 4 ? finish : next} disabled={busy} style={{
          width: '100%', minHeight: 52, borderRadius: 999, border: 'none',
          background: 'var(--indigo)', color: 'var(--on-ink)',
          fontSize: 17, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'Saving…' : step === 4 ? 'Start exploring' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
