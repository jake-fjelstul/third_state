import { useState } from 'react'
import { usePoll } from '../../hooks/usePoll'
import { votePoll, closePoll } from '../../lib/db/polls'

export default function PollMessageCard({ clr, payload, viewerId }) {
  const pollId = payload?.pollId
  const { poll, loading, reload } = usePoll(pollId)
  const [pending, setPending] = useState(null)

  if (loading) {
    return (
      <div style={{ maxWidth: 300, padding: 14, borderRadius: 16, backgroundColor: clr.white, border: `1px solid ${clr.border}` }}>
        <span style={{ fontSize: 13, color: clr.textLight }}>Loading poll…</span>
      </div>
    )
  }
  if (!poll) return null

  const closed = !!poll.closedAt
  const isCreator = poll.createdBy === viewerId
  const myVotes = new Set(
    poll.options.filter(o => o.voters.some(v => v.id === viewerId)).map(o => o.index)
  )

  const handleVote = async (index) => {
    if (closed || pending !== null) return
    setPending(index)
    try {
      await votePoll(poll.id, index)
      await reload()
    } catch (err) {
      console.error('[PollMessageCard] vote failed', err)
    } finally {
      setPending(null)
    }
  }

  const handleClose = async () => {
    try {
      await closePoll(poll.id)
      await reload()
    } catch (err) {
      console.error('[PollMessageCard] close failed', err)
    }
  }

  return (
    <div style={{
      maxWidth: 300, width: '100%', padding: 14, borderRadius: 16,
      backgroundColor: clr.white, border: `1px solid ${clr.border}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 800, color: clr.textDark }}>
        {poll.question}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: clr.textLight }}>
        {poll.totalVoters} {poll.totalVoters === 1 ? 'vote' : 'votes'}
        {poll.allowMultiple ? ' · pick as many as you like' : ''}
        {closed ? ' · closed' : ''}
      </p>

      {poll.options.map(opt => {
        const pct = poll.totalVoters > 0 ? Math.round((opt.count / poll.totalVoters) * 100) : 0
        const mine = myVotes.has(opt.index)
        return (
          <button
            key={opt.index}
            type="button"
            onClick={() => handleVote(opt.index)}
            disabled={closed || pending !== null}
            style={{
              position: 'relative', width: '100%', textAlign: 'left',
              padding: '10px 12px', marginBottom: 8, borderRadius: 12,
              border: `1.5px solid ${mine ? clr.indigo : clr.border}`,
              backgroundColor: clr.bg, overflow: 'hidden',
              cursor: closed ? 'default' : 'pointer', fontFamily: 'inherit',
            }}
          >
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${pct}%`, backgroundColor: 'rgba(91,95,239,0.12)',
              transition: 'width 0.3s ease',
            }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: mine ? 700 : 500, color: clr.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mine ? '✓ ' : ''}{opt.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: clr.textMid, flexShrink: 0 }}>
                {opt.count}
              </span>
            </div>
            {opt.voters.length > 0 && (
              <div style={{ position: 'relative', marginTop: 4, fontSize: 11, color: clr.textLight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opt.voters.map(v => v.id === viewerId ? 'You' : (v.name || '').split(' ')[0]).join(', ')}
              </div>
            )}
          </button>
        )
      })}

      {isCreator && !closed && (
        <button
          type="button"
          onClick={handleClose}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: clr.textLight, fontSize: 12, fontWeight: 700,
            padding: '2px 0', fontFamily: 'inherit',
          }}
        >
          Close poll
        </button>
      )}
    </div>
  )
}
