import { renderHook, cleanup, act } from '@testing-library/react'
import { useServerStats, useMetricHistory, useContainerHistory } from '../hooks/useServerStats'

const { getAccessTokenMock } = vi.hoisted(() => ({ getAccessTokenMock: vi.fn() }))
vi.mock('../lib/api', () => ({ getAccessToken: getAccessTokenMock, setAccessToken: vi.fn() }))

const sampleStats = {
  cpuPercent: 12.5,
  memPercent: 40,
  diskPercent: 55,
  uptimeSeconds: 3661,
  cpuHistory: [10, 12, 12.5],
  memHistory: [38, 39, 40],
  containers: [],
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response
}

function notOkResponse(status = 500) {
  return { ok: false, status, json: () => Promise.resolve({}) } as Response
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

// vi.advanceTimersByTimeAsync fires the interval/promise callbacks that
// call React's state setters, but doesn't itself wrap that in act() - do
// it here once so every test gets a warning-free flush.
async function flush(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('useServerStats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getAccessTokenMock.mockReset().mockReturnValue('access-token-123')
    setVisibility('visible')
    setOnline(true)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not fetch while disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useServerStats(false))
    await flush(0)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches /wachter/stats with a bearer token on mount when enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleStats))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useServerStats(true))
    await flush(0)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/wachter/stats')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token-123')
  })

  it('exposes the parsed stats after a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(sampleStats)))

    const { result } = renderHook(() => useServerStats(true))
    await flush(0)

    expect(result.current.stats).toEqual(sampleStats)
    expect(result.current.error).toBe(false)
  })

  it('does not fetch when there is no access token yet', async () => {
    getAccessTokenMock.mockReturnValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useServerStats(true))
    await flush(0)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sets error and leaves stats null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(notOkResponse(500)))

    const { result } = renderHook(() => useServerStats(true))
    await flush(0)

    expect(result.current.error).toBe(true)
    expect(result.current.stats).toBeNull()
  })

  it('sets error when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const { result } = renderHook(() => useServerStats(true))
    await flush(0)

    expect(result.current.error).toBe(true)
    expect(result.current.stats).toBeNull()
  })

  it('keeps the last known stats when a later poll fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(sampleStats))
      .mockResolvedValueOnce(notOkResponse(500))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useServerStats(true))
    await flush(0)
    expect(result.current.stats).toEqual(sampleStats)

    await flush(60_000)
    expect(result.current.error).toBe(true)
    expect(result.current.stats).toEqual(sampleStats)
  })

  it('polls again after the interval elapses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleStats))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useServerStats(true))
    await flush(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await flush(4_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await flush(1_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('skips a poll while the tab is not visible', async () => {
    setVisibility('hidden')
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleStats))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useServerStats(true))
    await flush(0)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips a poll while offline', async () => {
    setOnline(false)
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleStats))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useServerStats(true))
    await flush(0)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops polling after unmount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleStats))
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = renderHook(() => useServerStats(true))
    await flush(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    unmount()
    await flush(120_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not update state after unmount when an in-flight request resolves later', async () => {
    let resolveFetch!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve }))
    vi.stubGlobal('fetch', fetchMock)

    const { result, unmount } = renderHook(() => useServerStats(true))
    await flush(0)
    unmount()

    resolveFetch(okResponse(sampleStats))
    await flush(0)

    expect(result.current.stats).toBeNull()
  })
})

