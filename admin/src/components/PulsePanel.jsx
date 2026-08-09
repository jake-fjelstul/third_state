import { compactNumber } from '../lib/format'

export function PulsePanel({ activeData }) {
  const dau = activeData?.dau || 0
  const wau = activeData?.wau || 0
  const mau = activeData?.mau || 0
  const stickiness = activeData?.stickiness ? (activeData.stickiness * 100).toFixed(0) : '0'

  return (
    <div className="bg-panel border border-line rounded-xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-6">
      {/* Left & Center: DAU / WAU / MAU */}
      <div className="flex flex-wrap items-center gap-6 md:gap-8">
        {/* DAU */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-mint animate-pulse-live" />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              ACTIVE TODAY
            </span>
          </div>
          <div className="font-display font-bold text-36px md:text-[36px] tracking-tight text-text leading-none">
            {compactNumber(dau)}
          </div>
        </div>

        <div className="hidden sm:block h-10 w-[1px] bg-line" />

        {/* WAU */}
        <div className="space-y-1">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            7D ACTIVE (WAU)
          </div>
          <div className="font-display font-bold text-20px md:text-[20px] tracking-tight text-text leading-none">
            {compactNumber(wau)}
          </div>
        </div>

        <div className="hidden sm:block h-10 w-[1px] bg-line" />

        {/* MAU */}
        <div className="space-y-1">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            30D ACTIVE (MAU)
          </div>
          <div className="font-display font-bold text-20px md:text-[20px] tracking-tight text-text leading-none">
            {compactNumber(mau)}
          </div>
        </div>
      </div>

      {/* Right side: Stickiness */}
      <div className="space-y-1 text-left sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-line/40 w-full sm:w-auto">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          STICKINESS (DAU/MAU)
        </div>
        <div className="font-display font-bold text-20px md:text-[20px] tracking-tight text-text leading-none">
          {stickiness}%
        </div>
      </div>
    </div>
  )
}
