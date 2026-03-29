import { useState } from 'react'
import { useAppContext } from '../../context/AppContext'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  red: '#EF4444',
  redLt: '#FEE2E2',
}

export default function HoopBuilder({ hoops, onChange }) {
  const handleAdd = () => {
    if (hoops.length >= 3) return
    const newHoop = {
      id: `hoop-${Date.now()}`,
      type: 'written',
      prompt: '',
      order: hoops.length + 1
    }
    onChange([...hoops, newHoop])
  }

  const handleUpdate = (id, field, value) => {
    onChange(hoops.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  const handleRemove = (id) => {
    const next = hoops.filter(h => h.id !== id).map((h, i) => ({ ...h, order: i + 1 }))
    onChange(next)
  }

  const addOption = (hoopId) => {
    onChange(hoops.map(h => {
      if (h.id === hoopId) {
        return { ...h, options: [...(h.options || []), 'New Option'] }
      }
      return h
    }))
  }

  const updateOption = (hoopId, optionIndex, val) => {
    onChange(hoops.map(h => {
      if (h.id === hoopId) {
        const nextOps = [...h.options]
        nextOps[optionIndex] = val
        return { ...h, options: nextOps }
      }
      return h
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {hoops.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', backgroundColor: clr.bg, borderRadius: 16, border: `2px dashed ${clr.border}` }}>
          <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: clr.textDark }}>No entry hoops enabled.</p>
          <p style={{ margin: 0, fontSize: 14, color: clr.textMid }}>Add a hoop to require people to introduce themselves before connecting.</p>
        </div>
      )}

      {hoops.map((h, i) => (
        <div key={h.id} style={{ backgroundColor: clr.white, borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: `1px solid ${clr.border}`, position: 'relative' }}>
          <button 
            onClick={() => handleRemove(h.id)}
            style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', backgroundColor: clr.redLt, color: clr.red, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}
          >
            ✕
          </button>
          
          <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: clr.indigo, textTransform: 'uppercase' }}>Step {i + 1}</p>
          
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {['written', 'video', 'voice', 'multiplechoice'].map(t => (
              <button
                key={t}
                onClick={() => handleUpdate(h.id, 'type', t)}
                style={{
                  padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap',
                  backgroundColor: h.type === t ? clr.textDark : clr.bg,
                  color: h.type === t ? clr.white : clr.textMid,
                  boxShadow: h.type === t ? 'none' : `0 0 0 1px ${clr.border} inset`,
                }}
              >
                {t === 'multiplechoice' ? 'Multiple Choice' : t}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, marginBottom: 6 }}>PROMPT QUESTION</label>
          <input 
            type="text" 
            value={h.prompt}
            onChange={(e) => handleUpdate(h.id, 'prompt', e.target.value)}
            placeholder="e.g., Why do you want to join?"
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 15, color: clr.textDark, outline: 'none', marginBottom: 16 }}
          />

          {h.type === 'multiplechoice' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: clr.textMid, marginBottom: 8 }}>OPTIONS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(h.options || []).map((opt, oIndex) => (
                  <input
                    key={oIndex}
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(h.id, oIndex, e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: `1px solid ${clr.border}`, backgroundColor: clr.bg, fontSize: 14, color: clr.textDark, outline: 'none' }}
                  />
                ))}
                <button onClick={() => addOption(h.id)} style={{ padding: '8px', borderRadius: 8, border: `1px dashed ${clr.indigo}`, background: 'transparent', color: clr.indigo, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                  + Add Option
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {hoops.length < 3 && (
        <button onClick={handleAdd} style={{ width: '100%', padding: '16px', borderRadius: 16, border: `2px dashed ${clr.border}`, backgroundColor: 'transparent', color: clr.textDark, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>+</span> Add a Hoop
        </button>
      )}
    </div>
  )
}
