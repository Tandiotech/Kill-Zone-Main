import type { DominanceModels } from '@/components/killzone-v2/dominance-models'
import type { DominanceResult } from '@/components/killzone-v2/score-utils'

/* The "red bars" from the original design: a simple bull/bear split per
   execution window (4h / 2h / 15m), unchanged in meaning from the legacy
   IntradayTimingPanel/DominanceBarRow — this reskins the same numbers in the
   cockpit's own dark palette (glow via color-mix on the cockpit's own --c3/
   --c5 tokens, not the legacy file's hardcoded rgba), restoring the glow,
   verdict badge and freshness stamp the legacy version had. */

function minsAgo(iso?: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return '<1m ago'
  if (mins < 60) return mins + 'm ago'
  return Math.floor(mins / 60) + 'h ago'
}

function Row({ label, r, sampledAt }: { label: string; r: DominanceResult; sampledAt?: string }) {
  const bull = Number(r.bullPct.toFixed(1))
  const bear = Number((100 - bull).toFixed(1))
  const lean = r.edge > 0 ? 'bull' : r.edge < 0 ? 'bear' : 'neutral'
  const leanLabel = lean === 'bull' ? 'BULLISH' : lean === 'bear' ? 'BEARISH' : 'NEUTRAL'
  const fresh = minsAgo(sampledAt)

  return (
    <div className="tmg">
      <div className="hd">
        <span className="nm">
          {label}
          {fresh && <span className="fresh">{fresh}</span>}
        </span>
        <span className={'lean ' + lean}>
          {leanLabel}
          <b>{r.edge > 0 ? '+' : ''}{r.edge.toFixed(1)} · {r.magnitude}</b>
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

export function TimingBars({
  timing,
  sampledAt,
}: {
  timing: DominanceModels
  sampledAt?: { fourH?: string; twoH?: string; fifteenM?: string }
}) {
  return (
    <div className="timing">
      <Row label="4-Hour" r={timing.intraday4h} sampledAt={sampledAt?.fourH} />
      <Row label="2-Hour" r={timing.intraday2h} sampledAt={sampledAt?.twoH} />
      <Row label="15-Minute" r={timing.intraday} sampledAt={sampledAt?.fifteenM} />
    </div>
  )
}
