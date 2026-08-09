import { ACTION_REGISTRY } from '../../../lib/assistant/actions.js'
import { assistantText } from '../../../lib/assistant/conversation.js'

export default function ActionConfirmCard({ message, ctx, clr, onComplete, onCancel }) {
  const { actionId, description, slots, entity, reason } = message

  const handleConfirm = async () => {
    const actionDef = ACTION_REGISTRY[actionId]
    if (!actionDef) return
    try {
      const res = await actionDef.execute(slots, entity, ctx)
      if (res?.status === 'success') {
        onComplete([assistantText(res.message || 'Done! ✓')])
      } else if (res?.status === 'form') {
        onComplete([
          assistantText('Fill in the details below:'),
          {
            id: `form_${Date.now()}`,
            role: 'assistant',
            kind: res.formKind,
            payload: { prefill: res.initialData }
          }
        ])
      } else if (res?.status === 'navigate') {
        onComplete([
          assistantText(`Navigating to ${res.label}...`),
          {
            id: `nav_${Date.now()}`,
            role: 'assistant',
            kind: 'navigate',
            payload: { path: res.path, label: res.label }
          }
        ])
      }
    } catch (err) {
      console.error('[ActionConfirmCard] execution failed', err)
      onComplete([assistantText('Action failed. Please try again.')])
    }
  }

  return (
    <div style={{
      backgroundColor: clr.white,
      borderRadius: 18,
      padding: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: `1.5px solid ${clr.indigo}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: clr.textDark }}>
          Confirm Action
        </p>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 14, color: clr.textDark, fontWeight: 600 }}>
        {description}
      </p>
      {reason && (
        <p style={{ margin: '0 0 14px', fontSize: 11, color: clr.textMid, fontStyle: 'italic' }}>
          Matched because: {reason}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 999,
            border: `1.5px solid ${clr.border}`, backgroundColor: clr.white,
            color: clr.textMid, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          style={{
            flex: 2, padding: '10px 14px', borderRadius: 999, border: 'none',
            background: `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
            color: '#FFF', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
            fontFamily: 'inherit',
          }}
        >
          Confirm & Execute
        </button>
      </div>
    </div>
  )
}
