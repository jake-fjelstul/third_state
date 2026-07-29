import { useState, useRef } from 'react'
import ReportModal from '../moderation/ReportModal.jsx'

const clr = {
  bg:       'var(--bg)',
  white:    'var(--white)',
  indigo:   'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid:  'var(--textMid)',
  border:   'var(--border)',
}

export default function MessageBubble({ message }) {
  const isMe = message.isMe
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const timerRef = useRef(null)

  const senderId = message.senderId || message.sender_id || message.sender?.id || message.user?.id || message.userId || null
  const senderName = typeof message.sender === 'string' ? message.sender : (message.senderName || message.sender?.name || message.user?.name || '')

  const handleTouchStart = () => {
    if (isMe) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setShowActionSheet(true)
    }, 500)
  }

  const handleTouchCancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleContextMenu = (e) => {
    if (isMe) return
    e.preventDefault()
    setShowActionSheet(true)
  }

  return (
    <>
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchCancel}
          onTouchEnd={handleTouchCancel}
          onTouchCancel={handleTouchCancel}
          onContextMenu={handleContextMenu}
          className={`max-w-[70%] rounded-2xl px-3 py-2 text-xs shadow-sm cursor-pointer select-none ${
            isMe
              ? 'rounded-br-sm bg-indigo-600 text-white'
              : 'rounded-bl-sm bg-slate-100 text-slate-900'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.text || message.content}</p>
          <p
            className={`mt-1 text-[10px] ${
              isMe ? 'text-indigo-100/80' : 'text-slate-400'
            }`}
          >
            {message.timestamp || message.time}
          </p>
        </div>
      </div>

      {/* Action sheet for reporting */}
      {showActionSheet && (
        <div
          onClick={() => setShowActionSheet(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(15,15,30,0.4)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            fontFamily: "'DM Sans', 'Inter', sans-serif",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 500,
              backgroundColor: clr.white,
              borderRadius: '24px 24px 0 0',
              padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slideUp 0.2s ease-out forwards',
            }}
          >
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{ width: 36, height: 4, backgroundColor: clr.border, borderRadius: 2 }} />
            </div>

            <button
              onClick={() => {
                setShowActionSheet(false)
                setShowReportModal(true)
              }}
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 14,
                border: 'none',
                backgroundColor: clr.bg,
                color: clr.textDark,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              🚩 Report message
            </button>

            <button
              onClick={() => setShowActionSheet(false)}
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 14,
                border: `1.5px solid ${clr.border}`,
                backgroundColor: clr.white,
                color: clr.textMid,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedMessageId={message.id}
        reportedUserId={senderId}
        subjectName={senderName ? `message from ${senderName}` : 'message'}
        context={{ text: message.text || message.content || '' }}
      />
    </>
  )
}
