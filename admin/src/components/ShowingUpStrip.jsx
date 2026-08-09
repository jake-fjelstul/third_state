import { Panel } from './ui/Panel'
import { compactNumber } from '../lib/format'

export function ShowingUpStrip({ funnelData }) {
  const total = funnelData?.total_users || 0
  const steps = funnelData?.steps || []

  const s1 = steps.find((s) => s.step === 1)?.users || total || 0
  const s7 = steps.find((s) => s.step === 7)?.users || 0
  const s8 = steps.find((s) => s.step === 8)?.users || 0

  const s2Width = s1 > 0 ? Math.min(100, (s7 / s1) * 100) : 0
  const s3Width = s1 > 0 ? Math.min(100, (s8 / s1) * 100) : 0

  const s2Conv = s1 > 0 ? Math.round((s7 / s1) * 100) : 0
  const s3Conv = s7 > 0 ? Math.round((s8 / s7) * 100) : 0

  const isEmpty = s1 === 0

  return (
    <Panel title="FUNNEL · SHOWING UP">
      <div className="space-y-4">
        {/* Stage Labels Above Track */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              SIGNED UP
            </div>
          </div>
          <div>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              JOINED A CIRCLE
            </div>
          </div>
          <div>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              SHOWED UP
            </div>
          </div>
        </div>

        {/* Continuous Horizontal Track (56px tall) */}
        {isEmpty ? (
          <div className="h-[56px] w-full rounded-lg border border-line border-dashed bg-transparent" />
        ) : (
          <div className="relative h-[56px] w-full rounded-lg overflow-hidden bg-raised border border-line">
            {/* Stage 2 segment overlay (indigo 35% opacity) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-indigo/35 transition-all duration-500"
              style={{ width: `${s2Width}%` }}
            />
            {/* Stage 3 segment overlay (solid indigo) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-indigo transition-all duration-500"
              style={{ width: `${s3Width}%` }}
            />
          </div>
        )}

        {/* Stage Figures & Conversion Below Track */}
        <div className="grid grid-cols-3 gap-4 pt-1">
          <div>
            <div className="font-display font-bold text-28px md:text-[28px] tracking-tight text-text leading-none mb-1">
              {compactNumber(s1)}
            </div>
            <div className="font-mono text-[11px] font-medium text-faint uppercase">
              100% TOTAL
            </div>
          </div>

          <div>
            <div className="font-display font-bold text-28px md:text-[28px] tracking-tight text-text leading-none mb-1">
              {compactNumber(s7)}
            </div>
            <div className="font-mono text-[11px] font-medium text-faint uppercase">
              {s2Conv}% OF SIGNUPS
            </div>
          </div>

          <div>
            <div className="font-display font-bold text-28px md:text-[28px] tracking-tight text-text leading-none mb-1">
              {compactNumber(s8)}
            </div>
            <div className="font-mono text-[11px] font-medium text-faint uppercase">
              {s3Conv}% OF JOINERS
            </div>
          </div>
        </div>

        {/* Thesis Summary Sentence */}
        <p className="font-body text-[13px] text-muted pt-2 border-t border-line/50">
          {isEmpty
            ? 'No one has signed up yet.'
            : `${compactNumber(s8)} of ${compactNumber(s1)} people who signed up have attended a real event.`}
        </p>
      </div>
    </Panel>
  )
}
