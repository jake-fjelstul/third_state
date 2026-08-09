import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { getOverview, getGrowthSeries, getOnboardingFunnel } from '../lib/api'
import { ShowingUpStrip } from '../components/ShowingUpStrip'
import { PulsePanel } from '../components/PulsePanel'
import { GrowthChart } from '../components/GrowthChart'
import { Stat } from '../components/ui/Stat'
import { Delta } from '../components/ui/Delta'
import { Panel } from '../components/ui/Panel'
import { Loading } from '../components/ui/Loading'
import { ErrorState } from '../components/ui/ErrorState'
import { compactNumber } from '../lib/format'

export function Overview({ period, refreshTrigger }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [overviewRes, growthRes, funnelRes] = await Promise.all([
        getOverview(period),
        getGrowthSeries(period),
        getOnboardingFunnel(),
      ])
      setData({
        overview: overviewRes,
        growth: growthRes,
        funnel: funnelRes,
      })
      setLoading(false)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData, refreshTrigger])

  if (loading) {
    return (
      <div className="space-y-6">
        <Loading className="h-[220px] w-full" />
        <Loading className="h-[90px] w-full" />
        <Loading className="h-[340px] w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Loading className="h-[100px] w-full" count={4} />
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState error={error} reload={fetchAllData} />
  }

  const { overview, growth, funnel } = data || {}
  const totals = overview?.totals || {}
  const newInPeriod = overview?.new_in_period || {}
  const prevPeriod = overview?.prev_period || {}
  const active = overview?.active || {}
  const averages = overview?.averages || {}

  const reportsPending = totals.reports_pending || 0

  return (
    <div className="space-y-6">
      {/* 1. Showing Up Strip */}
      <ShowingUpStrip funnelData={funnel} />

      {/* 2. Pulse Panel */}
      <PulsePanel activeData={active} />

      {/* 3. Growth Chart */}
      <GrowthChart
        seriesData={growth?.series}
        newInPeriod={newInPeriod}
        prevPeriod={prevPeriod}
      />

      {/* 4. Totals Row (4-up Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="CIRCLES"
          value={compactNumber(totals.circles)}
          delta={<Delta now={newInPeriod.circles} prev={prevPeriod.circles} />}
        />
        <Stat
          label="EVENTS"
          value={compactNumber(totals.events)}
          delta={<Delta now={newInPeriod.events} prev={prevPeriod.events} />}
        />
        <Stat
          label="CONNECTIONS"
          value={compactNumber(totals.connections_unique)}
          delta={<Delta now={newInPeriod.connections} prev={prevPeriod.connections} />}
        />
        <Stat
          label="MESSAGES"
          value={compactNumber(totals.messages)}
          delta={<Delta now={newInPeriod.messages} prev={prevPeriod.messages} />}
        />
      </div>

      {/* 5. Averages Row */}
      <Panel title="AVERAGES">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-line/40 pt-1">
          <div className="space-y-1">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              CIRCLES / USER
            </div>
            <div className="font-display font-bold text-18px md:text-[18px] text-text">
              {averages.circles_per_user ?? 0}
            </div>
          </div>

          <div className="space-y-1 sm:pl-6 pt-4 sm:pt-0">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              CONNECTIONS / USER
            </div>
            <div className="font-display font-bold text-18px md:text-[18px] text-text">
              {averages.connections_per_user ?? 0}
            </div>
          </div>

          <div className="space-y-1 sm:pl-6 pt-4 sm:pt-0">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              MEMBERS / CIRCLE
            </div>
            <div className="font-display font-bold text-18px md:text-[18px] text-text">
              {averages.members_per_circle ?? 0}
            </div>
          </div>

          <div className="space-y-1 sm:pl-6 pt-4 sm:pt-0">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              ATTENDEES / EVENT
            </div>
            <div className="font-display font-bold text-18px md:text-[18px] text-text">
              {averages.attendees_per_event ?? 0}
            </div>
          </div>
        </div>
      </Panel>

      {/* 6. Moderation Banner */}
      {reportsPending > 0 && (
        <div className="bg-amber/10 border border-amber/40 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Flag className="w-5 h-5 text-amber shrink-0" />
            <span className="font-body text-sm font-medium text-text">
              {reportsPending} {reportsPending === 1 ? 'report' : 'reports'} waiting for review.
            </span>
          </div>
          <Link
            to="/moderation"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-amber hover:underline shrink-0"
          >
            Review →
          </Link>
        </div>
      )}
    </div>
  )
}
