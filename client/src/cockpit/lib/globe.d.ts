export interface GlobeMarker {
  city: string
  level?: string
  v?: number
}

export interface GlobeRoute {
  from: string
  to: string
  level?: string
}

export interface GlobeOptions {
  routes?: GlobeRoute[]
  markers?: GlobeMarker[]
  step?: number
  spin?: number
  tilt?: number
  dayLength?: number
  interactive?: boolean
  onPick?: ((marker: GlobeMarker) => void) | null
}

export interface Globe {
  focus: (city: string) => void
  start: () => void
  stop: () => void
}

export function globe(host: HTMLElement | null, options?: GlobeOptions): Promise<Globe>
export default globe
