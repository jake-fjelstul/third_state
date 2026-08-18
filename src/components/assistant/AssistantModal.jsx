import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import {
  userMessage, assistantThinking, assistantText,
} from '../../lib/assistant/conversation.js'
import { runAssistant } from '../../lib/assistant/engine.js'

import TextMessage   from './messages/TextMessage.jsx'
import PeopleStack   from './messages/PeopleStack.jsx'
import CircleList    from './messages/CircleList.jsx'
import EventList     from './messages/EventList.jsx'
import EventForm     from './messages/EventForm.jsx'
import CircleForm    from './messages/CircleForm.jsx'
import NavSuggestion from './messages/NavSuggestion.jsx'
import HelpMessage   from './messages/HelpMessage.jsx'
import DisambiguationCard from './messages/DisambiguationCard.jsx'
import ActionConfirmCard from './messages/ActionConfirmCard.jsx'

const SUGGESTIONS = [
  'Find people who like hiking',
  'Photography circles',
  'Events this weekend',
  'Create a yoga circle',
]

export default function AssistantModal({ initialPrompt, onClose, clr }) {
  const ctx = useAppContext()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingState, setPendingState] = useState(null)
  const scrollerRef = useRef(null)
  const sentInitialRef = useRef(false)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, busy])

  // Lock body scroll while the modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Send the initial prompt once
  useEffect(() => {
    if (sentInitialRef.current) return
    sentInitialRef.current = true
    if (initialPrompt && initialPrompt.trim()) {
      sendText(initialPrompt.trim(), { silentUserMsg: false })
    } else {
      sendText('', { silentUserMsg: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Append messages from outside (e.g. confirm actions) */
  const appendMessages = (newMsgs) => {
    setMessages(prev => [...prev, ...newMsgs])
  }

  /**
   * Replace a message with new messages (called by EventForm / CircleForm / ActionConfirmCard on success).
   */
  const replaceMessage = (msgId, newMsgs) => {
    setMessages(prev => {
      const without = prev.filter(m => m.id !== msgId)
      return [...without, ...newMsgs]
    })
  }

  async function sendText(text, { silentUserMsg = false } = {}) {
    if (busy) return
    const trimmed = (text || '').trim()
    if (!silentUserMsg) {
      if (!trimmed) return
      setMessages(prev => [...prev, userMessage(trimmed)])
    }
    setBusy(true)
    setMessages(prev => [...prev, assistantThinking()])

    try {
      const res = await runAssistant(trimmed, ctx, pendingState)
      setPendingState(res.pendingState || null)
      setMessages(prev => prev.filter(m => m.kind !== 'thinking').concat(res.messages || []))
    } catch (err) {
      console.error('[AssistantModal] runAssistant failed', err)
      setMessages(prev => prev.filter(m => m.kind !== 'thinking').concat([
        assistantText("Something went wrong on my end. Try again, or check out the Feed directly."),
      ]))
    } finally {
      setBusy(false)
    }
  }

  const onFormSubmit = (e) => {
    e.preventDefault()
    const t = input
    setInput('')
    sendText(t)
  }

  const env = { ctx, clr, onClose, appendMessages, sendText }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto',
          height: '88vh',
          backgroundColor: clr.bg,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 5, backgroundColor: clr.border, borderRadius: 999 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px',
        }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: clr.textDark, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={18} color={clr.indigo} /> Assistant
          </h3>
          <button
            onClick={onClose}
            aria-label="Close assistant"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <svg width="22" height="22" fill="none" stroke={clr.textMid} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conversation area */}
        <div
          ref={scrollerRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '8px 16px 16px',
            display: 'flex', flexDirection: 'column', gap: 14,
            scrollbarWidth: 'none',
          }}
        >
          {messages.map(m => renderMessage(m, { ...env, replaceMessage }))}
        </div>

        {/* Suggestion chips */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap',
          padding: '0 16px 10px',
        }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => sendText(s)}
              disabled={busy}
              style={{
                padding: '7px 13px', borderRadius: 999,
                border: `1.5px solid ${clr.border}`,
                backgroundColor: clr.white, color: clr.indigo,
                fontSize: 12, fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input row */}
        <form
          onSubmit={onFormSubmit}
          style={{
            display: 'flex', gap: 10, padding: '12px 16px 24px',
            backgroundColor: clr.bg, borderTop: `1px solid ${clr.border}`,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            disabled={busy}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 999,
              border: `1.5px solid ${clr.border}`,
              backgroundColor: clr.white, color: clr.textDark,
              fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              padding: '12px 20px', borderRadius: 999, border: 'none',
              background: (busy || !input.trim())
                ? '#A5B4FC'
                : `linear-gradient(135deg, ${clr.indigo}, #7B6FFF)`,
              color: '#FFF', fontSize: 14, fontWeight: 800,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(91,95,239,0.3)',
              opacity: busy ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

function renderMessage(m, env) {
  const { clr, ctx, onClose, appendMessages, replaceMessage } = env
  switch (m.kind) {
    case 'text':
      return <TextMessage key={m.id} message={m} clr={clr} />
    case 'thinking':
      return <TextMessage key={m.id} message={{ ...m, text: 'Thinking…' }} clr={clr} muted />
    case 'people':
      return (
        <PeopleStack
          key={m.id}
          message={m}
          ctx={ctx}
          clr={clr}
          onClose={onClose}
          onAppendMessages={appendMessages}
        />
      )
    case 'circles':
      return (
        <CircleList
          key={m.id}
          message={m}
          ctx={ctx}
          clr={clr}
          onClose={onClose}
          onAppendMessages={appendMessages}
        />
      )
    case 'events':
      return (
        <EventList
          key={m.id}
          message={m}
          ctx={ctx}
          clr={clr}
          onAppendMessages={appendMessages}
        />
      )
    case 'event_form':
      return (
        <EventForm
          key={m.id}
          message={m}
          clr={clr}
          onComplete={(newMsgs) => replaceMessage(m.id, newMsgs)}
        />
      )
    case 'circle_form':
      return (
        <CircleForm
          key={m.id}
          message={m}
          clr={clr}
          onComplete={(newMsgs) => replaceMessage(m.id, newMsgs)}
        />
      )
    case 'navigate':
      return <NavSuggestion key={m.id} message={m} clr={clr} onClose={onClose} />
    case 'help':
      return <HelpMessage key={m.id} clr={clr} />
    case 'disambiguation':
      return (
        <DisambiguationCard
          key={m.id}
          message={m}
          clr={clr}
          onSelectCandidate={(candidate) => {
            replaceMessage(m.id, [])
            env.sendText(candidate.title)
          }}
        />
      )
    case 'action_confirmation':
      return (
        <ActionConfirmCard
          key={m.id}
          message={m}
          ctx={ctx}
          clr={clr}
          onComplete={(newMsgs) => replaceMessage(m.id, newMsgs)}
          onCancel={() => replaceMessage(m.id, [assistantText('Action cancelled.')])}
        />
      )
    default:
      return null
  }
}
