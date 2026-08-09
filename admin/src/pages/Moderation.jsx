import { useState, useEffect, useCallback, useMemo } from 'react'
import { getContentStats } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/ui/Panel'
import { Stat } from '../components/ui/Stat'
import { Bar } from '../components/ui/Bar'
import { Chip } from '../components/ui/Chip'
import { DataTable } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { Loading } from '../components/ui/Loading'
import { ErrorState } from '../components/ui/ErrorState'
import { compactNumber, relativeTime } from '../lib/format'

export function Moderation({ onRefresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchContentData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getContentStats(30)
      setData(res)
      setLoading(false)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContentData()
  }, [fetchContentData])

  const messagesStats = data?.messages || {}
  const byKindList = data?.by_kind || []
  const gamesStats = data?.games || {}
  const moderation = data?.moderation || {}
  const storageEstimate = data?.storage_estimate || {}

  const pendingReportsCount = moderation.reports_pending || 0
  const recentReportsList = moderation.recent_reports || []
  const reportsByReason = moderation.reports_by_reason || []

  // Max report reason count for Bar scaling
  const maxReasonCount = useMemo(() => {
    return reportsByReason.reduce((max, r) => Math.max(max, r.count || 0), 0)
  }, [reportsByReason])

  // Max message kind count for Bar scaling
  const maxKindCount = useMemo(() => {
    return byKindList.reduce((max, k) => Math.max(max, k.count || 0), 0)
  }, [byKindList])

  // DM Share & Circle Share percentages
  const totalMsgs = messagesStats.total || 0
  const dmSharePct = totalMsgs > 0 ? (((messagesStats.dm || 0) / totalMsgs) * 100).toFixed(1) : '0.0'
  const circleSharePct = totalMsgs > 0 ? (((messagesStats.circle || 0) / totalMsgs) * 100).toFixed(1) : '0.0'

  // Columns for Reports Table
  const reportColumns = [
    {
      key: 'reported_user_name',
      label: 'Reported',
      sortable: true,
      render: (row) => row.reported_user_name || '—',
    },
    {
      key: 'reason',
      label: 'Reason',
      sortable: true,
      render: (row) => {
        const r = (row.reason || '').toLowerCase()
        let tone = 'neutral'
        if (r === 'harassment' || r === 'safety_concern') tone = 'rose'
        else if (r === 'spam' || r === 'impersonation' || r === 'inappropriate_content') tone = 'amber'
        return <Chip label={r.replace(/_/g, ' ')} tone={tone} />
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const st = (row.status || '').toLowerCase()
        let tone = 'neutral'
        if (st === 'pending') tone = 'amber'
        else if (st === 'reviewed') tone = 'indigo'
        else if (st === 'actioned') tone = 'mint'
        return <Chip label={st} tone={tone} />
      },
    },
    {
      key: 'reporter_name',
      label: 'Reporter',
      sortable: true,
      render: (row) => row.reporter_name || 'Anonymous',
    },
    {
      key: 'created_at',
      label: 'When',
      sortable: true,
      render: (row) => relativeTime(row.created_at),
    },
  ]

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Moderation" onRefresh={fetchContentData} loading={loading} />
        <div className="space-y-6">
          <Loading className="h-[90px] w-full" />
          <Loading className="h-[400px] w-full" />
          <Loading className="h-[200px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Moderation" onRefresh={fetchContentData} loading={loading} />
        <ErrorState error={error} reload={fetchContentData} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Moderation" onRefresh={fetchContentData} loading={loading} />

      <div className="space-y-8">
        {/* Section A: Review Queue */}
        <div className="space-y-6">
          {/* Top 3 Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-panel border border-line rounded-xl p-5 space-y-1">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                PENDING REPORTS
              </div>
              <div className={`font-display font-bold text-26px md:text-[26px] ${pendingReportsCount > 0 ? 'text-amber' : 'text-mint'}`}>
                {compactNumber(pendingReportsCount)}
              </div>
            </div>

            <Stat label="TOTAL REPORTS" value={compactNumber(moderation.reports_total)} />
            <Stat label="BLOCKS" value={compactNumber(moderation.blocks_total)} />
          </div>

          {/* Reports Table */}
          <Panel title="REPORTS QUEUE">
            <DataTable
              columns={reportColumns}
              rows={recentReportsList}
              initialSort={{ key: 'created_at', direction: 'desc' }}
              emptyMessage="Nothing has been reported."
              maxHeight="520px"
            />
          </Panel>

          {/* Reports By Reason */}
          <Panel title="BY REASON">
            <div className="space-y-3 pt-1">
              {reportsByReason.length === 0 ? (
                <p className="font-body text-xs text-muted py-4 text-center">No reported reasons.</p>
              ) : (
                reportsByReason.map((item) => (
                  <div key={item.reason} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium uppercase text-text">
                        {item.reason ? item.reason.replace(/_/g, ' ') : 'Unknown'}
                      </span>
                      <span className="font-mono text-faint">
                        {compactNumber(item.count)} {item.count === 1 ? 'report' : 'reports'}
                      </span>
                    </div>
                    <Bar value={item.count} max={maxReasonCount} tone="amber" />
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* Section B: Content Volume Header Divider */}
        <div className="pt-4 border-t border-line space-y-6">
          <div className="font-mono text-[11px] font-medium tracking-[0.14em] text-indigo uppercase">
            CONTENT VOLUME
          </div>

          {/* 4 Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Stat label="MESSAGES TOTAL" value={compactNumber(messagesStats.total)} />
            <Stat label="MESSAGES 30D" value={compactNumber(messagesStats.in_period)} />
            <Stat label="DM SHARE" value={`${dmSharePct}%`} />
            <Stat label="CIRCLE SHARE" value={`${circleSharePct}%`} />
          </div>

          {/* By Kind Bar List */}
          <Panel title="BY KIND">
            {byKindList.length === 0 ? (
              <EmptyState message="Message kinds aren't being tracked yet." />
            ) : (
              <div className="space-y-3 pt-1">
                {byKindList.map((item) => (
                  <div key={item.kind} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium uppercase text-text">
                        {item.kind}
                      </span>
                      <span className="font-mono text-faint">
                        {compactNumber(item.count)} messages
                      </span>
                    </div>
                    <Bar value={item.count} max={maxKindCount} tone="indigo" />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Games Overview */}
          <Panel title="GAMES OVERVIEW">
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-line/40">
                <div className="space-y-1">
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                    TOTAL GAMES
                  </div>
                  <div className="font-display font-bold text-20px md:text-[20px] text-text">
                    {compactNumber(gamesStats.total)}
                  </div>
                </div>

                <div className="space-y-1 sm:pl-4 pt-3 sm:pt-0">
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                    IN PROGRESS
                  </div>
                  <div className="font-display font-bold text-20px md:text-[20px] text-amber">
                    {compactNumber(gamesStats.in_progress)}
                  </div>
                </div>

                <div className="space-y-1 sm:pl-4 pt-3 sm:pt-0">
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                    COMPLETED
                  </div>
                  <div className="font-display font-bold text-20px md:text-[20px] text-mint">
                    {compactNumber(gamesStats.completed)}
                  </div>
                </div>

                <div className="space-y-1 sm:pl-4 pt-3 sm:pt-0">
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                    ABANDONED
                  </div>
                  <div className="font-display font-bold text-20px md:text-[20px] text-muted">
                    {compactNumber(gamesStats.abandoned)}
                  </div>
                </div>
              </div>

              {/* Games By Type Chips */}
              {gamesStats.by_type && gamesStats.by_type.length > 0 && (
                <div className="pt-2 border-t border-line/40 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-faint uppercase mr-1">BY TYPE:</span>
                  {gamesStats.by_type.map((gt) => (
                    <Chip
                      key={gt.type}
                      label={`${gt.type.replace(/_/g, ' ')}: ${compactNumber(gt.count)}`}
                      tone="indigo"
                    />
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Section C: Storage (Row Counts) */}
        <Panel title="ROW COUNTS">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-6 max-w-md">
              <div className="space-y-1">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  MESSAGES ROWS
                </div>
                <div className="font-display font-bold text-20px md:text-[20px] text-text">
                  {compactNumber(storageEstimate.messages_rows)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  NOTIFICATIONS ROWS
                </div>
                <div className="font-display font-bold text-20px md:text-[20px] text-text">
                  {compactNumber(storageEstimate.notifications_rows)}
                </div>
              </div>
            </div>

            <p className="font-body text-xs text-muted">
              These two tables represent the fastest-growing row counts in the database.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
