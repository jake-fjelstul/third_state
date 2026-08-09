import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Panel } from './ui/Panel'
import { Delta } from './ui/Delta'
import { dateLabel, compactNumber } from '../lib/format'

export function GrowthChart({ seriesData, newInPeriod, prevPeriod }) {
  const [metric, setMetric] = useState('signups')

  const metrics = [
    { key: 'signups', label: 'Signups', periodKey: 'users' },
    { key: 'active_users', label: 'Active users', periodKey: null },
    { key: 'messages', label: 'Messages', periodKey: 'messages' },
    { key: 'events_created', label: 'Events', periodKey: 'events' },
    { key: 'connections', label: 'Connections', periodKey: 'connections' },
  ]

  const currentMetric = metrics.find((m) => m.key === metric) || metrics[0]
  const data = seriesData || []

  // Total for the selected metric
  const periodKey = currentMetric.periodKey
  const totalNow = periodKey ? newInPeriod?.[periodKey] ?? 0 : data.reduce((acc, curr) => acc + (curr[metric] || 0), 0)
  const totalPrev = periodKey ? prevPeriod?.[periodKey] ?? 0 : null

  // Custom recharts tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value
      return (
        <div className="bg-raised border border-line rounded-lg p-3 shadow-xl">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint mb-1">
            {dateLabel(label)}
          </div>
          <div className="font-display font-bold text-16px md:text-[16px] text-text">
            {compactNumber(val)} {currentMetric.label.toLowerCase()}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Panel
      title="GROWTH OVER TIME"
      action={
        <div className="flex flex-wrap items-center gap-1">
          {metrics.map((m) => {
            const isActive = metric === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`px-2.5 py-1 text-[11px] font-mono font-medium uppercase rounded-md transition-colors ${
                  isActive
                    ? 'bg-raised text-text shadow-xs'
                    : 'text-faint hover:text-text'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Recharts AreaChart */}
        <div className="h-[260px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIndigo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B6FFF" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#7B6FFF" stopOpacity={0.0} />
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
                interval="preserveStartEnd"
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
              <Area
                type="monotone"
                dataKey={metric}
                stroke="#7B6FFF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIndigo)"
                dot={false}
                activeDot={{ r: 4, fill: '#7B6FFF', stroke: '#1C1C26', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Below Chart Summary Line */}
        <div className="flex items-center gap-3 pt-2 border-t border-line/40">
          <span className="font-mono text-[11px] text-faint uppercase">
            PERIOD TOTAL:
          </span>
          <span className="font-display font-bold text-sm text-text">
            {compactNumber(totalNow)}
          </span>
          {totalPrev !== null && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-line">
              <span className="font-mono text-[11px] text-faint uppercase">
                VS PREVIOUS:
              </span>
              <Delta now={totalNow} prev={totalPrev} />
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}
