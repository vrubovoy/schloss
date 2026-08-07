import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from '../pages/HomePage'
import { buildSchluesselLoginUrl } from '../lib/authRedirect'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: useAuthMock,
}))

const sampleUser = { id: '1', email: 'anna@example.com', name: 'Анна', role: 'user' as const }

let originalLocation: Location

describe('HomePage', () => {
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
