import { useState, useEffect, useCallback, useMemo } from 'react'
import { getEventStats } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/ui/Panel'
import { Stat } from '../components/ui/Stat'
import { DataTable } from '../components/ui/DataTable'
import { Chip } from '../components/ui/Chip'
import { Loading } from '../components/ui/Loading'
import { ErrorState } from '../components/ui/ErrorState'
import { compactNumber, dateLabel, relativeTime } from '../lib/format'

export function Events({ period = 90, onPeriodChange, onRefresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEventData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getEventStats(period)
      setData(res)
      setLoading(false)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchEventData()
  }, [fetchEventData])

  const summary = data?.summary || {}
  const byDowList = data?.by_day_of_week || []
  const topEvents = data?.top_events || []
  const recentEvents = data?.recent || []

  // Attendance rate check (<25% in amber)
  const attendanceRatePct = summary.attendance_rate ? (summary.attendance_rate * 100).toFixed(0) : '0'
  const isLowAttendance = Number(attendanceRatePct) < 25

  // DOW max attendee count for bar scaling
  const maxDowAttendees = useMemo(() => {
    return byDowList.reduce((max, item) => Math.max(max, item.attendees || 0), 0)
  }, [byDowList])

  // Top events columns
  const topEventsColumns = [
    {
      key: 'title',
      label: 'Event',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-text">{row.title || 'Untitled Event'}</div>
          {row.circle_name && (
            <div className="font-mono text-[11px] text-faint">{row.circle_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'starts_at',
      label: 'When',
      sortable: true,
      render: (row) => dateLabel(row.starts_at),
    },
    {
      key: 'attendee_count',
      label: 'Attendees',
      align: 'right',
      sortable: true,
      render: (row) => compactNumber(row.attendee_count),
    },
  ]

  // Recent/Upcoming events columns
  const recentColumns = [
    {
      key: 'title',
      label: 'Event',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-text">{row.title || 'Untitled Event'}</div>
          {row.circle_name && (
            <div className="font-mono text-[11px] text-faint">{row.circle_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'starts_at',
      label: 'When',
      sortable: true,
      render: (row) => dateLabel(row.starts_at),
    },
    {
      key: 'is_upcoming',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const isUpcoming = row.is_upcoming || (row.starts_at && new Date(row.starts_at) > new Date())
        return <Chip label={isUpcoming ? 'upcoming' : 'past'} tone={isUpcoming ? 'indigo' : 'neutral'} />
      },
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      render: (row) => {
        if (!row.location) return '—'
        return row.location.length > 32 ? `${row.location.substring(0, 32)}…` : row.location
      },
    },
    {
      key: 'creator_name',
      label: 'Created by',
      sortable: true,
      render: (row) => row.creator_name || '—',
    },
    {
      key: 'attendee_count',
      label: 'Attendees',
      align: 'right',
      sortable: true,
      render: (row) => {
        const count = row.attendee_count || 0
        return (
          <span className={count === 0 ? 'text-amber font-bold' : 'text-text'}>
            {compactNumber(count)}
          </span>
        )
      },
    },
  ]

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Events" period={period} onPeriodChange={onPeriodChange} onRefresh={fetchEventData} loading={loading} />
        <div className="space-y-6">
          <Loading className="h-[90px] w-full" />
          <Loading className="h-[180px] w-full" />
          <Loading className="h-[360px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Events" period={period} onPeriodChange={onPeriodChange} onRefresh={fetchEventData} loading={loading} />
        <ErrorState error={error} reload={fetchEventData} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Events" period={period} onPeriodChange={onPeriodChange} onRefresh={fetchEventData} loading={loading} />

      <div className="space-y-6">
        {/* Section A: Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <Stat label="TOTAL EVENTS" value={compactNumber(summary.total)} />
          <Stat label="UPCOMING" value={compactNumber(summary.upcoming)} />
          <Stat label="PAST" value={compactNumber(summary.past)} />
          <Stat label="AVG ATTENDEES" value={summary.avg_attendees ?? 0} />
          <div className="bg-panel border border-line rounded-xl p-5 space-y-1">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              ATTENDANCE RATE
            </div>
            <div className={`font-display font-bold text-26px md:text-[26px] ${isLowAttendance ? 'text-amber' : 'text-text'}`}>
              {attendanceRatePct}%
            </div>
          </div>
        </div>

        {/* Section B: When People Meet (Day of Week Vertical Bars) */}
        <Panel title="BY DAY OF WEEK">
          <div className="pt-4 pb-2">
            <div className="grid grid-cols-7 gap-3 items-end h-[120px] px-2">
              {byDowList.map((item) => {
                const attendees = item.attendees || 0
                const events = item.events || 0
                const isTallest = maxDowAttendees > 0 && attendees === maxDowAttendees
                const heightPct = maxDowAttendees > 0 ? (attendees / maxDowAttendees) * 100 : 0

                return (
                  <div key={item.dow} className="group relative flex flex-col items-center h-full justify-end">
                    {/* Hover Tooltip */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-raised border border-line rounded-md px-2.5 py-1 z-20 shadow-xl whitespace-nowrap">
                      <div className="font-mono text-[10px] text-text">
                        {compactNumber(events)} events · {compactNumber(attendees)} attendees
                      </div>
                    </div>

                    {/* Bar */}
                    <div className="w-full bg-raised rounded-t-md overflow-hidden h-full flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          isTallest ? 'bg-indigo' : 'bg-indigo/35 group-hover:bg-indigo/60'
                        }`}
                        style={{ height: `${Math.max(4, heightPct)}%` }}
                      />
                    </div>

                    {/* Day Label */}
                    <div className="font-mono text-[11px] font-medium text-faint uppercase mt-2">
                      {item.label ? item.label.substring(0, 3) : `D${item.dow}`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Panel>

        {/* Section C: Best Attended Events */}
        <Panel title="BEST ATTENDED">
          <DataTable
            columns={topEventsColumns}
            rows={topEvents}
            initialSort={{ key: 'attendee_count', direction: 'desc' }}
            emptyMessage="No events have been attended yet."
            maxHeight="320px"
          />
        </Panel>

        {/* Section D: Recent and Upcoming Events */}
        <Panel title="RECENT & UPCOMING EVENTS">
          <DataTable
            columns={recentColumns}
            rows={recentEvents}
            initialSort={{ key: 'starts_at', direction: 'desc' }}
            emptyMessage="No events in this period."
            maxHeight="480px"
          />
        </Panel>
      </div>
    </div>
  )
}
