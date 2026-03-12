export default function MessageBubble({ message }) {
  const isMe = message.isMe
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
          isMe
            ? 'rounded-br-sm bg-indigo-600 text-white'
            : 'rounded-bl-sm bg-slate-100 text-slate-900'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        <p
          className={`mt-1 text-[10px] ${
            isMe ? 'text-indigo-100/80' : 'text-slate-400'
          }`}
        >
          {message.timestamp}
        </p>
      </div>
    </div>
  )
}

