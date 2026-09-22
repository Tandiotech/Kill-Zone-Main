import { useEffect, useRef, useState } from 'react'
import Kit from './lib/kit.js'
import { constellation } from './lib/fx.js'
import * as geo from './lib/geo.js'
import { charts, draw, renderRest, trendOpt } from './lib/charts.js'
import { signOut } from './lib/api'
import { useCockpit } from './lib/useCockpit'
import { HUBS, TOUR, sessionLabel, type Driver, type Model } from './lib/model'

interface Earth { focus: (city: string) => void }

/* A response older than this counts as stale even if no request has failed yet. */
const STALE_MS = 3 * 60_000

/* Zurich (LBMA vault corridor) is not in the shared city table; add it here
   rather than touch another module for one coordinate. */
Object.assign(geo.CITY, { Zurich: [8.54, 47.37] })

export default function App() {
  const { model, online, lastOk } = useCockpit()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (model) return
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [model])

  if (!model || lastOk === null) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    textAlign: 'center', letterSpacing: '.2em', color: 'var(--muted)' }}>
        <div>
          <div>{slow && !online ? 'CANNOT REACH THE KILLZONE SERVER — RETRYING' : 'CONNECTING TO KILLZONE…'}</div>
        </div>
      </div>
    )
  }
  return <Cockpit model={model} online={online} lastOk={lastOk} />
}

