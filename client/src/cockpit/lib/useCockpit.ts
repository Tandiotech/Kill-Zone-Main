import { useEffect, useMemo, useState } from 'react'
import { REACTIVE_REFRESH_MS } from '@/lib/refresh'
import { getJSON } from './api'
import { buildModel, type ChartPayload, type HourlyPayload, type Model, type SignalPayload } from './model'

/* The signal endpoint serves the server's cache, so polling it every minute is
   cheap; the score history and hourly series change slowly and follow the
   server's own 5-minute refresh cadence. */
const SIGNAL_POLL_MS = 60_000

export interface Cockpit {
  model: Model | null
  /** the most recent signal request succeeded */
  online: boolean
  /** epoch ms of the last successful signal response (null until the first) */
  lastOk: number | null
}

export function useCockpit(): Cockpit {
  const [signal, setSignal] = useState<SignalPayload | null>(null)
  const [chart, setChart] = useState<ChartPayload | null>(null)
  const [hourly, setHourly] = useState<HourlyPayload | null>(null)
  const [online, setOnline] = useState(false)
  const [lastOk, setLastOk] = useState<number | null>(null)

  useEffect(() => {
    let stopped = false

    const pullSignal = async () => {
      try {
        const s = await getJSON<SignalPayload>('/api/signal')
        if (stopped) return
        setSignal(s); setLastOk(Date.now()); setOnline(true)
      } catch {
        if (!stopped) setOnline(false)
      }
    }
    /* On failure these keep the previous series rather than blanking the chart. */
    const pullSlow = async () => {
      getJSON<ChartPayload>('/api/chart-data').then(d => { if (!stopped) setChart(d) }).catch(() => {})
      getJSON<HourlyPayload>('/api/price-hourly').then(d => { if (!stopped) setHourly(d) }).catch(() => {})
    }

    pullSignal(); pullSlow()
    const a = setInterval(pullSignal, SIGNAL_POLL_MS)
    const b = setInterval(pullSlow, REACTIVE_REFRESH_MS)
    return () => { stopped = true; clearInterval(a); clearInterval(b) }
  }, [])

  const model = useMemo(() => (signal ? buildModel(signal, chart, hourly) : null), [signal, chart, hourly])
  return { model, online, lastOk }
}
