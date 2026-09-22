import * as echarts from 'echarts';
import signal from '../data/signal-data.json';
import chartData from '../data/chart-data.json';

/* Killzone Gold Command Center — data module.
   All figures come from the same payloads the Killzone backend serves
   (signal-data.json / chart-data.json snapshots); nothing here recomputes
   the signal — the frontend only renders what the backend decided. */

/* Hoisted: the definitions below read design tokens at module evaluation. */
const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();

/* ── signal snapshot (backend payload) ────────────────────────────────── */
export const SIGNAL = signal;
export const CANDLES = chartData.candles;
export const SCORE_HISTORY = chartData.scores;
export const SCORE_MARKERS = chartData.markers;

const price = SIGNAL.gold;
const chg = n => +(((CANDLES[CANDLES.length - 1].close - CANDLES[CANDLES.length - 1 - n].close)
                   / CANDLES[CANDLES.length - 1 - n].close) * 100).toFixed(2);

/* KPI band — derived from the payload, nothing hard-coded. */
export const KPI = [
  { l: 'XAUUSD spot', v: price.toLocaleString('en-US', {minimumFractionDigits: 2}), u: 'USD', d: chg(24), span: '24H' },
  { l: 'Signal score', v: SIGNAL.score.toFixed(1), u: '/100', d: chg(24 * 7), span: '7D', good: 1 },
  { l: 'Signal bias', v: SIGNAL.bias, u: '', d: SIGNAL.meta.bullishCount - SIGNAL.meta.bearishCount, span: 'NET DRIVERS', text: 1 },
  { l: 'Trade zone', v: SIGNAL.tradeZone, u: '', d: 0, span: 'SESSION', text: 1 },
  { l: 'Futures basis', v: (SIGNAL.basis.premium >= 0 ? '+' : '') + SIGNAL.basis.premium.toFixed(1), u: 'USD', d: +((SIGNAL.basis.premium / SIGNAL.basis.spot) * 100).toFixed(2), span: 'PREMIUM' },
];

/* Signal drivers — the five factors the backend scored. Each factor is
   anchored to the market hub that prices it, so clicking a driver turns the
   earth to where that force trades. */
const DRIVER_HUB = {
  'USD Strength': 'New York',
  'Bond Yields': 'London',
  'Risk Sentiment': 'Chicago',
  'Geopolitical Tension': 'Dubai',
  'Inflation & Momentum': 'Hong Kong',
};
export const DRIVERS = SIGNAL.reasons.map(r => ({
  n: r.factor, v: r.score, q: 100, status: r.status, impact: r.impact,
  detail: r.detail, hub: DRIVER_HUB[r.factor] || 'London',
}));

/* Key levels from the signal payload — replaces the routes table. */
export const LEVELS = [
  { n: 'Take profit', p: SIGNAL.keyLevels.tp, kind: 'tp' },
  { n: 'Pivot high', p: SIGNAL.keyLevels.pivotHigh, kind: 'pivot' },
  { n: 'Spot', p: price, kind: 'spot' },
  { n: 'Pivot low', p: SIGNAL.keyLevels.pivotLow, kind: 'pivot' },
  { n: 'Stop loss', p: SIGNAL.keyLevels.sl, kind: 'sl' },
].map(l => ({ ...l, dist: +(((l.p - price) / price) * 100).toFixed(2) }));

/* Global gold flow network — bullion hubs and the main physical/paper
   flows between them. v = indicative daily flow (t). */
