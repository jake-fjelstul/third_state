import { Link } from 'react-router-dom'

export default function ChatListItem({ chat }) {
  const isCircle = chat.type === 'circle'
  return (
    <Link
      to={`/chat/${chat.id}`}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs transition hover:bg-slate-50"
    >
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
        {chat.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
            {chat.unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-slate-900">
            {chat.title}
          </p>
          <span className="text-[10px] text-slate-400">
            {chat.lastMessageTime}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
          {chat.lastMessagePreview}
        </p>
      </div>
    </Link>
  )
}

