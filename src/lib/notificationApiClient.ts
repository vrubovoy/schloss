import type { ApiClient } from '@zudar107/schloss-ui'
import { getAccessToken, setAccessToken } from './api'

let refreshFlight: Promise<string | null> | null = null

function refreshAccessToken(): Promise<string | null> {
  if (refreshFlight) return refreshFlight

  const tokenBeforeRefresh = getAccessToken()
  if (!tokenBeforeRefresh) return Promise.resolve(null)

  const request = (async () => {
    try {
      const response = await fetch('/auth/refresh', { method: 'POST', credentials: 'include' })
      if (!response.ok) return null

      const payload = (await response.json()) as { accessToken?: unknown }
      if (typeof payload.accessToken !== 'string' || !payload.accessToken) return null

      // Logout or a newer login may have replaced the session while refresh ran.
      if (getAccessToken() !== tokenBeforeRefresh) return null
      setAccessToken(payload.accessToken)
      return payload.accessToken
    } catch {
      return null
    }
  })()

  refreshFlight = request
  void request.finally(() => {
    if (refreshFlight === request) refreshFlight = null
  })
  return request
}

function unsupportedRequest<T>(): Promise<T> {
  return Promise.reject(new Error('Schloss has no application API client'))
}

/** Adapts Schloss's legacy in-memory token helpers for shared auth-aware hooks. */
export const notificationApiClient: ApiClient = {
  getAccessToken,
  setAccessToken,
  refreshAccessToken,
  get: unsupportedRequest,
  post: unsupportedRequest,
  put: unsupportedRequest,
  delete: unsupportedRequest,
}
