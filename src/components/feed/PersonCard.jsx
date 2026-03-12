import { MessageCircle } from 'lucide-react'

export default function PersonCard({ person }) {
  return (
    <div className="relative flex w-64 flex-shrink-0 flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-center gap-3">
        <img
          src={person.avatar}
          alt={person.name}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {person.name}, {person.age}
          </p>
          <p className="truncate text-xs text-slate-400">{person.city}</p>
        </div>
      </div>
      <p className="mb-3 line-clamp-3 text-xs text-slate-600">{person.bio}</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {person.sharedInterests?.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
          >
            {tag}
          </span>
        ))}
      </div>
      <button className="mt-auto inline-flex items-center justify-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-500">
        <MessageCircle className="h-3.5 w-3.5" />
        <span>Say Hi</span>
      </button>
    </div>
  )
}

