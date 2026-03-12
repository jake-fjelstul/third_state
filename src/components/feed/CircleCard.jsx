import { Link } from 'react-router-dom'

export default function CircleCard({ circle, joined }) {
  const isPrivate = circle.type === 'private'

  return (
    <Link
      to={`/circles/${circle.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`relative h-20 w-full bg-gradient-to-r ${circle.coverGradient}`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/10 to-transparent" />
        <div className="absolute left-4 top-3 flex items-center gap-2 text-sm font-medium text-white">
          <span className="text-lg">{circle.emoji}</span>
          <span className="line-clamp-1">{circle.name}</span>
        </div>
        <div className="absolute bottom-3 left-4 flex items-center gap-2 text-[11px] text-slate-100">
          <span className="rounded-full bg-black/20 px-2 py-0.5">
            {circle.interestTag}
          </span>
          <span className="rounded-full bg-black/20 px-2 py-0.5">
            {circle.memberCount} members
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 text-xs">
        <p className="line-clamp-2 text-slate-600">{circle.description}</p>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="capitalize">
            {circle.category} · {isPrivate ? 'Private' : 'Open'}
          </span>
          <span>{circle.city}</span>
        </div>
        <button
          type="button"
          className={`mt-1 inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
            joined
              ? 'border border-slate-200 bg-slate-50 text-slate-600'
              : isPrivate
                ? 'bg-slate-900 text-slate-50'
                : 'bg-indigo-600 text-white'
          }`}
        >
          {joined ? 'Joined' : isPrivate ? 'Request to Join' : 'Join Circle'}
        </button>
      </div>
    </Link>
  )
}

