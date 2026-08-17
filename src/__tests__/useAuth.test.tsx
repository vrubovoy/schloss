import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { useAuthProvider } from '../hooks/useAuth'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// vi.mock factories are hoisted above imports, so any variables they close
// over must themselves be created via vi.hoisted().
const { setAccessTokenMock } = vi.hoisted(() => ({
  setAccessTokenMock: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  setAccessToken: setAccessTokenMock,
  getAccessToken: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function notOkResponse(status = 401) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'unauthorized' }),
  } as Response
}

function okJsonResponse(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response
}

// The hook fires fetch('/auth/refresh', ...) (and conditionally
// fetch('/auth/me', ...)) as soon as it mounts. Every test needs those
// calls mocked too, or the on-mount effect hangs/throws on an unmocked
// fetch. By default /auth/refresh resolves non-ok, so the mount effect
// settles quickly to "not logged in" and never reaches /auth/me, keeping
// it out of the way of the logout assertions below. /auth/logout succeeds
// by default; individual tests override `logoutImpl` to exercise failure
// handling.
function makeFetchMock(logoutImpl?: () => Promise<Response>) {
  return vi.fn((url: RequestInfo | URL, _init?: RequestInit) => {
    const u = String(url)
    if (u.includes('/auth/refresh')) return Promise.resolve(notOkResponse())
    if (u.includes('/auth/me')) return Promise.resolve(notOkResponse())
    if (u.includes('/auth/logout')) {
      return logoutImpl ? logoutImpl() : Promise.resolve(okJsonResponse())
    }
    return Promise.resolve(notOkResponse(404))
  })
}

const sampleUser = { id: '1', email: 'anna@example.com', name: 'Anna', role: 'user' as const }

describe('useAuthProvider - logout', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    setAccessTokenMock.mockClear()
  })

  it('fires a POST to /auth/logout with credentials included when logout() is called', async () => {
    const fetchMock = makeFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthProvider())

    // Let the on-mount effect (fetch('/auth/refresh', ...)) settle first.
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockClear()

    await act(async () => {
      await result.current.logout()
    })

    const logoutCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/logout'))
    expect(logoutCall).toBeDefined()
    const [url, init] = logoutCall!
    expect(String(url)).toBe('/auth/logout')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
  })

  it('clears the local user state to null after logout() resolves', async () => {
    const fetchMock = makeFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthProvider())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setUser(sampleUser)
    })
    expect(result.current.user).toEqual(sampleUser)

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
  })

  it('clears the local access token via setAccessToken(null) when logout() is called', async () => {
    const fetchMock = makeFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthProvider())

    await waitFor(() => expect(result.current.loading).toBe(false))
    setAccessTokenMock.mockClear()

    await act(async () => {
      await result.current.logout()
    })

    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
  })

  it('clears the local token and user before the /auth/logout request settles', async () => {
    let resolveLogout!: (response: Response) => void
    const fetchMock = makeFetchMock(() => new Promise<Response>((resolve) => { resolveLogout = resolve }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setUser(sampleUser)
    })
    setAccessTokenMock.mockClear()

    let logoutPromise!: Promise<void>
    act(() => {
      logoutPromise = result.current.logout()
    })

    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
    expect(result.current.user).toBeNull()

    resolveLogout(okJsonResponse())
    await act(async () => {
      await logoutPromise
    })
  })

  it('still resolves and clears local state even when the /auth/logout fetch rejects with a network error', async () => {
    const fetchMock = makeFetchMock(() => Promise.reject(new Error('network down')))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthProvider())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setUser(sampleUser)
    })

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.logout()
      } catch (err) {
        thrown = err
      }
    })

    expect(thrown).toBeUndefined()
    expect(result.current.user).toBeNull()
  })

  it('still resolves and clears local state even when /auth/logout responds with a non-ok status', async () => {
    const fetchMock = makeFetchMock(() => Promise.resolve(notOkResponse(500)))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthProvider())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setUser(sampleUser)
    })

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.logout()
      } catch (err) {
        thrown = err
      }
    })

    expect(thrown).toBeUndefined()
    expect(result.current.user).toBeNull()
  })
})