function Cockpit({ model, online, lastOk }: { model: Model; online: boolean; lastOk: number }) {
  const { signal, kpi, drivers, levels, alerts } = model

  const [curDriver, setCurDriver] = useState<string | null>(null)
  const [curLevel, setCurLevel] = useState(-1)
  const [pick, setPick] = useState<{ city: string } | null>(null)
  const [rtHint, setRtHint] = useState('Click to locate')
  const [clock, setClock] = useState({ t: '', d: '', s: '' })
  const [fresh, setFresh] = useState(true)
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
        routes: [],
        markers: HUBS,
        onPick: (m: { city: string }) => setPick({ city: m.city }),
      })).then((g: Earth) => { earth.current = g })
    }, 0)
    return () => clearTimeout(t)
  }, [])

  /* ── proportional scaling: change the scale only, never reflow ────────── */
  useEffect(() => {
    const fit = () => {
      const st = stage.current!
      // Phones, small tablets and portrait windows get a natural scrolling layout
      // (see the "compact" block in app.css); the fixed-canvas scaling below is
      // only for landscape screens wide enough to keep its text readable.
      const compact = innerWidth < 1200 || innerHeight > innerWidth
      document.documentElement.classList.toggle('compact', compact)
      if (compact) {
        st.style.width = ''; st.style.height = ''; st.style.transform = ''
        requestAnimationFrame(() => Object.values(charts).forEach((c) => (c as { resize: () => void }).resize()))
        return
      }
      const k = Math.min(innerWidth / 1920, innerHeight / 1080)
      // At this k one axis lands exactly on the design size and the other has slack;
      // the stage takes that slack as extra design units so it covers the viewport.
      // Clamped, because a phone-shaped window would otherwise stretch a 432px rail
      // into a third of a very tall screen — past the clamp we accept a band and
      // centre, which is the honest failure for a screen designed to hang on a wall.
      const W = Math.min(2560, Math.max(1920, innerWidth / k))
      const H = Math.min(1600, Math.max(1080, innerHeight / k))
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
    return () => { removeEventListener('resize', fit); document.documentElement.classList.remove('compact') }
  }, [])

  /* Redraw whenever the theme flips or fresh data arrives. */
  useEffect(() => { renderRest(model); draw('trend', trendOpt(model)) }, [theme, model])

  /* ── clock + session + freshness ─────────────────────────────────────── */
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setClock({
        t: d.toTimeString().slice(0, 8),
        d: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'long' }),
        s: sessionLabel(d),
      })
      // Stale data is never passed off as live: an old response flips the badge too.
      setFresh(Date.now() - lastOk <= STALE_MS)
    }
    const a = setInterval(tick, 1000); tick()
    return () => clearInterval(a)
  }, [lastOk])

  /* ── auto tour when idle, paused by any interaction ─────────────────── */
  useEffect(() => {
    const id = setInterval(() => {
      idle.current++
      if (paused && idle.current > 30) setPaused(false)
      if (paused || idle.current % 12) return
      setTourIdx(i => {
        const next = (i + 1) % TOUR.length, t = TOUR[next]
        setCurDriver(null); setPick(null)
        earth.current?.focus(t.hub)
        return next
      })
    }, 1000)
    const onAct = () => { idle.current = 0; setPaused(true) }
    const evs = ['click', 'keydown', 'wheel', 'touchstart'] as const
    evs.forEach(ev => addEventListener(ev, onAct))
    return () => { clearInterval(id); evs.forEach(ev => removeEventListener(ev, onAct)) }
  }, [paused])

  /* ── driver selection (turns the earth to where the force trades) ────── */
  const max = Math.max(...drivers.map(r => r.v), 1)
  const sel = (r: Driver) => {
    setCurDriver(r.n); setCurLevel(-1)
    if (r.hub && geo.CITY[r.hub]) { earth.current?.focus(r.hub); setPick({ city: r.hub }) }
    setRtHint(r.hub ? r.n + ' · ' + r.hub : r.n)
  }

  const selLevel = (i: number) => {
    setCurLevel(i); setCurDriver(null)
    const lv = levels[i]
    setRtHint(lv.n + ' $' + lv.p.toFixed(1))
  }

  const live = online && fresh
  const pickedDriver = pick ? drivers.find(d => d.hub === pick.city) : undefined

  return (
    <div id="stage" ref={stage}>
      <div id="space" ref={space} />

      <div className="top" ref={top}>
        <div className="title">KILLZONE<small>GOLD INTELLIGENCE · XAUUSD SIGNAL</small></div>
        <div className="crumb" id="crumb">
          <span className="cur">{clock.s || 'SESSION'}</span>
          <span>›</span>
          <span>{signal.bias} · {signal.score.toFixed(1)}/100</span>
          <span>›</span>
          <span>{signal.tradeZone}</span>
        </div>
        <div className="spacer" />
        <button type="button" className="affil" style={{ cursor: 'pointer', font: 'inherit', fontSize: 13,
                letterSpacing: '.12em', fontWeight: 650 }} onClick={() => void signOut()}>
          SIGN OUT</button>
        <div className={'live' + (live ? '' : ' off')} id="live">
          <span className="blip" />
          <span id="liveTxt">
            {live ? 'LIVE' : 'DISCONNECTED · LAST UPDATE ' + new Date(lastOk).toTimeString().slice(0, 5)}</span>
        </div>
        <div className="clock"><span id="clk">{clock.t}</span><small id="dte">{clock.d}</small></div>
      </div>

      <div className="body">
        {/* left rail */}
        <div className="col">
          <div className="card c-drivers">
            <h2>Signal drivers<span className="r" id="rankHint">Click to locate the market</span></h2>
            <div className="rank" id="rank">
              {drivers.map((r, i) => (
                <div className={'rk ' + (curDriver === r.n ? 'sel' : '')}
                     data-n={r.n} data-hub={r.hub || ''} key={r.n}
                     onClick={() => sel(r)}>
                  <div className={'no ' + (i < 3 ? 't3' : '')}>{i + 1}</div>
                  <div className="nm">{r.n}</div>
                  <div className="track"><div className="fill" style={{
                    width: r.v / max * 100 + '%',
                    background: r.impact === 'bearish' ? 'var(--c5)' : r.impact === 'neutral' ? 'var(--muted)' : undefined }} /></div>
                  <div className="v">{r.v}</div>
                  <div className="p" style={{ color: r.impact === 'bearish' ? 'var(--c5)' : r.impact === 'bullish' ? 'var(--c3)' : 'var(--muted)' }}>
                    {r.impact === 'bearish' ? 'BEAR' : r.impact === 'bullish' ? 'BULL' : 'NEUT'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card c-mix"><h2>Signal composition</h2><div className="chart" id="mix" /></div>
          <div className="card c-turn"><h2>Driver scores<span className="r">0–100</span></h2><div className="chart" id="turn" /></div>
        </div>

        {/* centre: the 3D earth */}
        <div className="mid">
          <div className="kpibar" id="kpibar">
            {kpi.map(k => {
              const hasDelta = k.d !== undefined
              const up = (k.d ?? 0) >= 0
              return (
                <div className="kpi" key={k.l}>
                  <div className="l">{k.l}</div>
                  <div className={'v' + (k.text ? ' txt' : '')} style={k.text ? { fontSize: '1.35em', letterSpacing: '.04em' } : undefined}>
                    {k.v}<u>{k.u}</u></div>
                  <div className={'d ' + (hasDelta ? (up ? 'up' : 'down') : '')}>
                    {hasDelta
                      ? <>{(up ? '▲' : '▼') + ' ' + Math.abs(k.d!) + '%'}<span>{k.span}</span></>
                      : <span style={{ marginLeft: 0 }}>{k.span}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="globe">
            <div id="earth" ref={earthHost} />
            <div className="hud"><i /><i /><i /><i /></div>
            <div className="gtitle"><b>GLOBAL GOLD MARKETS</b><small>BULLION HUBS · DRIVER MARKETS</small></div>
            <div className="readout" id="readout">
              {pick ? <>
                <span>Selected hub</span><b>{pick.city}</b>
                <span className="k">{pickedDriver ? 'Prices ' + pickedDriver.n : 'Bullion hub'}</span>
                {curDriver && <span className="k">{drivers.find(d => d.n === curDriver)?.detail}</span>}
              </> : <>
                <span>Hubs</span><b>{HUBS.length}</b>
                <span className="k">
                  {'TP $' + signal.keyLevels.tp.toFixed(0) + ' · SL $' + signal.keyLevels.sl.toFixed(0)}</span>
              </>}
            </div>
            <div className="ghint">Drag to rotate · click a hub or a driver to locate</div>
          </div>

          <div className="card c-trend">
            <h2>Gold price · 1H with key levels<span className="r" id="trendScope">TP / SL / PIVOTS</span></h2>
            <div className="chart" id="trend" />
          </div>
        </div>

        {/* right rail */}
        <div className="col">
          <div className="card c-levels">
            <h2>Key levels<span className="r" id="rtHint">{rtHint}</span></h2>
            <div className="routes" id="routes">
              {levels.map((l, i) => (
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
          <div className="card c-feed">
            <h2>Live signal feed<span className="r" id="alCount">
              {alerts.filter(a => a[2] === 'a').length + ' critical'}</span></h2>
            <div className="alerts"><div className="lane" id="alerts">
              {alerts.concat(alerts).map(([t, x, lv], i) => (
                <div className={'al ' + (lv === 'a' ? 'hi' : '')} key={i}>
                  <span className="t">{t}</span>
                  <span className="x">{x}</span>
                  <span className={'lv ' + lv}>{lv === 'a' ? 'HIGH' : 'MED'}</span>
                </div>
              ))}
            </div></div>
          </div>
          <div className="card c-hist"><h2>Composite score history</h2><div className="chart" id="cash" /></div>
        </div>
      </div>

      <div className="dots" id="dots">
        <span id="tourTxt">{paused ? 'TOUR PAUSED' : 'AUTO TOUR'}</span>
        {TOUR.map((_, i) => <i className={i === tourIdx ? 'on' : ''} key={i} />)}
      </div>
    </div>
  )
}
