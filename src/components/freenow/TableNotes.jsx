import { useCallback, useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uniqueTopic } from '../../lib/realtimeTopic.js'
import { listCheckinNotes, postCheckinNote } from '../../lib/lfg.js'
import { Avatar } from '../ui/ds.jsx'

const MAX = 140

/*
 * Table notes (plan 3b R4): a short thread for the host and everyone who
 * pulled up. Only readable while the post is live; the server deletes the
 * notes after it ends, and this section disappears with the post.
 */
export default function TableNotes({ postId, meId }) {
  const [notes, setNotes] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  const load = useCallback(async () => {
    try { setNotes(await listCheckinNotes(postId)) } catch { setNotes(n => n || []) }
  }, [postId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(uniqueTopic(`table-notes:${postId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_notes', filter: `post_id=eq.${postId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [postId, load])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [notes?.length])

  const send = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || sending) return
    setSending(true); setError('')
    try {
      await postCheckinNote(postId, t)
      setText('')
      load()
    } catch (err) {
      setError(/wrapped up/i.test(err?.message) ? 'This table has wrapped up.' : "Couldn't send that.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginBottom: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--textDark)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
        Table notes
      </p>
      <p style={{ fontSize: 12, color: 'var(--textLight)', margin: '0 0 12px' }}>
        Just for the people here. Cleared when this ends.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
        {notes === null ? (
          <p style={{ fontSize: 14, color: 'var(--textMid)', margin: 0 }}>Loading…</p>
        ) : notes.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--textMid)', fontStyle: 'italic', margin: 0 }}>
            No notes yet. Say where you're sitting.
          </p>
        ) : notes.map(n => {
          const mine = n.userId === meId
          return (
            <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: mine ? 'row-reverse' : 'row' }}>
              {!mine && <Avatar src={n.avatar} name={n.name} size={26} />}
              <div style={{
                maxWidth: '78%', padding: '8px 12px', borderRadius: 16, fontSize: 14, lineHeight: 1.35,
                background: mine ? 'var(--accent)' : 'var(--surface-2)',
                color: mine ? 'var(--on-accent)' : 'var(--textDark)',
                overflowWrap: 'anywhere',
              }}>
                {!mine && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--textMid)', marginBottom: 2 }}>{(n.name || '').split(' ')[0]}</div>}
                {n.text}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX))}
          placeholder="Grabbed the booth by the window…"
          aria-label="Table note"
          maxLength={MAX}
          enterKeyHint="send"
          // The sheet shrinks above the keyboard; keep the field in view.
          onFocus={e => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 320) }}
          style={{
            flex: 1, minWidth: 0, height: 42, padding: '0 14px', borderRadius: 999, border: '1px solid var(--border)',
            background: 'var(--surface-2)', color: 'var(--textDark)', fontSize: 16, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button type="submit" disabled={!text.trim() || sending} aria-label="Send note" style={{
          width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
          background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: text.trim() && !sending ? 'pointer' : 'default', opacity: text.trim() && !sending ? 1 : 0.5,
        }}><Send size={17} /></button>
      </form>
      {text.length > MAX - 20 && (
        <p style={{ fontSize: 11, color: 'var(--textLight)', margin: '4px 6px 0', textAlign: 'right' }}>{MAX - text.length} left</p>
      )}
      {error && <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad)', margin: '6px 4px 0' }}>{error}</p>}
    </div>
  )
}
