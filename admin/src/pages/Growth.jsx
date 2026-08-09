import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { getGrowthSeries, getRetentionCohorts, getRecentUsers } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/ui/Panel'
import { DataTable } from '../components/ui/DataTable'
import { Chip } from '../components/ui/Chip'
import { Bar } from '../components/ui/Bar'
import { Loading } from '../components/ui/Loading'
import { ErrorState } from '../components/ui/ErrorState'
import { dateLabel, relativeTime, compactNumber } from '../lib/format'

const METRIC_CONFIG = [
  { key: 'signups', label: 'Signups', color: '#7B6FFF' },
  { key: 'active_users', label: 'Active users', color: '#4ADE80' },
  { key: 'messages', label: 'Messages', color: '#FBBF24' },
  { key: 'events_created', label: 'Events', color: '#FB7185' },
  { key: 'connections', label: 'Connections', color: '#A78BFA' },
  { key: 'circle_joins', label: 'Circle joins', color: '#38BDF8' },
]

export function Growth({ period = 30, onPeriodChange, onRefresh }) {
  const [activeMetrics, setActiveMetrics] = useState(['signups', 'active_users'])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGrowthData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [growthRes, cohortsRes, usersRes] = await Promise.all([
        getGrowthSeries(period),
        getRetentionCohorts(8),
        getRecentUsers(50),
      ])
      setData({
        growth: growthRes,
        cohorts: cohortsRes,
        recentUsers: usersRes,
      })
      setLoading(false)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchGrowthData()
  }, [fetchGrowthData])

  const toggleMetric = (key) => {
    setActiveMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev // Keep at least one active
        return prev.filter((m) => m !== key)
      }
      return [...prev, key]
    })
  }

  // Retention calculations
  const cohortList = data?.cohorts?.cohorts || []
  const avgWeek1Retention = useMemo(() => {
    if (!cohortList.length) return null
    let totalPct = 0
    let count = 0

    cohortList.forEach((c) => {
      const w1 = c.weeks?.find((w) => w.week_index === 1)
      if (w1 && w1.pct !== undefined) {
        totalPct += w1.pct
        count++
      }
    })

    return count > 0 ? (totalPct / count).toFixed(1) : null
  }, [cohortList])

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-raised border border-line rounded-lg p-3 shadow-xl space-y-1">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint mb-2">
            {dateLabel(label)}
          </div>
          {payload.map((entry) => {
            const cfg = METRIC_CONFIG.find((m) => m.key === entry.dataKey)
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 font-body text-[12px] text-muted">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {cfg?.label || entry.dataKey}
                </span>
                <span className="font-display font-bold text-[14px] text-text">
                  {compactNumber(entry.value)}
                </span>
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  // User table columns
  const userColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => {
        const initials = row.name
          ? row.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase()
          : '?'
        return (
          <div className="flex items-center gap-2.5">
            {row.avatar_url ? (
              <img
                src={row.avatar_url}
                alt=""
                className="w-6 h-6 rounded-full object-cover shrink-0 bg-raised border border-line"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-raised border border-line flex items-center justify-center font-mono text-[10px] text-faint shrink-0">
                {initials}
              </div>
            )}
            <span className="font-medium text-text">{row.name || 'Unnamed'}</span>
          </div>
        )
      },
    },
    { key: 'city', label: 'City', sortable: true },
    {
      key: 'provider',
      label: 'Provider',
      sortable: true,
      render: (row) => {
        const p = (row.provider || 'email').toLowerCase()
        const tone = p === 'google' ? 'indigo' : p === 'apple' ? 'mint' : 'neutral'
        return <Chip label={p} tone={tone} />
      },
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (row) => relativeTime(row.created_at),
    },
    {
      key: 'last_sign_in_at',
      label: 'Last seen',
      sortable: true,
      render: (row) => relativeTime(row.last_sign_in_at),
    },
    { key: 'circles', label: 'Circles', align: 'right', sortable: true },
    { key: 'connections', label: 'Connections', align: 'right', sortable: true },
    { key: 'events_attended', label: 'Events', align: 'right', sortable: true },
    {
      key: 'completeness_pct',
      label: 'Profile',
      align: 'right',
      sortable: true,
      render: (row) => {
        const val = row.completeness_pct || 0
        return (
          <div className="flex items-center gap-2 justify-end">
            <Bar value={val} max={100} tone={val >= 80 ? 'mint' : 'indigo'} className="w-12" />
            <span className="font-mono text-[11px] text-faint">{val}%</span>
          </div>
        )
      },
    },
  ]

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Growth" period={period} onPeriodChange={onPeriodChange} onRefresh={fetchGrowthData} loading={loading} />
        <div className="space-y-6">
          <Loading className="h-[340px] w-full" />
          <Loading className="h-[280px] w-full" />
          <Loading className="h-[320px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Growth" period={period} onPeriodChange={onPeriodChange} onRefresh={fetchGrowthData} loading={loading} />
        <ErrorState error={error} reload={fetchGrowthData} />
      </div>
    )
  }

  const growthSeries = data?.growth?.series || []
  const recentUsersRows = data?.recentUsers?.rows || []

  return (
    <div>
      <PageHeader title="Growth" period={period} onPeriodChange={onPeriodChange} onRefresh={fetchGrowthData} loading={loading} />

      <div className="space-y-6">
        {/* Section A: Multi-Metric Growth Series */}
        <Panel
          title="MULTI-METRIC GROWTH"
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              {METRIC_CONFIG.map((m) => {
                const isActive = activeMetrics.includes(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMetric(m.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium uppercase rounded-md transition-colors ${
                      isActive ? 'bg-raised text-text shadow-xs' : 'text-faint hover:text-text'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isActive ? m.color : '#5A5A6B' }}
                    />
                    {m.label}
                  </button>
                )
              })}
            </div>
          }
        >
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientFirstMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={METRIC_CONFIG.find((m) => m.key === activeMetrics[0])?.color || '#7B6FFF'}
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="95%"
                      stopColor={METRIC_CONFIG.find((m) => m.key === activeMetrics[0])?.color || '#7B6FFF'}
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#2C2C3A" strokeOpacity={0.4} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(val) => dateLabel(val)}
                  stroke="#5A5A6B"
                  fontSize={10}
                  fontFamily="IBM Plex Mono, monospace"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  stroke="#5A5A6B"
                  fontSize={10}
                  fontFamily="IBM Plex Mono, monospace"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                {activeMetrics.map((mKey, idx) => {
                  const cfg = METRIC_CONFIG.find((m) => m.key === mKey)
                  const isFirst = idx === 0
                  return (
                    <Area
                      key={mKey}
                      type="monotone"
                      dataKey={mKey}
                      stroke={cfg?.color || '#7B6FFF'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={isFirst ? 'url(#gradientFirstMetric)' : 'none'}
                      dot={false}
                      activeDot={{ r: 4, fill: cfg?.color || '#7B6FFF', stroke: '#1C1C26', strokeWidth: 2 }}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Section B: Retention Cohorts Grid */}
        <Panel title="WEEKLY RETENTION">
          <div className="space-y-4 overflow-x-auto">
            {cohortList.length === 0 ? (
              <p className="font-body text-sm text-muted py-8 text-center">
                Retention needs at least one full week of signups.
              </p>
            ) : (
              <div className="min-w-[640px]">
                {/* Cohort Columns Header (W0...W7) */}
                <div className="grid grid-cols-[120px_repeat(8,1fr)] gap-2 mb-2">
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                    COHORT
                  </div>
                  {Array.from({ length: 8 }).map((_, wIdx) => (
                    <div key={wIdx} className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint text-center">
                      W{wIdx}
                    </div>
                  ))}
                </div>

                {/* Cohort Rows */}
                <div className="space-y-2">
                  {cohortList.map((cohort) => {
                    return (
                      <div key={cohort.cohort_week} className="grid grid-cols-[120px_repeat(8,1fr)] gap-2 items-center">
                        {/* Left Label */}
                        <div>
                          <div className="font-mono text-[12px] font-medium text-text">
                            {dateLabel(cohort.cohort_week)}
                          </div>
                          <div className="font-mono text-[10px] text-faint">
                            {compactNumber(cohort.size)} users
                          </div>
                        </div>

                        {/* Weeks Cells (W0...W7) */}
                        {Array.from({ length: 8 }).map((_, wIdx) => {
                          const weekData = cohort.weeks?.find((w) => w.week_index === wIdx)
                          if (!weekData) {
                            return <div key={wIdx} className="h-[34px] rounded-md bg-transparent" />
                          }

                          const pct = weekData.pct || 0
                          let bgStyle = { backgroundColor: 'transparent', borderColor: '#2C2C3A' }

                          if (pct > 0) {
                            let opacity = 0
                            if (pct >= 80) opacity = 0.70
                            else if (pct >= 60) opacity = 0.50
                            else if (pct >= 40) opacity = 0.32
                            else if (pct >= 20) opacity = 0.18
                            else opacity = 0.08

                            bgStyle = {
                              backgroundColor: `rgba(123, 111, 255, ${opacity})`,
                              borderColor: 'transparent',
                            }
                          }

                          const textColorClass = pct >= 40 ? 'text-text font-bold' : 'text-faint font-medium'

                          return (
                            <div
                              key={wIdx}
                              style={bgStyle}
                              className={`h-[34px] rounded-md border flex items-center justify-center font-mono text-[11px] ${textColorClass}`}
                            >
                              {pct.toFixed(0)}%
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {avgWeek1Retention !== null && (
              <p className="font-body text-[13px] text-muted pt-2 border-t border-line/40">
                Average Week-1 retention across complete cohorts is{' '}
                <strong className="text-text">{avgWeek1Retention}%</strong>.
              </p>
            )}
          </div>
        </Panel>

        {/* Section C: Newest Accounts Table */}
        <Panel title="NEWEST ACCOUNTS">
          <DataTable
            columns={userColumns}
            rows={recentUsersRows}
            initialSort={{ key: 'created_at', direction: 'desc' }}
            emptyMessage="No accounts yet."
            maxHeight="480px"
          />
        </Panel>
      </div>
    </div>
  )
}
