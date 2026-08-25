import { useEffect, useState } from 'react'
import { getAccessToken } from '../lib/api'

export interface ContainerStatus {
  id: string | null
  name: string
  state: string
  status: string
  health: 'healthy' | 'unhealthy' | 'starting' | null
  cpuPercent: number
  memPercent: number
  restartable: boolean
  critical: boolean
}

export interface HistoryPoint {
  timestamp: string
  value: number
}

export interface ServerStats {
  status: 'ok' | 'degraded' | 'error'
  sampledAt: string | null
  stale: boolean
  sources: {
    host: { status: 'ok' | 'error'; sampledAt: string | null; error: string | null }
    docker: { status: 'ok' | 'error'; sampledAt: string | null; error: string | null }
  }
  cpuPercent: number
  memPercent: number
  diskPercent: number
  uptimeSeconds: number
  cpuHistory: HistoryPoint[]
  memHistory: HistoryPoint[]
  diskHistory: HistoryPoint[]
  containers: ContainerStatus[]
}

export type MetricName = 'cpu' | 'memory' | 'disk'
export type HistoryRange = 'hour' | 'day' | 'week'

export interface MetricHistory {
  metric: MetricName
  range: HistoryRange
  values: HistoryPoint[]
  sampleIntervalMs: number
}

export interface ContainerHistory {
  name: string
  range: HistoryRange
  cpuHistory: HistoryPoint[]
  memHistory: HistoryPoint[]
  sampleIntervalMs: number
}

// Matches the backend sampler's own default tick (see wachter's
// WACHTER_SAMPLE_INTERVAL_MS) - polling faster than the data actually
// changes would just be wasted requests, and polling slower would make
// the "live" numbers lag behind what the sampler already has cached.
const POLL_INTERVAL_MS = 5_000

// Same-origin only (Wächter has no origin of its own to validate - see
// Caddyfile's /wachter/* proxy to the wachter container), so this skips
// the cross-origin SSRF-safety machinery schloss-ui's own
// useUnreadNotifications needs for a real external Glocke URL. Polls
// only while the tab is actually visible/online, same reasoning as
// that hook. Shared by every Wächter data hook below - each just picks
// a URL and a response shape.
function usePolledResource<T>(url: string | null, enabled: boolean): { data: T | null; error: boolean; notFound: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!enabled || !url) return
    let cancelled = false

    async function poll() {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      const token = getAccessToken()
      if (!token) return
      try {
        const res = await fetch(url as string, { headers: { Authorization: `Bearer ${token}` } })
        if (res.status === 404) {
          if (!cancelled) { setNotFound(true); setError(false) }
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as T
        if (!cancelled) {
          setData(json)
          setError(false)
          setNotFound(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    void poll()
    const timer = setInterval(() => { void poll() }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [url, enabled])

  return { data, error, notFound }
}

export function useServerStats(enabled: boolean): { stats: ServerStats | null; error: boolean } {
  const { data, error } = usePolledResource<ServerStats>('/wachter/stats', enabled)
  return { stats: data, error }
}

// Backs the detailed stats page's per-metric graph - the full retained
// history (hour/day/week tiers - see wachter's lib/tieredHistory.ts),
// not the short tail /wachter/stats carries for the home-page widget's
// compact sparkline. Re-fetches whenever `range` changes since that's
// baked into the URL.
export function useMetricHistory(metric: MetricName, range: HistoryRange, enabled: boolean): { history: MetricHistory | null; error: boolean } {
  const { data, error } = usePolledResource<MetricHistory>(`/wachter/history/${metric}?range=${range}`, enabled)
  return { history: data, error }
}

// 404s (surfaced as notFound) until the sampler has taken at least one
// reading of a running container by that name.
export function useContainerHistory(name: string, range: HistoryRange, enabled: boolean): { history: ContainerHistory | null; error: boolean; notFound: boolean } {
  const { data, error, notFound } = usePolledResource<ContainerHistory>(
    enabled ? `/wachter/containers/${encodeURIComponent(name)}/history?range=${range}` : null,
    enabled,
  )
  return { history: data, error, notFound }
}

export type RestartResult = { ok: true } | { ok: false; error: string }

// One-shot POST, not polled - triggered by an explicit button click on
// the container detail page, not a background hook.
export async function restartContainer(name: string): Promise<RestartResult> {
  const token = getAccessToken()
  if (!token) return { ok: false, error: 'Не удалось авторизоваться' }
  try {
    const res = await fetch(`/wachter/containers/${encodeURIComponent(name)}/restart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Сеть недоступна' }
  }
}
