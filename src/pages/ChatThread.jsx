import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Circle } from 'lucide-react'
import { chats } from '../data/mockData'
import MessageBubble from '../components/chat/MessageBubble.jsx'
import MessageInput from '../components/chat/MessageInput.jsx'

export default function ChatThread() {
  const { id } = useParams()
  const chat = useMemo(() => chats.find((c) => c.id === id), [id])
  const [messages, setMessages] = useState(chat?.messages ?? [])

  if (!chat) {
    return (
      <div className="text-sm text-slate-500">
        This conversation could not be found.
      </div>
    )
  }

  const isCircle = chat.type === 'circle'

  const handleSend = (text) => {
    const now = new Date()
    const timestamp = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        senderId: 'user-alex',
        senderName: 'Alex',
        text,
        timestamp,
        isMe: true,
      },
    ])
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col rounded-3xl border border-slate-100 bg-white shadow-sm shadow-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/chat"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-base">
            {isCircle ? (
              <span>{chat.avatarEmoji}</span>
            ) : (
              <img
                src={chat.avatarUrl}
                alt={chat.title}
                className="h-9 w-9 rounded-full object-cover"
              />
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400">
              <Circle className="h-2 w-2 text-white" />
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-900">{chat.title}</p>
            <p className="text-[11px] text-slate-400">
              Active now · {chat.members.length} in this thread
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <MessageInput onSend={handleSend} />
    </div>
  )
}

