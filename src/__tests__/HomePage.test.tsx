import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from '../pages/HomePage'
import { buildSchluesselLoginUrl } from '../lib/authRedirect'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { useAuthMock, getAccessTokenMock, setAccessTokenMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  setAccessTokenMock: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: useAuthMock,
}))

vi.mock('../lib/api', () => ({
  getAccessToken: getAccessTokenMock,
  setAccessToken: setAccessTokenMock,
}))

const sampleUser = { id: '1', email: 'anna@example.com', name: 'Анна', role: 'user' as const }

let originalLocation: Location

describe('HomePage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    getAccessTokenMock.mockReset().mockReturnValue('access-token-123')
    setAccessTokenMock.mockReset()
    originalLocation = window.location
    // @ts-expect-error -- intentionally deleting to stub location for the test
    delete window.location
    // @ts-expect-error -- plain writable stand-in object
    window.location = { ...originalLocation, href: originalLocation.href }
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    // @ts-expect-error -- restore the real Location object
    window.location = originalLocation
  })

  async function renderConfiguredHome() {
    vi.stubEnv('VITE_GLOCKE_URL', 'https://glocke.example.test')
    vi.resetModules()
    const { default: ConfiguredHomePage } = await import('../pages/HomePage')
    return render(<ConfiguredHomePage />)
  }

  function unreadResponse(count: number) {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ count }),
      text: () => Promise.resolve(JSON.stringify({ count })),
    } as Response
  }

  function unauthorizedResponse() {
    return {
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'unauthorized' }),
      text: () => Promise.resolve('unauthorized'),
    } as Response
  }

  describe('shared Glocke notification bell', () => {
    it('shows the authenticated bell at the configured Glocke notifications page and sends the bearer only in the unread request header', async () => {
      useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
      const fetchMock = vi.fn().mockResolvedValue(unreadResponse(0))
      vi.stubGlobal('fetch', fetchMock)

      await renderConfiguredHome()

      const bell = await within(screen.getByRole('banner')).findByRole('link', { name: /уведомлен/i })
      expect(bell).toHaveAttribute('href', 'https://glocke.example.test/notifications')
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      const [requestUrl, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
      expect(String(requestUrl)).toBe('https://glocke.example.test/backend/notifications/unread-count')
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token-123')
      expect(String(requestUrl)).not.toContain('access-token-123')
      expect(bell.getAttribute('href')).not.toContain('access-token-123')
    })

    it.each([
      { user: null, loading: true, label: 'while authentication is loading' },
      { user: null, loading: false, label: 'after authentication resolves without a user' },
    ])('does not render or request the bell $label', async ({ user, loading }) => {
      useAuthMock.mockReturnValue({ user, loading, logout: vi.fn(), setUser: vi.fn() })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await renderConfiguredHome()

      expect(screen.queryByRole('link', { name: /уведомлен/i })).not.toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('starts without a badge, then shows a positive unread count', async () => {
      useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
      let resolveUnread!: (response: Response) => void
      vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveUnread = resolve })))

      await renderConfiguredHome()

      const header = within(screen.getByRole('banner'))
      const fetchMock = vi.mocked(fetch)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const bell = header.getByRole('link', { name: /уведомлен/i })
      expect(within(bell).queryByText('7')).not.toBeInTheDocument()

      resolveUnread(unreadResponse(7))
      expect(await within(bell).findByText('7')).toBeInTheDocument()
    })

    it('keeps the bell available without a stale badge when the unread request fails', async () => {
      useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Glocke unavailable')))

      await renderConfiguredHome()

      const bell = await within(screen.getByRole('banner')).findByRole('link', { name: /уведомлен/i })
      await waitFor(() => expect(fetch).toHaveBeenCalled())
      expect(bell).toHaveAttribute('href', 'https://glocke.example.test/notifications')
      expect(within(bell).queryByText(/\d+/)).not.toBeInTheDocument()
    })

    it('omits the bell and disables the Glocke launcher card when the configured origin is invalid', async () => {
      useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      vi.stubEnv('VITE_GLOCKE_URL', 'javascript:alert(1)')
      vi.resetModules()
      const { default: InvalidOriginHomePage } = await import('../pages/HomePage')

      render(<InvalidOriginHomePage />)

      expect(within(screen.getByRole('banner')).queryByRole('link', { name: /уведомлен/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Glocke/ })).not.toBeInTheDocument()
      const glockeCard = screen.getByText('Glocke').closest('a')
      expect(glockeCard).not.toBeNull()
      expect(glockeCard!).not.toHaveAttribute('href')
      expect(document.documentElement.innerHTML).not.toContain('javascript:')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('uses the shared canonical Glocke origin for both header and launcher hrefs', async () => {
      useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unreadResponse(0)))
      vi.stubEnv('VITE_GLOCKE_URL', 'https://GLOCKE.example.test:443/')
      vi.resetModules()
      const { default: CanonicalOriginHomePage } = await import('../pages/HomePage')

      render(<CanonicalOriginHomePage />)

      expect(await within(screen.getByRole('banner')).findByRole('link', { name: /уведомлен/i }))
        .toHaveAttribute('href', 'https://glocke.example.test/notifications')
      expect(screen.getByRole('link', { name: /Glocke/ }))
        .toHaveAttribute('href', 'https://glocke.example.test')
    })

    it('aborts the unread request and disables the bell when logout removes authentication', async () => {
      const logoutMock = vi.fn(() => new Promise<void>(() => {}))
      useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: logoutMock, setUser: vi.fn() })
      let unreadSignal: AbortSignal | undefined
      vi.stubGlobal('fetch', vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        unreadSignal = init?.signal ?? undefined
        return new Promise<Response>(() => {})
      }))

      const view = await renderConfiguredHome()
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      const user = userEvent.setup()
      await user.click(within(screen.getByRole('banner')).getByRole('button', { name: /Выйти/ }))

      useAuthMock.mockReturnValue({ user: null, loading: false, logout: logoutMock, setUser: vi.fn() })
      const { default: ConfiguredHomePage } = await import('../pages/HomePage')
      view.rerender(<ConfiguredHomePage />)

      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(unreadSignal?.aborted).toBe(true)
      expect(screen.queryByRole('link', { name: /уведомлен/i })).not.toBeInTheDocument()
    })

    it('silently refreshes and retries one 401 with the new bearer token without redirecting', async () => {
      useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
      setAccessTokenMock.mockImplementation((token: string | null) => {
        getAccessTokenMock.mockReturnValue(token)
      })
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(unauthorizedResponse())
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ accessToken: 'refreshed-token-456' }),
        } as Response)
        .mockResolvedValueOnce(unreadResponse(4))
      vi.stubGlobal('fetch', fetchMock)
      const originalHref = window.location.href

      await renderConfiguredHome()

      const bell = await within(screen.getByRole('banner')).findByRole('link', { name: /уведомлен/i })
      expect(await within(bell).findByText('4')).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(String(fetchMock.mock.calls[0][0])).toBe('https://glocke.example.test/backend/notifications/unread-count')
      expect(String(fetchMock.mock.calls[1][0])).toBe('/auth/refresh')
      expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'include' })
      expect(String(fetchMock.mock.calls[2][0])).toBe('https://glocke.example.test/backend/notifications/unread-count')
      expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer refreshed-token-456')
      expect(window.location.href).toBe(originalHref)
    })
  })

  // -------------------------------------------------------------------------
  // Helper to assert nothing renders
  // -------------------------------------------------------------------------
  function expectNoPageContent() {
    expect(screen.queryByRole('button', { name: /Войти/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Выйти/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Добрый день/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Kuvert/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Скоро появятся новые сервисы')).not.toBeInTheDocument()
    // Additive hero/highlights/footer content must also be absent in these states
    expect(document.body.querySelector('img')).toBeNull()
    expect(screen.queryByText('Свой хостинг')).not.toBeInTheDocument()
    expect(screen.queryByText('Открытый код')).not.toBeInTheDocument()
    expect(screen.queryByText('Твои данные — твои')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /github/i })).not.toBeInTheDocument()
  }

  // -------------------------------------------------------------------------
  // Loading state: nothing should render, regardless of user
  // -------------------------------------------------------------------------
  it('renders no page content while loading is true (user null)', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)
    expectNoPageContent()
  })

  it('renders no page content while loading is true (user set)', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: true, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)
    expectNoPageContent()
  })

  // -------------------------------------------------------------------------
  // Logged out, not loading: nothing renders, and it redirects to login
  // -------------------------------------------------------------------------
  it('renders no page content when not loading and user is null', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)
    expectNoPageContent()
  })

  it('redirects to a Schlüssel login URL (with PKCE params) automatically when not loading and user is null', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, logout: vi.fn(), setUser: vi.fn() })

    render(<HomePage />)

    await waitFor(() => {
      expect(window.location.href).toContain('/login?')
    })

    // buildSchluesselLoginUrl now generates a fresh random PKCE code_challenge
    // on every call, so we can no longer assert exact equality against a
    // separately-computed "expected" URL (two calls never produce the same
    // challenge). Instead assert on the URL's shape/contents.
    const url = new URL(window.location.href)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()

    // URLSearchParams.get() already decodes once, so return_to here is the
    // plain (not double-encoded) return_to URL string.
    const returnTo = url.searchParams.get('return_to') ?? ''
    expect(returnTo).toContain('/auth/callback?next=%2F')
  })

  // -------------------------------------------------------------------------
  // Logged in, not loading: full page renders, no redirect happens
  // -------------------------------------------------------------------------
  it('greets with "Добрый день, {name}" when not loading and user is set', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    const { container } = render(<HomePage />)
    expect(container.textContent).toContain('Добрый день, Анна')
  })

  it('shows the user\'s name and a "Выйти"-named button, and no "Войти" button, when not loading and user is set', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    const { container } = render(<HomePage />)
    expect(container.textContent).toContain('Анна')
    expect(screen.getByRole('button', { name: /Выйти/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Войти/ })).not.toBeInTheDocument()
  })

  it('clicking "Выйти" calls logout()', async () => {
    const logoutMock = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: logoutMock, setUser: vi.fn() })
    const user = userEvent.setup()
    render(<HomePage />)

    await user.click(screen.getByRole('button', { name: /Выйти/ }))

    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it('clicking the avatar navigates to schlussel\'s unified account page, not a local route', async () => {
    // schloss has no settings page of its own, and there is no separate
    // gear icon anymore - the avatar itself is the settings entry point,
    // sending the browser to schlussel's hosted account page instead.
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    const user = userEvent.setup()
    render(<HomePage />)

    await user.click(screen.getByRole('button', { name: 'Настройки аккаунта' }))

    expect(window.location.href).toContain('/account')
    expect(window.location.href).toContain('return_to=')
  })

  it.each([
    ['Kuvert', 'Бюджет по методу конвертов'],
    ['Tafel', 'Личные проекты и задачи'],
    ['Zettel', 'Быстрое хранилище заметок'],
    ['Glocke', 'Центр уведомлений'],
  ])('renders a clickable %s service card', (name, description) => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)
    const card = screen.getByRole('link', { name: new RegExp(name) })
    expect(card).toHaveAttribute('href')
    expect(card).toHaveTextContent(description)
  })

  it('renders the "coming soon" placeholder card with the exact text when not loading and user is set', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)
    expect(screen.getByText('Скоро появятся новые сервисы')).toBeInTheDocument()
  })

  it('uses Glocke\'s frontend development port when no launcher URL is configured', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)

    expect(screen.getByRole('link', { name: /Glocke/ })).toHaveAttribute('href', 'http://localhost:5177')
  })

  it('does not redirect to the login URL when not loading and user is set', async () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    const loginUrl = await buildSchluesselLoginUrl('/')
    const originalHref = window.location.href

    render(<HomePage />)

    // give any stray effect a tick to (incorrectly) fire before asserting
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.location.href).not.toBe(loginUrl)
    expect(window.location.href).toBe(originalHref)
  })
})

