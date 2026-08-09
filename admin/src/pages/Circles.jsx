import { useState, useEffect, useCallback, useMemo } from 'react'
import { getCircleStats } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/ui/Panel'
import { DataTable } from '../components/ui/DataTable'
import { Chip } from '../components/ui/Chip'
import { Bar } from '../components/ui/Bar'
import { Loading } from '../components/ui/Loading'
import { ErrorState } from '../components/ui/ErrorState'
import { compactNumber, relativeTime } from '../lib/format'

export function Circles({ onRefresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCircleData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCircleStats(100)
      setData(res)
      setLoading(false)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCircleData()
  }, [fetchCircleData])

  const summary = data?.summary || {}
  const rows = data?.rows || []

  // Count drift calculation
  const driftedCircles = useMemo(() => {
    return rows.filter((r) => r.member_count !== r.actual_members)
  }, [rows])

  const countDrift = driftedCircles.length

  // Breakdown helpers: top 8 + everything else
  const processBreakdown = (list, labelKey) => {
    if (!list || !list.length) return []
    const sorted = [...list].sort((a, b) => (b.circles || 0) - (a.circles || 0))
    if (sorted.length <= 8) return sorted

    const top8 = sorted.slice(0, 8)
    const rest = sorted.slice(8)
    const restCircles = rest.reduce((acc, curr) => acc + (curr.circles || 0), 0)
    const restMembers = rest.reduce((acc, curr) => acc + (curr.members || 0), 0)

    top8.push({
      [labelKey]: 'Everything else',
      circles: restCircles,
      members: restMembers,
    })

    return top8
  }

  const byCityList = useMemo(() => processBreakdown(summary.by_city, 'city'), [summary.by_city])
  const byCategoryList = useMemo(() => processBreakdown(summary.by_category, 'category'), [summary.by_category])

  const maxCityCircles = useMemo(() => {
    return byCityList.reduce((max, item) => Math.max(max, item.circles || 0), 0)
  }, [byCityList])

  const maxCategoryCircles = useMemo(() => {
    return byCategoryList.reduce((max, item) => Math.max(max, item.circles || 0), 0)
  }, [byCategoryList])

  // Columns for Circles table
  const circleColumns = [
    {
      key: 'name',
      label: 'Circle',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-text flex items-center gap-1.5">
            {row.emoji && <span>{row.emoji}</span>}
            <span>{row.name || 'Unnamed Circle'}</span>
          </div>
          {row.organizer_name && (
            <div className="font-mono text-[11px] text-faint">
              by {row.organizer_name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (row) => {
        const tone = row.type === 'open' ? 'mint' : 'indigo'
        return <Chip label={row.type || 'open'} tone={tone} />
      },
    },
    { key: 'city', label: 'City', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    {
      key: 'actual_members',
      label: 'Members',
      align: 'right',
      sortable: true,
      render: (row) => {
        const hasDrift = row.member_count !== row.actual_members
        return (
          <div>
            <span>{compactNumber(row.actual_members)}</span>
            {hasDrift && (
              <span className="font-mono text-[10px] text-amber ml-1">
                (stale: {row.member_count})
              </span>
            )}
          </div>
        )
      },
    },
    { key: 'events_count', label: 'Events', align: 'right', sortable: true },
    { key: 'messages_30d', label: 'Messages 30d', align: 'right', sortable: true },
    {
      key: 'pending_applications',
      label: 'Pending',
      align: 'right',
      sortable: true,
      render: (row) => {
        const count = row.pending_applications || 0
        return (
          <span className={count > 0 ? 'text-amber font-bold' : 'text-faint'}>
            {compactNumber(count)}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (row) => relativeTime(row.created_at),
    },
  ]

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Circles" onRefresh={fetchCircleData} loading={loading} />
        <div className="space-y-6">
          <Loading className="h-[90px] w-full" />
          <Loading className="h-[100px] w-full" />
          <Loading className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Circles" onRefresh={fetchCircleData} loading={loading} />
        <ErrorState error={error} reload={fetchCircleData} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Circles" onRefresh={fetchCircleData} loading={loading} />

      <div className="space-y-6">
        {/* Section A: Summary Strip */}
        <Panel>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-line/40">
            <div className="space-y-1">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                TOTAL CIRCLES
              </div>
              <div className="font-display font-bold text-20px md:text-[20px] text-text">
                {compactNumber(summary.total)}
              </div>
            </div>

            <div className="space-y-1 sm:pl-6 pt-4 sm:pt-0">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                OPEN
              </div>
              <div className="font-display font-bold text-20px md:text-[20px] text-text">
                {compactNumber(summary.open)}
              </div>
            </div>

            <div className="space-y-1 sm:pl-6 pt-4 sm:pt-0">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                PRIVATE
              </div>
              <div className="font-display font-bold text-20px md:text-[20px] text-text">
                {compactNumber(summary.private)}
              </div>
            </div>

            <div className="space-y-1 sm:pl-6 pt-4 sm:pt-0">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                AVG MEMBERS
              </div>
              <div className="font-display font-bold text-20px md:text-[20px] text-text">
                {summary.avg_members ?? 0}
              </div>
            </div>

            <div className="space-y-1 sm:pl-6 pt-4 sm:pt-0">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                MEDIAN MEMBERS
              </div>
              <div className="font-display font-bold text-20px md:text-[20px] text-text">
                {summary.median_members ?? 0}
              </div>
            </div>
          </div>
        </Panel>

        {/* Section B: Health Flags */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-panel border border-line rounded-xl p-5 space-y-1">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                EMPTY CIRCLES
              </div>
              <div
                className={`font-display font-bold text-26px md:text-[26px] ${
                  (summary.circles_with_zero_events || 0) > 0 ? 'text-amber' : 'text-mint'
                }`}
              >
                {compactNumber(summary.circles_with_zero_events)}
              </div>
              <div className="font-body text-xs text-faint">No events scheduled</div>
            </div>

            <div className="bg-panel border border-line rounded-xl p-5 space-y-1">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                SOLO CIRCLES
              </div>
              <div
                className={`font-display font-bold text-26px md:text-[26px] ${
                  (summary.circles_with_one_member || 0) > 0 ? 'text-amber' : 'text-mint'
                }`}
              >
                {compactNumber(summary.circles_with_one_member)}
              </div>
              <div className="font-body text-xs text-faint">Organizer only</div>
            </div>

            <div className="bg-panel border border-line rounded-xl p-5 space-y-1">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                COUNT DRIFT
              </div>
              <div
                className={`font-display font-bold text-26px md:text-[26px] ${
                  countDrift > 0 ? 'text-amber' : 'text-mint'
                }`}
              >
                {compactNumber(countDrift)}
              </div>
              <div className="font-body text-xs text-faint">Denormalized count is stale</div>
            </div>
          </div>

          {countDrift > 0 && (
            <p className="font-mono text-[11px] text-amber mt-2 px-1">
              Affected circles with count drift:{' '}
              {driftedCircles.map((c) => c.name).join(', ')}
            </p>
          )}
        </div>

        {/* Section C: Circles Table */}
        <Panel title="CIRCLES DIRECTORY">
          <DataTable
            columns={circleColumns}
            rows={rows}
            initialSort={{ key: 'actual_members', direction: 'desc' }}
            emptyMessage="No circles have been created yet."
            maxHeight="560px"
          />
        </Panel>

        {/* Section D: Breakdowns (By City & By Category) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel title="BY CITY">
            <div className="space-y-3 pt-1">
              {byCityList.length === 0 ? (
                <p className="font-body text-xs text-muted py-4 text-center">No city data.</p>
              ) : (
                byCityList.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-body font-medium text-text">
                        {item.city || 'Unknown'}
                      </span>
                      <span className="font-mono text-faint">
                        {compactNumber(item.circles)} {item.circles === 1 ? 'circle' : 'circles'} · {compactNumber(item.members)} members
                      </span>
                    </div>
                    <Bar value={item.circles} max={maxCityCircles} tone="indigo" />
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="BY CATEGORY">
            <div className="space-y-3 pt-1">
              {byCategoryList.length === 0 ? (
                <p className="font-body text-xs text-muted py-4 text-center">No category data.</p>
              ) : (
                byCategoryList.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-body font-medium text-text">
                        {item.category || 'Uncategorized'}
                      </span>
                      <span className="font-mono text-faint">
                        {compactNumber(item.circles)} {item.circles === 1 ? 'circle' : 'circles'} · {compactNumber(item.members)} members
                      </span>
                    </div>
                    <Bar value={item.circles} max={maxCategoryCircles} tone="indigo" />
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
