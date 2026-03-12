export default function EventCard({ event }) {
  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {event.circleEmoji} {event.circleName}
      </p>
      <p className="mb-1 text-sm font-semibold text-slate-900">
        {event.title}
      </p>
      <p className="mb-2 text-xs text-slate-500">
        {event.date} · {event.time}
      </p>
      <p className="mb-3 line-clamp-2 text-xs text-slate-500">
        {event.location}
      </p>
      <div className="mt-auto flex items-center justify-between text-[11px] text-slate-400">
        <span>{event.attendeesCount ?? 0} going</span>
        <button className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100">
          RSVP
        </button>
      </div>
    </div>
  )
}

