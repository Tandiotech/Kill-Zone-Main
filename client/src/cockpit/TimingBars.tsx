import type { DominanceModels } from '@/components/killzone-v2/dominance-models'
import type { DominanceResult } from '@/components/killzone-v2/score-utils'

/* The "red bars" from the original design: a simple bull/bear split per
   execution window (4h / 2h / 15m), unchanged in meaning from the legacy
   IntradayTimingPanel/DominanceBarRow — this just reskins the same numbers
   in the cockpit's own dark palette instead of pulling in killzone-v2.css. */

function Row({ label, r }: { label: string; r: DominanceResult }) {
  const bull = Number(r.bullPct.toFixed(1))
  const bear = Number((100 - bull).toFixed(1))
  const lean = r.edge > 0 ? 'bull' : r.edge < 0 ? 'bear' : 'neutral'
  const leanLabel = lean === 'bull' ? 'BULLISH' : lean === 'bear' ? 'BEARISH' : 'NEUTRAL'

  return (
    <div className="tmg">
      <div className="hd">
        <span className="nm">{label}</span>
        <span className={'lean ' + lean}>
          {leanLabel}
          <b>{r.edge > 0 ? '+' : ''}{r.edge.toFixed(1)}</b>
        </span>
      </div>
      <div className="track">
        <div className="bull" style={{ width: bull + '%' }}>
          {bull >= 18 && <span>{bull.toFixed(0)}%</span>}
        </div>
        <div className="bear" style={{ width: bear + '%' }}>
          {bear >= 18 && <span>{bear.toFixed(0)}%</span>}
        </div>
      </div>
    </div>
  )
}

export function TimingBars({ timing }: { timing: DominanceModels }) {
  return (
    <div className="timing">
      <Row label="4-Hour" r={timing.intraday4h} />
      <Row label="2-Hour" r={timing.intraday2h} />
      <Row label="15-Minute" r={timing.intraday} />
    </div>
  )
}