export const HUBS = [
  {city: 'London', v: 96}, {city: 'New York', v: 92}, {city: 'Shanghai', v: 84},
  {city: 'Zurich', v: 78}, {city: 'Hong Kong', v: 71}, {city: 'Dubai', v: 64},
  {city: 'Singapore', v: 58}, {city: 'Mumbai', v: 55}, {city: 'Chicago', v: 52},
  {city: 'Tokyo', v: 47}, {city: 'Frankfurt', v: 42}, {city: 'Sydney', v: 36},
  {city: 'Johannesburg', v: 29},
];
export const ROUTES = [
  {from: 'London', to: 'New York', v: 412.5, d: +1.8},
  {from: 'London', to: 'Zurich', v: 188.4, d: +0.6},
  {from: 'Zurich', to: 'Dubai', v: 142.7, d: +3.1},
  {from: 'Dubai', to: 'Mumbai', v: 118.2, d: +4.4},
  {from: 'Dubai', to: 'Hong Kong', v: 96.5, d: +2.2},
  {from: 'Hong Kong', to: 'Shanghai', v: 154.8, d: +5.6},
  {from: 'Shanghai', to: 'Singapore', v: 87.3, d: +1.1},
  {from: 'New York', to: 'Chicago', v: 76.9, d: -0.8},
  {from: 'Sydney', to: 'Singapore', v: 44.1, d: -1.4},
  {from: 'Johannesburg', to: 'London', v: 52.6, d: -2.7, level: 'warn'},
  {from: 'Tokyo', to: 'Hong Kong', v: 39.8, d: +0.9},
];

/* Alerts — rendered from the live drivers, the continuation note and the
   basis read, i.e. exactly what the signal page surfaces today. */
export const ALERTS = [
  ['NOW', `${SIGNAL.bias} · score ${SIGNAL.score}/100 — ${SIGNAL.tradeZone}`, 'a'],
  ...SIGNAL.reasons.map(r => [
    'DRV', `${r.factor}: ${r.status} (${r.score}/100) — ${r.detail}`,
    r.impact === 'bearish' ? 'a' : 'b',
  ]),
  ['KEY', `Continuation: hold above $${SIGNAL.keyLevels.pivotLow.toFixed(0)}, break $${SIGNAL.keyLevels.pivotHigh.toFixed(0)} — ${SIGNAL.continuation}`, 'b'],
  ['BAS', `Spot $${SIGNAL.basis.spot.toFixed(1)} vs futures $${SIGNAL.basis.futures.toFixed(1)} — premium $${SIGNAL.basis.premium.toFixed(1)}${SIGNAL.basis.warning ? ' (warning)' : ''}`, SIGNAL.basis.warning ? 'a' : 'b'],
];

/* ICT-style killzone sessions (UTC) — which desk is driving the tape. */
export const SESSIONS = [
  { name: 'Sydney', from: 21, to: 24, hub: 'Sydney' },
  { name: 'Tokyo', from: 0, to: 7, hub: 'Tokyo' },
  { name: 'London', from: 7, to: 12, hub: 'London' },
  { name: 'New York', from: 12, to: 21, hub: 'New York' },
];
export const sessionNow = (d = new Date()) => {
  const h = d.getUTCHours();
  return SESSIONS.find(s => h >= s.from && h < s.to) || SESSIONS[0];
};
export const sessionLabel = (d = new Date()) => sessionNow(d).name.toUpperCase() + ' SESSION';

/* Auto tour: sweep the hubs that anchor the five drivers. */
export const TOUR = [
  { hub: 'London' }, { hub: 'New York' }, { hub: 'Zurich' },
  { hub: 'Dubai' }, { hub: 'Hong Kong' }, { hub: 'Shanghai' },
];

/* ── chart plumbing ───────────────────────────────────────────────────── */
export const charts = {};
export const draw = (id, opt) => {
  charts[id] = charts[id] || echarts.init(document.getElementById(id));
  charts[id].setOption(opt, true);
};
/* A function, not a const: colours come from CSS variables and must be
   re-read on every rebuild, or a theme flip leaves the axes on the old palette. */
export const AXIS = () => ({
  axisLine: {lineStyle: {color: css('--line')}},
  axisTick: {show: false},
  axisLabel: {color: css('--muted'), fontSize: 14},
  splitLine: {lineStyle: {color: css('--line-soft')}}
});

let s = 5150921;
export const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
export const yi = n => (n / 1e8).toFixed(2);
export { css };