// ---------------------------------------------------------------------------
// Additive visual content: hero illustration, highlights strip, GitHub footer link
// ---------------------------------------------------------------------------
describe('HomePage - hero illustration, highlights strip, and GitHub footer link', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    originalLocation = window.location
    // @ts-expect-error -- intentionally deleting to stub location for the test
    delete window.location
    // @ts-expect-error -- plain writable stand-in object
    window.location = { ...originalLocation, href: originalLocation.href }
  })

  afterEach(() => {
    cleanup()
    // @ts-expect-error -- restore the real Location object
    window.location = originalLocation
  })

  it('renders an accessible SVG hero illustration when not loading and user is set', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)

    const heroSvg = screen.getByRole('img', { name: 'Schloss' })
    expect(heroSvg).not.toBeNull()
    expect(heroSvg.tagName.toLowerCase()).toBe('svg')
  })

  it('renders exactly three highlight tiles with the expected titles when not loading and user is set', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)

    expect(screen.getByText('Свой хостинг')).toBeInTheDocument()
    expect(screen.getByText('Открытый код')).toBeInTheDocument()
    expect(screen.getByText('Твои данные — твои')).toBeInTheDocument()
  })

  it('renders a GitHub footer link opening in a new tab with a safe rel attribute when not loading and user is set', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    render(<HomePage />)

    const githubLink = screen.getByRole('link', { name: /github/i })
    expect(githubLink).toHaveAttribute('href', 'https://github.com/zudaR107')
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink.getAttribute('rel')).toEqual(expect.stringContaining('noreferrer'))
  })

  it('does not render the hero image, highlight tiles, or GitHub link while loading is true', () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: true, logout: vi.fn(), setUser: vi.fn() })
    const { container } = render(<HomePage />)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText('Свой хостинг')).not.toBeInTheDocument()
    expect(screen.queryByText('Открытый код')).not.toBeInTheDocument()
    expect(screen.queryByText('Твои данные — твои')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /github/i })).not.toBeInTheDocument()
  })

  it('does not render the hero image, highlight tiles, or GitHub link when not loading and user is null', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, logout: vi.fn(), setUser: vi.fn() })
    const { container } = render(<HomePage />)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText('Свой хостинг')).not.toBeInTheDocument()
    expect(screen.queryByText('Открытый код')).not.toBeInTheDocument()
    expect(screen.queryByText('Твои данные — твои')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /github/i })).not.toBeInTheDocument()
  })
})
