/* Cockpit data model.
   Everything on screen is derived from three backend payloads:
     GET /api/signal       → signal, drivers, key levels, basis
     GET /api/chart-data   → composite score history (scoreLine)
     GET /api/price-hourly → hourly gold closes for the centre chart
   Nothing here recomputes the signal or invents figures — it only reshapes
   what the backend decided. */

export type Impact = 'bullish' | 'bearish' | 'neutral'

export interface SignalReason {
  factor: string
  score: number
  status: string
  impact: Impact
  detail: string
}

export interface SignalPayload {
  gold: number
  score: number
  bias: string
  tradeZone: string
  reasons: SignalReason[]
  keyLevels: { tp: number; sl: number; pivotHigh: number; pivotLow: number }
  continuation: string
  basis: { spot: number; futures: number; premium: number; warning: boolean | string | null }
  meta: {
    lastFetched: string
    updatedAgo: string
    bullishCount: number
    bearishCount: number
    neutralCount: number
  }
}

export interface ChartPayload {
  scoreLine: { time: string; value: number }[]
}

export interface HourlyPayload {
  candles: { time: number; close: number }[]
}

export interface Kpi {
  l: string
  v: string
  u: string
  span: string
  /** % change; omitted when the backend has no honest delta for the metric */
  d?: number
  text?: boolean
}

export interface Driver {
  n: string
  v: number
  status: string
  impact: Impact
  detail: string
  hub: string
}

export interface Level {
  n: string
  p: number
  kind: 'tp' | 'sl' | 'pivot' | 'spot'
  dist: number
}

export type Alert = [tag: string, text: string, level: 'a' | 'b']

export interface Model {
  signal: SignalPayload
  kpi: Kpi[]
  drivers: Driver[]
  levels: Level[]
  alerts: Alert[]
  candles: HourlyPayload['candles']
  scoreHistory: ChartPayload['scoreLine']
}

/* Each driver is anchored to the market hub that prices it, so selecting a
   driver turns the earth to where that force trades. */
export const DRIVER_HUB: Record<string, string> = {
  'USD Strength': 'New York',
  'Bond Yields': 'London',
  'Risk Sentiment': 'Chicago',
  'Geopolitical Tension': 'Dubai',
  'Inflation & Momentum': 'Hong Kong',
}

/* Bullion hubs shown on the earth — locations only, no figures. */
export const HUBS = [
  'London', 'New York', 'Shanghai', 'Zurich', 'Hong Kong', 'Dubai', 'Singapore',
  'Mumbai', 'Chicago', 'Tokyo', 'Frankfurt', 'Sydney', 'Johannesburg',
].map(city => ({ city }))

/* Auto tour sweeps the hubs that anchor the five drivers. */
export const TOUR = Array.from(new Set(Object.values(DRIVER_HUB))).map(hub => ({ hub }))

/* Trading sessions (UTC) — same windows the Killzone timing widget uses. */
const SESSIONS = [
  { name: 'Asia', from: 0, to: 8, hub: 'Tokyo' },
  { name: 'London', from: 7, to: 15, hub: 'London' },
  { name: 'New York', from: 13, to: 21, hub: 'New York' },
]

export const sessionNow = (d = new Date()) => {
  const h = d.getUTCHours() + d.getUTCMinutes() / 60
  const active = SESSIONS.filter(s => h >= s.from && h < s.to)
  return active.length ? active[active.length - 1] : null
}
export const sessionLabel = (d = new Date()) => {
  const s = sessionNow(d)
  return s ? s.name.toUpperCase() + ' SESSION' : 'OFF SESSION'
}

/** % change of the last candle against the candle `hours` earlier, or undefined if the series is too short. */
function changeOver(candles: HourlyPayload['candles'], hours: number): number | undefined {
  if (!candles.length) return undefined
  const last = candles[candles.length - 1]
  const target = last.time - hours * 3600
  let ref: { time: number; close: number } | undefined
  for (const c of candles) if (c.time <= target) ref = c
  if (!ref) return undefined
  return +(((last.close - ref.close) / ref.close) * 100).toFixed(2)
}

export function buildModel(signal: SignalPayload, chart: ChartPayload | null, hourly: HourlyPayload | null): Model {
  const candles = hourly?.candles ?? []
  const scoreHistory = chart?.scoreLine ?? []
  const price = signal.gold
  const m = signal.meta
  const premium = signal.basis.premium

  const kpi: Kpi[] = [
    { l: 'XAUUSD spot', v: price.toLocaleString('en-US', { minimumFractionDigits: 2 }), u: 'USD', d: changeOver(candles, 24), span: '24H' },
    { l: 'Signal score', v: signal.score.toFixed(1), u: '/100', span: 'COMPOSITE' },
    { l: 'Signal bias', v: signal.bias, u: '', text: true, span: `${m.bullishCount} BULL · ${m.bearishCount} BEAR` },
    { l: 'Trade zone', v: signal.tradeZone, u: '', text: true, span: 'SIGNAL ZONE' },
    { l: 'Futures basis', v: (premium >= 0 ? '+' : '') + premium.toFixed(1), u: 'USD',
      d: +((premium / signal.basis.spot) * 100).toFixed(2), span: 'PREMIUM' },
  ]

  const drivers: Driver[] = signal.reasons.map(r => ({
    n: r.factor, v: r.score, status: r.status, impact: r.impact, detail: r.detail,
    hub: DRIVER_HUB[r.factor] || '',
  }))

  const kl = signal.keyLevels
  const levels: Level[] = ([
    { n: 'Take profit', p: kl.tp, kind: 'tp' },
    { n: 'Pivot high', p: kl.pivotHigh, kind: 'pivot' },
    { n: 'Spot', p: price, kind: 'spot' },
    { n: 'Pivot low', p: kl.pivotLow, kind: 'pivot' },
    { n: 'Stop loss', p: kl.sl, kind: 'sl' },
  ] as const).map(l => ({ ...l, dist: +(((l.p - price) / price) * 100).toFixed(2) }))

  const alerts: Alert[] = [
    ['NOW', `${signal.bias} · score ${signal.score}/100 — ${signal.tradeZone}`, 'a'],
    ...signal.reasons.map((r): Alert => [
      'DRV', `${r.factor}: ${r.status} (${r.score}/100) — ${r.detail}`, r.impact === 'bearish' ? 'a' : 'b',
    ]),
    ['KEY', `Continuation: hold above $${kl.pivotLow.toFixed(0)}, break $${kl.pivotHigh.toFixed(0)} — ${signal.continuation}`, 'b'],
    ['BAS', `Spot $${signal.basis.spot.toFixed(1)} vs futures $${signal.basis.futures.toFixed(1)} — premium $${premium.toFixed(1)}${signal.basis.warning ? ' (warning)' : ''}`,
      signal.basis.warning ? 'a' : 'b'],
  ]

  return { signal, kpi, drivers, levels, alerts, candles, scoreHistory }
}
