import { renderHook, cleanup, act } from '@testing-library/react'
import { useServerStats } from '../hooks/useServerStats'

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

    await flush(59_000)
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
