import { useEffect, useState } from 'react'
import { getAccessToken } from '../lib/api'

export interface ContainerStatus {
  name: string
  state: string
  status: string
  health: 'healthy' | 'unhealthy' | 'starting' | null
}

export interface ServerStats {
  cpuPercent: number
  memPercent: number
  diskPercent: number
  uptimeSeconds: number
  cpuHistory: number[]
  memHistory: number[]
  containers: ContainerStatus[]
}

const POLL_INTERVAL_MS = 60_000

// Same-origin only (Wächter has no origin of its own to validate - see
// Caddyfile's /wachter/* proxy to the wachter container), so this skips
// the cross-origin SSRF-safety machinery schloss-ui's own
// useUnreadNotifications needs for a real external Glocke URL. Polls
// only while the tab is actually visible/online, same reasoning as
// that hook.
export function useServerStats(enabled: boolean): { stats: ServerStats | null; error: boolean } {
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function poll() {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      const token = getAccessToken()
      if (!token) return
      try {
        const res = await fetch('/wachter/stats', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as ServerStats
        if (!cancelled) {
          setStats(data)
          setError(false)
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
  }, [enabled])

  return { stats, error }
}
