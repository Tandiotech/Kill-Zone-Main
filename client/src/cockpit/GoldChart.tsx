import { useEffect, useRef } from 'react'
import { KILLZONES, killzoneAt, utcHour } from './lib/model'

function pad(n: number): string {
  return String(Math.floor(n)).padStart(2, '0')
}

function utcRange(from: number, to: number): string {
  return `${pad(from)}–${pad(to)} UTC`
}

function minsLabel(mins: number): string {
  if (mins < 60) return mins + 'm'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? h + 'h ' + m + 'm' : h + 'h'
}

export function SessionRibbon({ now }: { now: Date }) {
  const h = utcHour(now)
  const kz = killzoneAt(now)
  return (
    <div className="kz-ribbon" aria-label="Gold killzone windows, Coordinated Universal Time">
      <div className="kz-track">
        {KILLZONES.map(k => (
          <i
            key={k.name}
            className={'kz-win ' + k.tone + (kz.live?.name === k.name ? ' live' : '')}
            style={{ left: (k.from / 24) * 100 + '%', width: ((k.to - k.from) / 24) * 100 + '%' }}
          />
        ))}
        <i className="kz-now" style={{ left: (h / 24) * 100 + '%' }} title="Now (UTC)" />
      </div>
      <div className="kz-labels">
        {KILLZONES.map(k => {
          const live = kz.live?.name === k.name
          return (
            <span key={k.name} className={live ? 'on' : ''}>
              {k.name} {utcRange(k.from, k.to)}
              {live ? ' · live' : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Live XAUUSD candles from TradingView, locked to gold. Theme follows the cockpit. */
export function GoldTvChart({ theme }: { theme: 'dark' | 'light' }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'tradingview-widget-container'
    wrap.style.height = '100%'
    wrap.style.width = '100%'
    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.height = '100%'
    widget.style.width = '100%'
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval: '60',
      timezone: 'Europe/London',
      theme,
      style: '1',
      locale: 'en',
      backgroundColor: theme === 'light' ? 'rgba(255,255,255,1)' : 'rgba(14,12,8,1)',
      gridColor: theme === 'light' ? 'rgba(227,220,203,0.55)' : 'rgba(36,31,22,0.55)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      withdateranges: true,
      support_host: 'https://www.tradingview.com',
      studies: ['STD;RSI'],
    })
    wrap.appendChild(widget)
    wrap.appendChild(script)
    el.appendChild(wrap)
    return () => { el.innerHTML = '' }
  }, [theme])

  return <div ref={host} className="tv-host" role="img" aria-label="Live XAUUSD gold chart" />
}

export function KillzoneReadout({
  now,
  selected,
}: {
  now: Date
  selected: { n: string; p: number; dist: number; kind: string } | null
}) {
  const kz = killzoneAt(now)
  if (selected) {
    const sign = selected.dist >= 0 ? '+' : ''
    const kind = selected.kind === 'spot' ? 'SPOT' : selected.kind.toUpperCase()
    return (
      <>
        <span>Selected level</span>
        <b>{selected.n}</b>
        <span className="k">{kind} ${selected.p.toFixed(1)} · {sign}{selected.dist}%</span>
      </>
    )
  }
  if (kz.live) {
    return (
      <>
        <span>Live killzone</span>
        <b>{kz.live.name}</b>
        <span className="k">{minsLabel(kz.mins)} remaining · {utcRange(kz.live.from, kz.live.to)}</span>
      </>
    )
  }
  return (
    <>
      <span>Next killzone</span>
      <b>{kz.next.name}</b>
      <span className="k">opens in {minsLabel(kz.mins)} · {utcRange(kz.next.from, kz.next.to)}</span>
    </>
  )
}

