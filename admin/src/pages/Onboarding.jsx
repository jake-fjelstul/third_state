import { useState, useEffect, useCallback, useMemo } from 'react'
import { getOnboardingFunnel } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/ui/Panel'
import { Stat } from '../components/ui/Stat'
import { Bar } from '../components/ui/Bar'
import { Loading } from '../components/ui/Loading'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import { compactNumber } from '../lib/format'

export function Onboarding({ onRefresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchFunnelData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getOnboardingFunnel()
      setData(res)
      setLoading(false)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFunnelData()
  }, [fetchFunnelData])

  const steps = data?.steps || []
  const totalUsers = data?.total_users || 0
  const isEmpty = totalUsers === 0

  // Calculate largest drop between consecutive steps
  const { maxDropIndex, drops } = useMemo(() => {
    let maxDrop = -1
    let maxIdx = -1
    const list = []

    for (let i = 0; i < steps.length - 1; i++) {
      const curr = steps[i]
      const next = steps[i + 1]
      const dropCount = Math.max(0, curr.users - next.users)
      const dropPct = curr.users > 0 ? ((dropCount / curr.users) * 100).toFixed(1) : '0.0'

      list.push({
        fromStep: curr.step,
        toStep: next.step,
        fromLabel: curr.label,
        toLabel: next.label,
        dropCount,
        dropPct,
      })

      if (dropCount > maxDrop && dropCount > 0) {
        maxDrop = dropCount
        maxIdx = i
      }
    }

    return { maxDropIndex: maxIdx, drops: list }
  }, [steps])

  // Narrative text generation
  const narrative = useMemo(() => {
    if (isEmpty || !steps.length) return null

    const s1 = steps.find((s) => s.step === 1)
    const s7 = steps.find((s) => s.step === 7)
    const s8 = steps.find((s) => s.step === 8)
    const s9 = steps.find((s) => s.step === 9)

    const endToEndPct = s1?.users > 0 ? ((s9?.users / s1.users) * 100).toFixed(1) : '0.0'
    const largestDropInfo = maxDropIndex >= 0 ? drops[maxDropIndex] : null

    let sentence1 = 'No significant drop-offs were detected across the funnel steps.'
    if (largestDropInfo && largestDropInfo.dropCount > 0) {
      sentence1 = `The largest stall point occurs between "${largestDropInfo.fromLabel}" and "${largestDropInfo.toLabel}", where ${compactNumber(largestDropInfo.dropCount)} users (${largestDropInfo.dropPct}%) dropped off.`
    }

    const sentence2 = `Overall end-to-end completion rate from account creation to connection is ${endToEndPct}%.`
    const sentence3 = `Currently, ${compactNumber(s7?.users || 0)} users have joined a circle, ${compactNumber(s8?.users || 0)} have RSVP'd to an event, and ${compactNumber(s9?.users || 0)} have made a connection.`

    return `${sentence1} ${sentence2} ${sentence3}`
  }, [isEmpty, steps, maxDropIndex, drops])

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Onboarding" onRefresh={fetchFunnelData} loading={loading} />
        <div className="space-y-6">
          <Loading className="h-[480px] w-full" />
          <Loading className="h-[120px] w-full" />
          <Loading className="h-[100px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Onboarding" onRefresh={fetchFunnelData} loading={loading} />
        <ErrorState error={error} reload={fetchFunnelData} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Onboarding" onRefresh={fetchFunnelData} loading={loading} />

      {isEmpty ? (
        <EmptyState message="No one has signed up yet." />
      ) : (
        <div className="space-y-6">
          {/* Section A: Vertical Descending Funnel */}
          <Panel title="ONBOARDING FUNNEL">
            <div className="space-y-1">
              {steps.map((step, idx) => {
                const drop = drops[idx]
                const isLargestDrop = idx === maxDropIndex && drop && drop.dropCount > 0

                return (
                  <div key={step.step}>
                    {/* Step Row */}
                    <div className="flex items-center gap-4 py-3">
                      {/* Left Gutter: 56px */}
                      <div className="w-[56px] shrink-0 font-mono text-[11px] font-medium text-faint">
                        STEP {step.step}
                      </div>

                      {/* Label & User Count */}
                      <div className="w-[180px] shrink-0">
                        <div className="font-body text-sm font-medium text-text">
                          {step.label}
                        </div>
                        <div className="font-display font-bold text-24px md:text-[24px] text-text leading-none mt-0.5">
                          {compactNumber(step.users)}
                        </div>
                      </div>

                      {/* Proportional Bar */}
                      <div className="flex-1">
                        <Bar value={step.pct_of_total} max={100} tone="indigo" className="!h-[10px]" />
                      </div>

                      {/* Right Percentage */}
                      <div className="w-[60px] text-right font-mono text-[12px] font-medium text-faint shrink-0">
                        {step.pct_of_total}%
                      </div>
                    </div>

                    {/* Drop Connector Between Rows */}
                    {drop && drop.dropCount > 0 && (
                      <div className="flex items-center gap-4 py-1.5 my-1">
                        <div className="w-[56px] shrink-0" />
                        <div
                          className={`flex-1 pl-4 py-1.5 flex items-center gap-2 rounded-r-md transition-colors ${
                            isLargestDrop
                              ? 'border-l-2 border-rose bg-rose/10'
                              : 'border-l border-line/40 bg-raised/30'
                          }`}
                        >
                          <span
                            className={`font-mono text-[11px] uppercase tracking-wider ${
                              isLargestDrop ? 'text-rose font-bold' : 'text-rose/55 font-medium'
                            }`}
                          >
                            −{compactNumber(drop.dropCount)} DROPPED ({drop.dropPct}%)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Section B: The Read */}
          <Panel title="WHERE PEOPLE STALL">
            <p className="font-body text-[14px] text-text leading-relaxed">
              {narrative}
            </p>
          </Panel>

          {/* Section C: Completion Mix (6 Profile Signals) */}
          <div>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint mb-3">
              COMPLETION MIX
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {steps.slice(1, 7).map((step) => (
                <div key={step.step} className="bg-panel border border-line rounded-xl p-4 space-y-2">
                  <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint truncate">
                    {step.label}
                  </div>
                  <div className="font-display font-bold text-20px md:text-[20px] text-text leading-none">
                    {step.pct_of_total}%
                  </div>
                  <Bar value={step.pct_of_total} max={100} tone="indigo" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
