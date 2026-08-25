import { render, screen, cleanup, waitFor } from '@testing-library/react'
import WachterDocsPage from './WachterDocsPage'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { useAuthMock, navigateMock, getAccessTokenMock, swaggerUIBundleMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  navigateMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  // The real swagger-ui-dist package exports a callable `SwaggerUIBundle`
  // with a `.presets` property (checked directly in node_modules, not
  // guessed) - real code calls `SwaggerUIBundle.presets.apis`, so the stub
  // needs the same shape or it would throw when the component reaches
  // that point.
  swaggerUIBundleMock: Object.assign(vi.fn(), { presets: { apis: {} } }),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: useAuthMock,
}))

vi.mock('../lib/api', () => ({
  getAccessToken: getAccessTokenMock,
  setAccessToken: vi.fn(),
}))

// The page dynamically import()s 'swagger-ui-dist' and mounts it into a
// real DOM node - mocked here rather than letting the real widget mount in
// jsdom, same boundary kuvert/frontend's own DocsPage.test.tsx draws for
// the same package. vi.mock intercepts both static and dynamic imports of
// the same specifier.
vi.mock('swagger-ui-dist', () => ({
  SwaggerUIBundle: swaggerUIBundleMock,
}))

// The page's real <Link>/useNavigate require a mounted RouterProvider -
// render() here mounts the page standalone, same convention as
// ServerStatsPage.test.tsx.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
    Link: ({ to, children, ...rest }: {
      to: string
      children?: React.ReactNode
      [key: string]: unknown
    }) => <a href={to} {...rest}>{children}</a>,
  }
})

const sampleUser = { id: '1', email: 'anna@example.com', name: 'Анна', role: 'user' as const }
const sampleAdmin = { id: '2', email: 'otto@example.com', name: 'Отто', role: 'admin' as const }

const minimalSpec = { openapi: '3.0.0', info: { title: 'Wächter', version: '1.0.0' }, paths: {} }

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response
}

function notOkResponse(status = 500) {
  return { ok: false, status, json: () => Promise.resolve({}) } as Response
}

// Header also renders useAvatarUrl/useUnreadNotifications (unmocked, same
// convention as ServerStatsPage.test.tsx), which hit their own URLs on the
// same global fetch mock - this picks out just the openapi.json call among
// whatever else fired.
function openApiCall(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.find((call: unknown[]) => String(call[0]) === '/wachter/openapi.json')
}

describe('WachterDocsPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    navigateMock.mockClear()
    getAccessTokenMock.mockReset().mockReturnValue('access-token-123')
    swaggerUIBundleMock.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('redirects a non-admin user to the home page', async () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn())

    render(<WachterDocsPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true })
    })
    expect(screen.queryByText('API Wächter')).not.toBeInTheDocument()
  })

  it('redirects a logged-out user to the home page', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn())

    render(<WachterDocsPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true })
    })
  })

  it('renders nothing and does not redirect while auth is still loading', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn())

    const { container } = render(<WachterDocsPage />)

    expect(container.textContent).toBe('')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not fetch the spec for a non-admin user', async () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn() })
    const fetchMock = vi.fn().mockResolvedValue(okResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    render(<WachterDocsPage />)

    // Give the unmocked Header hooks (useAvatarUrl/useUnreadNotifications,
    // which fetch unconditionally) a tick to fire before asserting the
    // openapi.json call specifically never happens.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(openApiCall(fetchMock)).toBeUndefined()
  })

  it('fetches /wachter/openapi.json with a bearer token for an admin', async () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    const fetchMock = vi.fn().mockResolvedValue(okResponse(minimalSpec))
    vi.stubGlobal('fetch', fetchMock)

    render(<WachterDocsPage />)

    await waitFor(() => expect(openApiCall(fetchMock)).toBeDefined())
    const [url, init] = openApiCall(fetchMock) as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/wachter/openapi.json')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token-123')
  })

  it('mounts SwaggerUIBundle once the spec resolves', async () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(minimalSpec)))

    render(<WachterDocsPage />)

    await waitFor(() => expect(swaggerUIBundleMock).toHaveBeenCalled())
    const options = swaggerUIBundleMock.mock.calls[0][0] as { spec: unknown }
    expect(options.spec).toEqual(minimalSpec)
  })

  it('shows a Russian error message, without crashing, when the spec fetch fails', async () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(notOkResponse(500)))

    expect(() => render(<WachterDocsPage />)).not.toThrow()

    await waitFor(() => {
      expect(screen.getByText('Не удалось загрузить документацию API')).toBeInTheDocument()
    })
    expect(swaggerUIBundleMock).not.toHaveBeenCalled()
  })

  it('shows the error message, without crashing, when the fetch itself rejects', async () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    render(<WachterDocsPage />)

    await waitFor(() => {
      expect(screen.getByText('Не удалось загрузить документацию API')).toBeInTheDocument()
    })
  })

  it('passes a requestInterceptor to SwaggerUIBundle that injects the current bearer token into outgoing requests', async () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(minimalSpec)))

    render(<WachterDocsPage />)

    await waitFor(() => expect(swaggerUIBundleMock).toHaveBeenCalled())
    const options = swaggerUIBundleMock.mock.calls[0][0] as {
      requestInterceptor: (req: { headers: Record<string, string> }) => { headers: Record<string, string> }
    }

    getAccessTokenMock.mockReturnValue('fresh-token-456')
    const outgoingReq = { headers: {} }
    const result = options.requestInterceptor(outgoingReq)

    expect(result.headers['Authorization']).toBe('Bearer fresh-token-456')
  })

  it('has a link back to the server-stats overview page', async () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(minimalSpec)))

    render(<WachterDocsPage />)

    const backLink = screen.getByText('← К обзору сервера')
    expect(backLink.closest('a')).toHaveAttribute('href', '/server-stats')
  })
})
