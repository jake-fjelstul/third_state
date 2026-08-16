import { useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import CircleIcon from '../ui/CircleIcon.jsx'
import { checkContent } from '../../lib/contentFilter'

const clr = {
  bg:        '#181922',
  panel:     '#1E1F2B',
  panelAlt:  '#23243A',
  inputBg:   '#2A2B3D',
  border:    '#363849',
  textDark:  '#E2E4F0',
  textMid:   '#8B8FA3',
  textLight: '#5C5F73',
  indigo:    '#7B6FFF',
  indigoLt:  'rgba(123, 111, 255, 0.18)',
  white:     '#FFFFFF',
  amber:     '#F59E0B',
  green:     '#34D399',
  greenLt:   'rgba(52, 211, 153, 0.18)',
  red:       '#F87171',
  redLt:     'rgba(248, 113, 113, 0.18)',
}

export default function HoopApplication({ circle, onClose, onSubmitted }) {
  const { currentUser, submitApplication } = useAppContext()
  const [step, setStep] = useState(0) // 0=Overview, 1..N=Hoops, N+1=Review, N+2=Success
  const [responses, setResponses] = useState({})
  const [errorMsg, setErrorMsg] = useState('')
  
  const hoops = circle.hoops || []
  const totalSteps = hoops.length

  const handleNext = () => {
    if (step > 0 && step <= totalSteps) {
      const hoopIndex = step - 1
      const h = hoops[hoopIndex]
      if (h.type === 'written') {
        const resp = responses[h.id] || ''
        const check = checkContent(resp)
        if (!check.ok) {
          setErrorMsg(check.reason)
          return
        }
      }
    }
    setErrorMsg('')
    setStep(s => s + 1)
  }

  const handleBack = () => {
    setErrorMsg('')
    setStep(s => s - 1)
  }

  const handleSubmit = async () => {
    for (const h of hoops) {
      if (h.type === 'written') {
        const resp = responses[h.id] || ''
        const check = checkContent(resp)
        if (!check.ok) {
          setErrorMsg(check.reason)
          return
        }
      }
    }
    setErrorMsg('')
    try {
      await submitApplication({ circle, responses })
      onSubmitted?.(circle.id)
      setStep(totalSteps + 2) // Jump to Success
    } catch (err) {
      console.error('[HoopApplication] submit failed', err)
      alert('Sorry — something went wrong submitting your application. Please try again.')
    }
  }

  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: `linear-gradient(135deg, ${clr.indigo}, #5B5FEF)`, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircleIcon circle={circle} size={36} color="#FFFFFF" />
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, margin: '0 0 8px' }}>Join {circle.name}</h2>
        <p style={{ fontSize: 16, color: clr.textMid, margin: '0 0 32px' }}>Complete these steps to apply.</p>
        
        <div style={{ backgroundColor: clr.panel, borderRadius: 20, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.05)', textAlign: 'left' }}>
          {hoops.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: i === hoops.length -1 ? 0 : 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: clr.indigoLt, color: clr.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: clr.indigo, textTransform: 'uppercase' }}>
                  {h.type === 'written' ? 'Short Answer' : 'Multiple Choice'}
                </p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: clr.textDark }}>{h.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ padding: 24, borderTop: `1px solid ${clr.border}`, backgroundColor: clr.panel }}>
        <button onClick={handleNext} style={{ width: '100%', padding: 18, borderRadius: 999, border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #5B5FEF)`, color: clr.white, fontSize: 16, fontWeight: 800, cursor: 'pointer', marginBottom: 12 }}>
          Start Application
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 18, borderRadius: 999, border: 'none', background: 'transparent', color: clr.textMid, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )

  const renderHoop = () => {
    const hoopIndex = step - 1
    const h = hoops[hoopIndex]
    const currentResponse = responses[h.id] || ''
    
    // Validation
    let isValid = false
    if (h.type === 'written') isValid = currentResponse.length >= 10
    else if (h.type === 'multiplechoice') isValid = !!currentResponse

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '24px', borderBottom: `1px solid ${clr.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={handleBack} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: clr.border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ width: '100%', height: 6, backgroundColor: clr.indigoLt, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${((hoopIndex + 1) / totalSteps) * 100}%`, height: '100%', backgroundColor: clr.indigo, transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: clr.textMid }}>Step {hoopIndex + 1} of {totalSteps}</p>
          </div>
        </div>

        <div style={{ flex: 1, padding: '32px 24px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: clr.textDark, margin: '0 0 24px', lineHeight: 1.3 }}>
            {h.prompt}
          </h2>

          {errorMsg && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, backgroundColor: clr.redLt, color: clr.red, fontSize: 14, fontWeight: 700 }}>
              {errorMsg}
            </div>
          )}

          {h.type === 'written' && (
            <div>
              <textarea
                value={currentResponse}
                onChange={e => setResponses(prev => ({ ...prev, [h.id]: e.target.value }))}
                placeholder="Be yourself — organizers appreciate genuine answers..."
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 180, padding: 20, borderRadius: 20, border: `2px solid ${clr.border}`, backgroundColor: clr.inputBg, fontSize: 16, color: clr.textDark, outline: 'none', resize: 'none' }}
              />
              <p style={{ textAlign: 'right', fontSize: 12, color: currentResponse.length < 10 ? clr.textLight : clr.indigo, marginTop: 8, fontWeight: 600 }}>
                {currentResponse.length} / 500
              </p>
            </div>
          )}

          {h.type === 'multiplechoice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {h.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => setResponses(prev => ({ ...prev, [h.id]: opt }))}
                  style={{
                    width: '100%', padding: '20px 24px', borderRadius: 20, textAlign: 'left', fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease',
                    border: currentResponse === opt ? `2px solid ${clr.indigo}` : `2px solid ${clr.border}`,
                    backgroundColor: currentResponse === opt ? clr.indigoLt : clr.inputBg,
                    color: currentResponse === opt ? clr.indigo : clr.textDark
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

        </div>
        
        <div style={{ padding: 24, borderTop: `1px solid ${clr.border}`, backgroundColor: clr.panel }}>
          <button 
            disabled={!isValid}
            onClick={handleNext} 
            style={{ width: '100%', padding: 18, borderRadius: 999, border: 'none', background: isValid ? `linear-gradient(135deg, ${clr.indigo}, #5B5FEF)` : clr.border, color: isValid ? clr.white : clr.textLight, fontSize: 16, fontWeight: 800, cursor: isValid ? 'pointer' : 'not-allowed' }}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  const renderReview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px', borderBottom: `1px solid ${clr.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={handleBack} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: clr.border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }}>
          ←
        </button>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: clr.textDark }}>Review Application</h3>
      </div>
      
      <div style={{ flex: 1, padding: '32px 24px', overflowY: 'auto' }}>
        {hoops.map((h, i) => (
          <div key={h.id} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: clr.indigo, textTransform: 'uppercase' }}>Step {i+1}</p>
              <button onClick={() => setStep(i + 1)} style={{ background: 'none', border: 'none', color: clr.textMid, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: clr.textDark }}>{h.prompt}</p>
            <div style={{ padding: 16, backgroundColor: clr.panel, borderRadius: 16, border: `1px solid ${clr.border}` }}>
              <p style={{ margin: 0, fontSize: 15, color: clr.textMid, lineHeight: 1.5 }}>
                {responses[h.id]}
              </p>
            </div>
          </div>
        ))}

        <p style={{ fontSize: 13, color: clr.textLight, textAlign: 'center', marginTop: 16 }}>
          By submitting, you agree to share your profile and responses with the circle organizer.
        </p>
      </div>

      <div style={{ padding: 24, borderTop: `1px solid ${clr.border}`, backgroundColor: clr.panel }}>
        <button onClick={handleSubmit} style={{ width: '100%', padding: 18, borderRadius: 999, border: 'none', background: `linear-gradient(135deg, ${clr.indigo}, #5B5FEF)`, color: clr.white, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          Submit Application
        </button>
      </div>
    </div>
  )

  const renderSuccess = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', backgroundColor: clr.panel }}>
      <div style={{ width: 100, height: 100, borderRadius: '50%', backgroundColor: clr.greenLt, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <svg width="48" height="48" fill="none" stroke={clr.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: clr.textDark, margin: '0 0 12px' }}>Application Submitted!</h2>
      <p style={{ fontSize: 16, color: clr.textMid, margin: '0 0 40px', lineHeight: 1.5 }}>
        The organizer will review your application and notify you within a few days.
      </p>
      <button onClick={onClose} style={{ width: '100%', padding: 18, borderRadius: 999, border: `2px solid ${clr.border}`, background: 'transparent', color: clr.textDark, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
        Return to Circle
      </button>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: clr.bg, animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      {step === 0 && renderOverview()}
      {step > 0 && step <= totalSteps && renderHoop()}
      {step === totalSteps + 1 && renderReview()}
      {step > totalSteps + 1 && renderSuccess()}
    </div>
  )
}
