import { useEffect, useRef, useState } from 'react'
import Kit from './lib/kit.js'
import { constellation } from './lib/fx.js'
import * as geo from './lib/geo.js'
import { ALERTS, DRIVERS, HUBS, KPI, LEVELS, ROUTES, SIGNAL, TOUR, charts, draw, sessionLabel } from './lib/data.js'
import { renderRest, trendOpt } from './lib/charts.js'

interface Driver { n: string; v: number; q: number; status: string; impact: string; detail: string; hub: string }
interface Route { from: string; to: string; v: number; d: number; level?: string }
interface Earth { focus: (city: string) => void }

/* Zurich (LBMA vault corridor) is not in the shared city table; add it here
   rather than touch another module for one coordinate. */
Object.assign(geo.CITY, { Zurich: [8.54, 47.37] })

export default function App() {
  const [curDriver, setCurDriver] = useState<string | null>(null)
  const [curLevel, setCurLevel] = useState(-1)
  const [curRoute, setCurRoute] = useState(-1)
  const [pick, setPick] = useState<{ city: string; v: number | null } | null>(null)
  const [rtHint, setRtHint] = useState('Click to locate')
  const [clock, setClock] = useState({ t: '', d: '', s: '' })
  const [online, setOnline] = useState(true)
  const [lastOk, setLastOk] = useState(() => Date.now())
  const [tourIdx, setTourIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [theme, setTheme] = useState(0)

  const stage = useRef<HTMLDivElement>(null)
  const space = useRef<HTMLDivElement>(null)
  const earthHost = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const earth = useRef<Earth | null>(null)
  const idle = useRef(0)

  /* The earth starts a beat late: the first paint (KPIs and charts) comes
     first, and the 3D module's evaluation and scene build (a few hundred ms)
     stays off the critical path. Until the globe is ready, focus() calls from
     selection and the tour are guarded and skipped. */
  useEffect(() => {
    constellation(space.current, { count: 90, link: 118, speed: .05, alpha: .5 })
    const t = setTimeout(() => {
      import('./lib/globe.js').then(({ globe }) => globe(earthHost.current, {
        routes: ROUTES.map((r: Route) => ({ from: r.from, to: r.to, level: r.level })),
        markers: HUBS,
        onPick: (m: { city: string; v: number }) => {
          setPick({ city: m.city, v: m.v })
          const i = ROUTES.findIndex((r: Route) => r.from === m.city || r.to === m.city)
          if (i >= 0) setCurRoute(i)
        },
      })).then((g: Earth) => { earth.current = g })
    }, 0)
    return () => clearTimeout(t)
  }, [])

  /* ── proportional scaling: change the scale only, never reflow ────────── */
  useEffect(() => {
    const fit = () => {
      const k = Math.min(innerWidth / 1920, innerHeight / 1080)
      // At this k one axis lands exactly on the design size and the other has slack;
      // the stage takes that slack as extra design units so it covers the viewport.
      // Clamped, because a phone-shaped window would otherwise stretch a 432px rail
      // into a third of a very tall screen — past the clamp we accept a band and
      // centre, which is the honest failure for a screen designed to hang on a wall.
      const W = Math.min(2560, Math.max(1920, innerWidth / k))
      const H = Math.min(1600, Math.max(1080, innerHeight / k))
      const st = stage.current!
      st.style.width = W + 'px'
      st.style.height = H + 'px'
      // Translate first, then scale, both from the top-left: the offset is computed
      // from the *scaled* size, so the stage is always fully inside the viewport.
      st.style.transform =
        `translate(${(innerWidth - W * k) / 2}px, ${(innerHeight - H * k) / 2}px) scale(${k})`
      Object.values(charts).forEach((c) => (c as { resize: () => void }).resize())
    }
    addEventListener('resize', fit); fit()
    /* Theme flip: chart colours are resolved and baked in at setOption time, so a reskin rebuilds the options rather than replaying them. */
    Kit.themeToggle(() => { setTheme(n => n + 1); requestAnimationFrame(fit) }, top.current)
    return () => removeEventListener('resize', fit)
  }, [])

  useEffect(() => { renderRest() }, [theme])
  useEffect(() => { draw('trend', trendOpt()) }, [theme])

  /* ── clock + session + disconnect notice ────────────────────────────── */
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setClock({
        t: d.toTimeString().slice(0, 8),
        d: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'long' }),
        s: sessionLabel(d),
      })
      // A disconnect never passes stale data off as live: swap the copy and show the last-update time
      setOnline((Date.now() - lastOk) / 1000 <= 12)
    }
    const a = setInterval(tick, 1000); tick()
    const b = setInterval(() => setLastOk(Date.now()), 5000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [lastOk])

  /* ── auto tour when idle, paused by any interaction ─────────────────── */
  useEffect(() => {
    const id = setInterval(() => {
      idle.current++
      if (paused && idle.current > 30) setPaused(false)
      if (paused || idle.current % 12) return
      setTourIdx(i => {
        const next = (i + 1) % TOUR.length, t = TOUR[next]
        setCurDriver(null); setCurRoute(-1); setPick(null)
        earth.current?.focus(t.hub)
        return next
      })
    }, 1000)
    const onAct = () => { idle.current = 0; setPaused(true) }
    const evs = ['click', 'keydown', 'wheel'] as const
    evs.forEach(ev => addEventListener(ev, onAct))
    return () => { clearInterval(id); evs.forEach(ev => removeEventListener(ev, onAct)) }
  }, [paused])

  /* ── driver selection (turns the earth to where the force trades) ────── */
  const max = Math.max(...DRIVERS.map((r: Driver) => r.v))
  const sel = (r: Driver) => {
    setCurDriver(r.n); setCurLevel(-1)
    if (r.hub && geo.CITY[r.hub]) { earth.current?.focus(r.hub); setPick({ city: r.hub, v: null }) }
    setRtHint(r.n + ' · ' + r.hub)
  }

  const selLevel = (i: number) => {
    setCurLevel(i); setCurDriver(null)
    const lv = LEVELS[i]
    setRtHint(lv.n + ' $' + lv.p.toFixed(1))
  }

  return (
    <div id="stage" ref={stage}>
      <div id="space" ref={space} />

      <div className="top" ref={top}>
        <div className="title">AGGRESSIVE TOOL<small>DAVY · XAUUSD SIGNAL INTELLIGENCE</small></div>
        <div className="crumb" id="crumb">
          <span className="cur">{clock.s || 'SESSION'}</span>
          <span>›</span>
          <span>{SIGNAL.bias} · {SIGNAL.score.toFixed(1)}/100</span>
          <span>›</span>
          <span>{SIGNAL.tradeZone}</span>
        </div>
        <div className="spacer" />
        <div className="affil">AFFILIATE · DAVY</div>
        <div className={'live' + (online ? '' : ' off')} id="live">
          <span className="blip" />
          <span id="liveTxt">
            {online ? 'LIVE' : 'DISCONNECTED · LAST UPDATE ' + new Date(lastOk).toTimeString().slice(0, 5)}</span>
        </div>
        <div className="clock"><span id="clk">{clock.t}</span><small id="dte">{clock.d}</small></div>
      </div>

      <div className="body">
        {/* left rail */}
        <div className="col">
          <div className="card">
            <h2>Signal drivers<span className="r" id="rankHint">Click to locate the market</span></h2>
            <div className="rank" id="rank">
              {DRIVERS.map((r: Driver, i: number) => (
                <div className={'rk ' + (curDriver === r.n ? 'sel' : '')}
                     data-n={r.n} data-hub={r.hub || ''} key={r.n}
                     onClick={() => sel(r)}>
                  <div className={'no ' + (i < 3 ? 't3' : '')}>{i + 1}</div>
                  <div className="nm">{r.n}</div>
                  <div className="track"><div className="fill" style={{
                    width: r.v / max * 100 + '%',
                    background: r.impact === 'bearish' ? 'var(--c5)' : undefined }} /></div>
                  <div className="v">{r.v}</div>
                  <div className="p" style={{ color: r.impact === 'bearish' ? 'var(--c5)' : 'var(--c3)' }}>
                    {r.impact === 'bearish' ? 'BEAR' : 'BULL'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card"><h2>Signal composition</h2><div className="chart" id="mix" /></div>
          <div className="card"><h2>Driver scores<span className="r">0–100</span></h2><div className="chart" id="turn" /></div>
        </div>

        {/* centre: the 3D earth */}
        <div className="mid">
          <div className="kpibar" id="kpibar">
            {KPI.map(k => {
              const up = k.d >= 0, good = k.good ? !up : up
              return (
                <div className="kpi" key={k.l}>
                  <div className="l">{k.l}</div>
                  <div className="v" style={k.text ? { fontSize: '1.35em', letterSpacing: '.04em' } : undefined}>
                    {k.v}<u>{k.u}</u></div>
                  <div className={'d ' + (good ? 'up' : 'down')}>
                    {k.text
                      ? <span>{k.span}</span>
                      : <>{(up ? '▲' : '▼') + ' ' + Math.abs(k.d) + '%'}<span>{k.span}</span></>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="globe">
            <div id="earth" ref={earthHost} />
            <div className="hud"><i /><i /><i /><i /></div>
            <div className="gtitle"><b>GLOBAL GOLD FLOW NETWORK</b><small>BULLION HUBS · FLOWS · REALTIME</small></div>
            <div className="readout" id="readout">
              {pick ? <>
                <span>Selected hub</span><b>{pick.city}</b>
                <span className="k">{'Flow index ' + (pick.v ?? '—')}</span>
                {curDriver && <span className="k">{DRIVERS.find((d: Driver) => d.n === curDriver)?.detail}</span>}
              </> : <>
                <span>Hubs</span><b>{HUBS.length}</b><span>· Flows</span><b>{ROUTES.length}</b>
                <span className="k">
                  {'TP $' + SIGNAL.keyLevels.tp.toFixed(0) + ' · SL $' + SIGNAL.keyLevels.sl.toFixed(0)}</span>
              </>}
            </div>
            <div className="ghint">Drag to rotate · click a hub or a driver to locate</div>
          </div>

          <div className="card">
            <h2>Gold price · 1H with key levels<span className="r" id="trendScope">TP / SL / PIVOTS</span></h2>
            <div className="chart" id="trend" />
          </div>
        </div>

        {/* right rail */}
        <div className="col">
          <div className="card">
            <h2>Key levels<span className="r" id="rtHint">{rtHint}</span></h2>
            <div className="routes" id="routes">
              {LEVELS.map((l, i) => (
                <div className={'rt ' + (i === curLevel ? 'sel' : '')} data-i={i} key={l.n}
                     onClick={() => selLevel(i)}>
                  <span className="pair">{l.n}</span>
                  <span className="amt" style={{ color: l.kind === 'sl' ? 'var(--c5)' : l.kind === 'tp' ? 'var(--c3)' : 'var(--ink)' }}>
                    {'$' + l.p.toFixed(1)}</span>
                  <span className="dl" style={{ color: l.dist >= 0 ? 'var(--c3)' : 'var(--c5)' }}>
                    {l.kind === 'spot' ? 'SPOT' : (l.dist >= 0 ? '+' : '') + l.dist + '%'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Live signal feed<span className="r" id="alCount">
              {ALERTS.filter((a: string[]) => a[2] === 'a').length + ' critical'}</span></h2>
            <div className="alerts"><div className="lane" id="alerts">
              {ALERTS.concat(ALERTS).map(([t, x, lv]: string[], i: number) => (
                <div className={'al ' + (lv === 'a' ? 'hi' : '')} key={i}>
                  <span className="t">{t}</span>
                  <span className="x">{x}</span>
                  <span className={'lv ' + lv}>{lv === 'a' ? 'HIGH' : 'MED'}</span>
                </div>
              ))}
            </div></div>
          </div>
          <div className="card"><h2>Composite score history</h2><div className="chart" id="cash" /></div>
        </div>
      </div>

      <div className="dots" id="dots">
        <span id="tourTxt">{paused ? 'TOUR PAUSED' : 'AUTO TOUR'}</span>
        {TOUR.map((_: unknown, i: number) => <i className={i === tourIdx ? 'on' : ''} key={i} />)}
      </div>
    </div>
  )
}
