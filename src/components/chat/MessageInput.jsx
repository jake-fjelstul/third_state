import { useState } from 'react'
import { Smile, Send } from 'lucide-react'

export default function MessageInput({ onSend }) {
  const [value, setValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-slate-100 bg-white px-3 py-2 sm:px-4 sm:py-3"
    >
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600"
      >
        <Smile className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Say something that moves the convo forward…"
          className="max-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200"
        disabled={!value.trim()}
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  )
}