// The shared usePolledResource polling/visibility/online-gating behavior is
// already fully exercised above via useServerStats - these two hooks just
// need their own URL construction and response-shape handling verified.
describe('useMetricHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getAccessTokenMock.mockReset().mockReturnValue('access-token-123')
    setVisibility('visible')
    setOnline(true)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const sampleCpuHistory = { metric: 'cpu' as const, range: 'hour' as const, values: [10, 12, 15], sampleIntervalMs: 5000 }

  it('fetches /wachter/history/<metric> with a bearer token and the range query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleCpuHistory))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useMetricHistory('cpu', 'hour', true))
    await flush(0)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/wachter/history/cpu?range=hour')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token-123')
  })

  it('fetches a different metric under its own URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ metric: 'disk', range: 'hour', values: [1], sampleIntervalMs: 5000 }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useMetricHistory('disk', 'hour', true))
    await flush(0)

    expect(String(fetchMock.mock.calls[0][0])).toBe('/wachter/history/disk?range=hour')
  })

  it('fetches under a different range query param for a different range', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ...sampleCpuHistory, range: 'week' }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useMetricHistory('cpu', 'week', true))
    await flush(0)

    expect(String(fetchMock.mock.calls[0][0])).toBe('/wachter/history/cpu?range=week')
  })

  it('exposes the parsed history after a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(sampleCpuHistory)))

    const { result } = renderHook(() => useMetricHistory('cpu', 'hour', true))
    await flush(0)

    expect(result.current.history).toEqual(sampleCpuHistory)
    expect(result.current.error).toBe(false)
  })

  it('does not fetch while disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useMetricHistory('cpu', 'hour', false))
    await flush(0)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('re-fetches under the new URL when range changes on a re-render', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleCpuHistory))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(({ range }: { range: 'hour' | 'day' | 'week' }) => useMetricHistory('cpu', range, true), {
      initialProps: { range: 'hour' },
    })
    await flush(0)
    expect(String(fetchMock.mock.calls[0][0])).toBe('/wachter/history/cpu?range=hour')

    rerender({ range: 'day' })
    await flush(0)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toBe('/wachter/history/cpu?range=day')
  })
})

describe('useContainerHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getAccessTokenMock.mockReset().mockReturnValue('access-token-123')
    setVisibility('visible')
    setOnline(true)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const sampleContainerHistory = {
    name: 'kuvert-backend',
    range: 'hour' as const,
    cpuHistory: [1, 2, 3],
    memHistory: [4, 5, 6],
    sampleIntervalMs: 5000,
  }

  it('fetches /wachter/containers/<name>/history with a bearer token and the range query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleContainerHistory))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useContainerHistory('kuvert-backend', 'hour', true))
    await flush(0)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/wachter/containers/kuvert-backend/history?range=hour')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token-123')
  })

  it('URL-encodes a container name containing special characters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleContainerHistory))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useContainerHistory('my container/1', 'hour', true))
    await flush(0)

    const [url] = fetchMock.mock.calls[0] as [RequestInfo | URL]
    expect(String(url)).toBe('/wachter/containers/my%20container%2F1/history?range=hour')
  })

  it('fetches under a different range query param for a different range', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ...sampleContainerHistory, range: 'week' }))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useContainerHistory('kuvert-backend', 'week', true))
    await flush(0)

    expect(String(fetchMock.mock.calls[0][0])).toBe('/wachter/containers/kuvert-backend/history?range=week')
  })

  it('exposes the parsed history after a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(sampleContainerHistory)))

    const { result } = renderHook(() => useContainerHistory('kuvert-backend', 'hour', true))
    await flush(0)

    expect(result.current.history).toEqual(sampleContainerHistory)
    expect(result.current.error).toBe(false)
    expect(result.current.notFound).toBe(false)
  })

  it('sets notFound (not error) and leaves history null on a 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response))

    const { result } = renderHook(() => useContainerHistory('missing-container', 'hour', true))
    await flush(0)

    expect(result.current.notFound).toBe(true)
    expect(result.current.error).toBe(false)
    expect(result.current.history).toBeNull()
  })

  it('does not fetch while disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useContainerHistory('kuvert-backend', 'hour', false))
    await flush(0)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('re-fetches under the new URL when range changes on a re-render', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sampleContainerHistory))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(({ range }: { range: 'hour' | 'day' | 'week' }) => useContainerHistory('kuvert-backend', range, true), {
      initialProps: { range: 'hour' },
    })
    await flush(0)
    expect(String(fetchMock.mock.calls[0][0])).toBe('/wachter/containers/kuvert-backend/history?range=hour')

    rerender({ range: 'day' })
    await flush(0)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toBe('/wachter/containers/kuvert-backend/history?range=day')
  })
})
