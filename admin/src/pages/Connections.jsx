import { useState, useEffect, useCallback, useMemo } from 'react'
import { getConnectionStats } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/ui/Panel'
import { Stat } from '../components/ui/Stat'
import { Bar } from '../components/ui/Bar'
import { DataTable } from '../components/ui/DataTable'
import { Loading } from '../components/ui/Loading'
import { ErrorState } from '../components/ui/ErrorState'
import { compactNumber } from '../lib/format'

export function Connections({ onRefresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchConnectionData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getConnectionStats()
      setData(res)
      setLoading(false)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnectionData()
  }, [fetchConnectionData])

  const requests = data?.requests || {}
  const connectionsGraph = data?.connections || {}
  const distributionList = data?.distribution || []
  const topConnectors = data?.top_connectors || []

  // Response time text helper
  const responseTimeText = useMemo(() => {
    const hours = requests.avg_hours_to_respond || 0
    if (hours <= 0) return 'No response time recorded yet'
    if (hours > 48) {
      const days = (hours / 24).toFixed(1)
      return `Median reply in ${days} days`
    }
    return `Median reply in ${Math.round(hours)}h`
  }, [requests.avg_hours_to_respond])

  // Max bucket users for distribution bar scaling
  const maxBucketUsers = useMemo(() => {
    return distributionList.reduce((max, item) => Math.max(max, item.users || 0), 0)
  }, [distributionList])

  // Total users across buckets for 25% check
  const totalBucketUsers = useMemo(() => {
    return distributionList.reduce((acc, item) => acc + (item.users || 0), 0)
  }, [distributionList])

  const usersWithZeroCount = connectionsGraph.users_with_zero || 0
  const isHighZeroUsers = totalBucketUsers > 0 && usersWithZeroCount / totalBucketUsers > 0.25

  // Columns for Top Connectors
  const connectorColumns = [
    { key: 'name', label: 'Person', sortable: true, render: (row) => row.name || 'Unnamed User' },
    { key: 'city', label: 'City', sortable: true, render: (row) => row.city || '—' },
    {
      key: 'connection_count',
      label: 'Connections',
      align: 'right',
      sortable: true,
      render: (row) => compactNumber(row.connection_count),
    },
  ]

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Connections" onRefresh={fetchConnectionData} loading={loading} />
        <div className="space-y-6">
          <Loading className="h-[180px] w-full" />
          <Loading className="h-[90px] w-full" />
          <Loading className="h-[240px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Connections" onRefresh={fetchConnectionData} loading={loading} />
        <ErrorState error={error} reload={fetchConnectionData} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Connections" onRefresh={fetchConnectionData} loading={loading} />

      <div className="space-y-6">
        {/* Section A: Request Funnel */}
        <Panel title="CONNECTION REQUEST FUNNEL">
          <div className="space-y-6">
            {/* Linked 4 Figures */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
              <div className="space-y-1">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  SENT
                </div>
                <div className="font-display font-bold text-28px md:text-[28px] text-text">
                  {compactNumber(requests.sent)}
                </div>
              </div>

              <div className="space-y-1 sm:border-l sm:border-line/40 sm:pl-4">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  PENDING
                </div>
                <div className="font-display font-bold text-28px md:text-[28px] text-amber">
                  {compactNumber(requests.pending)}
                </div>
              </div>

              <div className="space-y-1 sm:border-l sm:border-line/40 sm:pl-4">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  ACCEPTED
                </div>
                <div className="font-display font-bold text-28px md:text-[28px] text-mint">
                  {compactNumber(requests.accepted)}
                </div>
              </div>

              <div className="space-y-1 sm:border-l sm:border-line/40 sm:pl-4">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  DECLINED
                </div>
                <div className="font-display font-bold text-28px md:text-[28px] text-rose">
                  {compactNumber(requests.declined)}
                </div>
              </div>
            </div>

            {/* Below Funnel: Acceptance Rate & Response Time */}
            <div className="flex flex-wrap items-baseline justify-between gap-4 pt-4 border-t border-line/40">
              <div className="space-y-1">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  ACCEPTANCE RATE
                </div>
                <div className="font-display font-bold text-24px md:text-[24px] text-text">
                  {requests.acceptance_rate ?? 0}%
                </div>
              </div>

              <div className="font-body text-sm text-muted">
                {responseTimeText}
              </div>
            </div>
          </div>
        </Panel>

        {/* Section B: Graph Health */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Stat label="UNIQUE PAIRS" value={compactNumber(connectionsGraph.unique_pairs)} />
          <Stat label="AVG PER USER" value={connectionsGraph.avg_per_user ?? 0} />
          <Stat label="MEDIAN PER USER" value={connectionsGraph.median_per_user ?? 0} />
          <div className="bg-panel border border-line rounded-xl p-5 space-y-1">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              USERS WITH ZERO
            </div>
            <div className={`font-display font-bold text-26px md:text-[26px] ${isHighZeroUsers ? 'text-amber' : 'text-text'}`}>
              {compactNumber(usersWithZeroCount)}
            </div>
          </div>
        </div>

        {/* Section C: Distribution */}
        <Panel title="CONNECTIONS PER USER">
          <div className="space-y-3 pt-1">
            {distributionList.map((item) => {
              const isZeroBucket = item.bucket === '0'
              return (
                <div key={item.bucket} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium text-text">
                      {item.bucket} {item.bucket === '11+' ? 'connections' : 'connections'}
                    </span>
                    <span className="font-mono text-faint">
                      {compactNumber(item.users)} users
                    </span>
                  </div>
                  <Bar
                    value={item.users}
                    max={maxBucketUsers}
                    tone={isZeroBucket ? 'amber' : 'indigo'}
                  />
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Section D: Most Connected */}
        <Panel title="MOST CONNECTED">
          <DataTable
            columns={connectorColumns}
            rows={topConnectors}
            initialSort={{ key: 'connection_count', direction: 'desc' }}
            emptyMessage="No connections have been made yet."
            maxHeight="360px"
          />
        </Panel>
      </div>
    </div>
  )
}
