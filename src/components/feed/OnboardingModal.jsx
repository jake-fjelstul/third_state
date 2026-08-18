import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { INTENT_LABELS } from '../../lib/intents'
import { PartyPopper } from 'lucide-react'

export default function OnboardingModal({ inviter, showIntent, onClose }) {
  const navigate = useNavigate()
  const { currentUser, updateMyIntents, skipIntentCapture, clearRecentInviter, startDM } = useAppContext()

  const [selectedIntents, setSelectedIntents] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Prefill from existing values if any
  useEffect(() => {
    if (currentUser?.intents) setSelectedIntents(currentUser.intents)
    if (currentUser?.intentNote) setNote(currentUser.intentNote)
  }, [currentUser?.intents, currentUser?.intentNote])

  const handleSayHiOnly = async () => {
    if (!inviter?.id || busy) return
    setBusy(true)
    try {
      clearRecentInviter()
      const chatId = await startDM(inviter)
      onClose()
      navigate(`/chat/${chatId}`)
    } catch (err) {
      console.error('[OnboardingModal] startDM failed', err)
      setBusy(false)
    }
  }

  const handleDoneOnly = () => {
    clearRecentInviter()
    onClose()
  }

  const handleSaveAndSkipChat = async () => {
    if (busy) return
    setBusy(true)
    try {
      await updateMyIntents({ intents: selectedIntents, note: note.trim() })
      if (inviter) clearRecentInviter()
      onClose()
    } catch (err) {
      console.error('[OnboardingModal] save failed', err)
      setBusy(false)
    }
  }

  const handleSaveAndSayHi = async () => {
    if (busy) return
    setBusy(true)
    try {
      await updateMyIntents({ intents: selectedIntents, note: note.trim() })
      if (inviter?.id) {
        clearRecentInviter()
        const chatId = await startDM(inviter)
        navigate(`/chat/${chatId}`)
      }
      onClose()
    } catch (err) {
      console.error('[OnboardingModal] save and chat failed', err)
      setBusy(false)
    }
  }

  const handleSkipEverything = async () => {
    if (busy) return
    setBusy(true)
    try {
      await skipIntentCapture()
      if (inviter) clearRecentInviter()
      onClose()
    } catch (err) {
      console.error('[OnboardingModal] skip failed', err)
      setBusy(false)
    }
  }

  const canSave = selectedIntents.length > 0 || note.trim() !== ''
  const firstName = (inviter?.name || '').split(' ')[0] || 'them'

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) {
        if (!showIntent) handleDoneOnly()
        else handleSkipEverything()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busy, showIntent, inviter])

  return (
    <div
      onClick={busy ? undefined : () => {
        if (!showIntent) handleDoneOnly()
        else handleSkipEverything()
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
          backgroundColor: 'var(--white)', borderRadius: 24,
          padding: '32px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
          animation: 'celebrationPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div style={{ animation: 'stepIn 0.22s ease-out' }}>
          
          {/* Header Section (Celebration) */}
          {inviter && (
            <div style={{ textAlign: 'center', marginBottom: showIntent ? 24 : 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <PartyPopper size={56} color="var(--indigo)" style={{ marginBottom: 12 }} />
              <img
                src={inviter?.avatar || ''}
                alt=""
                style={{
                  width: 88, height: 88, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid var(--white)',
                  boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
                  marginBottom: 16,
                }}
              />
              <h2 style={{
                margin: '0 0 8px',
                fontSize: 22, fontWeight: 800,
                color: 'var(--textDark)',
                fontFamily: "'DM Serif Display','Georgia',serif",
              }}>
                You and {firstName} are now friends!
              </h2>
              {!showIntent && (
                <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--textMid)' }}>
                  Welcome to Third Space. Let's get you set up.
                </p>
              )}
            </div>
          )}

          {/* Divider if both exist */}
          {inviter && showIntent && (
            <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '0 0 24px 0' }} />
          )}

          {/* Body Section (Intent) */}
          {showIntent && (
            <div>
              <h2 style={{
                margin: '0 0 8px',
                fontSize: 22, fontWeight: 800,
                color: 'var(--textDark)',
                fontFamily: "'DM Serif Display','Georgia',serif",
                textAlign: 'center',
              }}>
                Why are you here?
              </h2>
              <p style={{
                margin: '0 0 20px',
                fontSize: 14, color: 'var(--textMid)',
                textAlign: 'center',
              }}>
                Tap what fits. You can update this anytime in your Profile.
              </p>
        
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
                {INTENT_LABELS.map(label => {
                  const active = selectedIntents.includes(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setSelectedIntents(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label])
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 999,
                        border: `1.5px solid ${active ? 'var(--indigo)' : 'var(--border)'}`,
                        backgroundColor: active ? 'var(--indigoLt)' : 'var(--bg)',
                        color: active ? 'var(--indigo)' : 'var(--textMid)',
                        fontSize: 14, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
        
              <p style={{
                margin: '0 0 8px',
                fontSize: 13, fontWeight: 700,
                color: 'var(--textDark)',
              }}>
                Anything more specific?
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. I just moved here and want to find a casual hiking group on weekends…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 14,
                  border: '1.5px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--textDark)',
                  fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                  marginBottom: 24,
                }}
              />
            </div>
          )}

          {/* Footer Section (Buttons) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Scenario 1: Both Celebration and Intent */}
            {inviter && showIntent && (
              <>
                <button
                  type="button"
                  onClick={handleSaveAndSayHi}
                  disabled={busy || !canSave}
                  style={{
                    width: '100%', padding: 14, borderRadius: 999, border: 'none',
                    background: (busy || !canSave) ? '#A5B4FC' : 'linear-gradient(135deg, var(--indigo), #7B6FFF)',
                    color: '#FFF', fontSize: 15, fontWeight: 800,
                    cursor: (busy || !canSave) ? 'not-allowed' : 'pointer',
                    boxShadow: (busy || !canSave) ? 'none' : '0 8px 20px rgba(91,95,239,0.25)',
                    opacity: (busy || !canSave) ? 0.85 : 1,
                  }}
                >
                  {busy ? 'Saving…' : `Save & Say hi to ${firstName}`}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndSkipChat}
                  disabled={busy || !canSave}
                  style={{
                    width: '100%', padding: 14, borderRadius: 999,
                    border: `1.5px solid ${canSave ? 'var(--indigo)' : 'var(--border)'}`,
                    backgroundColor: 'var(--white)',
                    color: canSave ? 'var(--indigo)' : 'var(--textMid)',
                    fontSize: 15, fontWeight: 700,
                    cursor: (busy || !canSave) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleSkipEverything}
                  disabled={busy}
                  style={{
                    width: '100%', padding: 14, borderRadius: 999, border: 'none', background: 'none',
                    color: 'var(--textMid)', fontSize: 15, fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                >
                  Skip
                </button>
              </>
            )}

            {/* Scenario 2: Celebration Only (intent already captured) */}
            {inviter && !showIntent && (
              <>
                <button
                  type="button"
                  onClick={handleSayHiOnly}
                  disabled={busy}
                  style={{
                    width: '100%', padding: 14, borderRadius: 999, border: 'none',
                    background: 'linear-gradient(135deg, var(--indigo), #7B6FFF)',
                    color: '#FFF', fontSize: 15, fontWeight: 800,
                    cursor: busy ? 'wait' : 'pointer',
                    boxShadow: '0 8px 20px rgba(91,95,239,0.25)',
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? 'Opening…' : `Say hi to ${firstName}`}
                </button>
                <button
                  type="button"
                  onClick={handleDoneOnly}
                  disabled={busy}
                  style={{
                    width: '100%', padding: 14, borderRadius: 999,
                    border: '1.5px solid var(--indigo)',
                    backgroundColor: 'var(--white)',
                    color: 'var(--indigo)',
                    fontSize: 15, fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                >
                  Done
                </button>
              </>
            )}

            {/* Scenario 3: Intent Only (no inviter) */}
            {!inviter && showIntent && (
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  type="button"
                  onClick={handleSkipEverything}
                  disabled={busy}
                  style={{
                    flex: 1, padding: 14, borderRadius: 999,
                    border: '1.5px solid var(--border)',
                    backgroundColor: 'var(--white)',
                    color: 'var(--textMid)',
                    fontSize: 15, fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndSkipChat}
                  disabled={busy || !canSave}
                  style={{
                    flex: 2, padding: 14, borderRadius: 999, border: 'none',
                    background: (busy || !canSave) ? '#A5B4FC' : 'linear-gradient(135deg, var(--indigo), #7B6FFF)',
                    color: '#FFF', fontSize: 15, fontWeight: 800,
                    cursor: (busy || !canSave) ? 'not-allowed' : 'pointer',
                    boxShadow: (busy || !canSave) ? 'none' : '0 8px 20px rgba(91,95,239,0.25)',
                    opacity: (busy || !canSave) ? 0.85 : 1,
                  }}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
