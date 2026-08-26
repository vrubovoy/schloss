import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import HelpPage from '../pages/HelpPage'

const { useAuthMock, getAccessTokenMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: useAuthMock,
}))

vi.mock('../lib/api', () => ({
  getAccessToken: getAccessTokenMock,
  setAccessToken: vi.fn(),
}))

const sampleUser = { id: '1', email: 'anna@example.com', name: 'Анна', role: 'user' as const }

describe('HelpPage - "Первые шаги" numbered list', () => {
  beforeEach(() => {
    useAuthMock.mockReset().mockReturnValue({ user: null, loading: false, logout: vi.fn(), setUser: vi.fn() })
    getAccessTokenMock.mockReset().mockReturnValue('help-access-token')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.__HOF_CONFIG__.glockeUrl = 'http://localhost:5177'
  })

  it('renders the "Первые шаги" ordered list with visible decimal numbering (not the Tailwind-preflight-stripped "none")', () => {
    render(<HelpPage />)

    const heading = screen.getByRole('heading', { name: 'Первые шаги' })
    const section = heading.closest('section')
    expect(section).not.toBeNull()

    const list = section!.querySelector('ol')
    expect(list).not.toBeNull()

    // Tailwind's preflight reset strips ol/ul to `list-style: none` by
    // default. The fix restores visible "1./2./3." markers by explicitly
    // setting listStyleType to 'decimal' in the ol's inline style, rather
    // than only fixing the indentation.
    expect(list).toHaveStyle({ listStyleType: 'decimal' })
    expect(list!.style.listStyleType).not.toBe('none')
    expect(list!.style.listStyleType).not.toBe('')
  })

  it('renders the three "Первые шаги" step items, in order, inside that ordered list', () => {
    render(<HelpPage />)

    const heading = screen.getByRole('heading', { name: 'Первые шаги' })
    const section = heading.closest('section')
    const list = section!.querySelector('ol') as HTMLOListElement

    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Войди через форму входа Schlüssel (единая для всей платформы).')
    expect(items[1]).toHaveTextContent('На главной странице Schloss увидишь карточки доступных сервисов.')
    expect(items[2]).toHaveTextContent('Открой нужный сервис, нажав на его карточку.')
  })
})

describe('HelpPage - shared Glocke notification bell', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    getAccessTokenMock.mockReset().mockReturnValue('help-access-token')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.__HOF_CONFIG__.glockeUrl = 'http://localhost:5177'
  })

  async function renderConfiguredHelp() {
    window.__HOF_CONFIG__.glockeUrl = 'https://glocke.example.test'
    vi.resetModules()
    const { default: ConfiguredHelpPage } = await import('../pages/HelpPage')
    return render(<ConfiguredHelpPage />)
  }

  it('shows the authenticated shared bell at the configured Glocke notifications page', async () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn(), setUser: vi.fn() })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ count: 0 }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    await renderConfiguredHelp()

    expect(await screen.findByRole('link', { name: /уведомлен/i }))
      .toHaveAttribute('href', 'https://glocke.example.test/notifications')
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it('has no bell and makes no Glocke request without an authenticated user', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, logout: vi.fn(), setUser: vi.fn() })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await renderConfiguredHelp()

    expect(screen.queryByRole('link', { name: /уведомлен/i })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
