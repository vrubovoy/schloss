import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ServerStatsContainerPage from './ServerStatsContainerPage'
import type { ServerStats, ContainerHistory } from '../hooks/useServerStats'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { useAuthMock, useServerStatsMock, useContainerHistoryMock, restartContainerMock, useParamsMock, navigateMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useServerStatsMock: vi.fn(),
  useContainerHistoryMock: vi.fn(),
  restartContainerMock: vi.fn(),
  useParamsMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: useAuthMock,
}))

// The hooks' own fetch/polling behavior is covered in useServerStats.test.ts
// - this page only needs to be tested against what the hooks return.
// restartContainer is a plain async function (not a hook) - mocked the
// same way as any other named export.
vi.mock('../hooks/useServerStats', () => ({
  useServerStats: useServerStatsMock,
  useContainerHistory: useContainerHistoryMock,
  restartContainer: restartContainerMock,
}))

// The page's real <Link>/useNavigate/useParams require a mounted
// RouterProvider - render() here mounts the page standalone, same
// convention as HomePage.test.tsx (Link) and AuthCallbackPage.test.tsx
// (useNavigate). useParams is stubbed the same way so the route param
// ($name) can be set per test without a real router matching a URL.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: useParamsMock,
    Link: ({ to, params, children, ...rest }: {
      to: string
      params?: Record<string, string>
      children?: React.ReactNode
      [key: string]: unknown
    }) => {
      const href = params
        ? Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)
        : to
      return <a href={href} {...rest}>{children}</a>
    },
  }
})

const sampleUser = { id: '1', email: 'anna@example.com', name: 'Анна', role: 'user' as const }
const sampleAdmin = { id: '2', email: 'otto@example.com', name: 'Отто', role: 'admin' as const }
const points = (values: number[]) => values.map((value, index) => ({ timestamp: new Date(index * 5000).toISOString(), value }))

const sampleStats: ServerStats = {
  status: 'ok',
  sampledAt: new Date().toISOString(),
  stale: false,
  sources: {
    host: { status: 'ok', sampledAt: new Date().toISOString(), error: null },
    docker: { status: 'ok', sampledAt: new Date().toISOString(), error: null },
  },
  cpuPercent: 10,
  memPercent: 20,
  diskPercent: 30,
  uptimeSeconds: 3600,
  cpuHistory: [],
  memHistory: [],
  diskHistory: [],
  containers: [
    { id: 'c1', name: 'kuvert-backend', state: 'running', status: 'Up 2 hours', health: 'healthy', cpuPercent: 12.4, memPercent: 33.9, restartable: true, critical: false },
  ],
}

const sampleHistory: ContainerHistory = {
  name: 'kuvert-backend',
  range: 'hour',
  cpuHistory: points([10, 12, 12.4]),
  memHistory: points([30, 32, 33.9]),
  sampleIntervalMs: 5000,
}

describe('ServerStatsContainerPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    navigateMock.mockClear()
    useParamsMock.mockReset().mockReturnValue({ name: 'kuvert-backend' })
    useServerStatsMock.mockReset().mockReturnValue({ stats: null, error: false })
    useContainerHistoryMock.mockReset().mockReturnValue({ history: null, error: false, notFound: false })
    restartContainerMock.mockReset().mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects a non-admin user to the home page', async () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn() })

    render(<ServerStatsContainerPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true })
    })
  })

  it('redirects a logged-out user to the home page', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, logout: vi.fn() })

    render(<ServerStatsContainerPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true })
    })
  })

  it('renders nothing and does not redirect while auth is still loading', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, logout: vi.fn() })

    const { container } = render(<ServerStatsContainerPage />)

    expect(container.textContent).toBe('')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it("renders the container's name, status, health, and CPU/memory graphs when data is available", () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    expect(screen.getByRole('heading', { name: 'kuvert-backend' })).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('Up 2 hours')).toBeInTheDocument()
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(screen.getByText('Память')).toBeInTheDocument()
    expect(screen.getByText('34%')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(2)

    expect(useContainerHistoryMock).toHaveBeenCalledWith('kuvert-backend', 'hour', true)
  })

  it('requests the container history hook using the routed $name param', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useParamsMock.mockReturnValue({ name: 'tafel-backend' })
    useServerStatsMock.mockReturnValue({ stats: { ...sampleStats, containers: [] }, error: false })

    render(<ServerStatsContainerPage />)

    expect(screen.getByRole('heading', { name: 'tafel-backend' })).toBeInTheDocument()
    expect(useContainerHistoryMock).toHaveBeenCalledWith('tafel-backend', 'hour', true)
  })

  it('shows a "not found" message and no metric cards when the container is unknown and history reports notFound', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: { ...sampleStats, containers: [] }, error: false })
    useContainerHistoryMock.mockReturnValue({ history: null, error: false, notFound: true })

    render(<ServerStatsContainerPage />)

    expect(screen.getByText(/Контейнер с таким именем не найден/)).toBeInTheDocument()
    expect(screen.queryByText('CPU')).not.toBeInTheDocument()
    expect(screen.queryByText('Память')).not.toBeInTheDocument()
  })

  it('renders metric cards in their "accumulating data" state, without crashing, when the container has no history yet', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: { ...sampleStats, containers: [] }, error: false })
    useContainerHistoryMock.mockReturnValue({ history: null, error: false, notFound: false })

    expect(() => render(<ServerStatsContainerPage />)).not.toThrow()

    expect(screen.queryByText(/Контейнер с таким именем не найден/)).not.toBeInTheDocument()
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('Память')).toBeInTheDocument()
    expect(screen.getAllByText('Накопление данных…')).toHaveLength(2)
    expect(screen.getByText(/Ещё не опрошен планировщиком/)).toBeInTheDocument()
  })

  it('has a link back to the overview page', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    const backLink = screen.getByText('← К обзору сервера')
    expect(backLink.closest('a')).toHaveAttribute('href', '/server-stats')
  })

  it('renders the range SegmentedControl with "hour" selected by default', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    expect(screen.getByRole('button', { name: 'Час' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Сутки' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Неделя' })).toBeInTheDocument()
  })

  it('requests a different range from useContainerHistory after clicking a different SegmentedControl option', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    expect(useContainerHistoryMock).toHaveBeenCalledWith('kuvert-backend', 'hour', true)

    await user.click(screen.getByRole('button', { name: 'Сутки' }))

    expect(screen.getByRole('button', { name: 'Сутки' })).toHaveAttribute('aria-pressed', 'true')
    expect(useContainerHistoryMock).toHaveBeenCalledWith('kuvert-backend', 'day', true)
  })

  it('shows a restart button that opens a confirmation modal instead of restarting immediately', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Перезапустить' }))

    expect(restartContainerMock).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Перезапустить контейнер?')).toBeInTheDocument()
  })

  it('calls restartContainer with the container name when the confirmation modal is confirmed', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    await user.click(screen.getByRole('button', { name: 'Перезапустить' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Перезапустить' }))

    await waitFor(() => {
      expect(restartContainerMock).toHaveBeenCalledTimes(1)
    })
    expect(restartContainerMock).toHaveBeenCalledWith('kuvert-backend')
  })

  it('does not call restartContainer when the confirmation modal is canceled', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    await user.click(screen.getByRole('button', { name: 'Перезапустить' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))

    expect(restartContainerMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an inline error message, without crashing, when the restart fails', async () => {
    const user = userEvent.setup()
    restartContainerMock.mockResolvedValue({ ok: false, error: 'Контейнер не найден' })
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    await user.click(screen.getByRole('button', { name: 'Перезапустить' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Перезапустить' }))

    await waitFor(() => {
      expect(screen.getByText(/Не удалось перезапустить контейнер/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Контейнер не найден/)).toBeInTheDocument()
  })

  it('does not render a restart button for a non-admin user (page redirects before any container UI renders)', async () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useContainerHistoryMock.mockReturnValue({ history: sampleHistory, error: false, notFound: false })

    render(<ServerStatsContainerPage />)

    expect(screen.queryByRole('button', { name: 'Перезапустить' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true })
    })
  })

  it('does not render restart for a container without an allowlist label', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({
      stats: { ...sampleStats, containers: [{ ...sampleStats.containers[0]!, restartable: false }] },
      error: false,
    })
    render(<ServerStatsContainerPage />)
    expect(screen.queryByRole('button', { name: 'Перезапустить' })).not.toBeInTheDocument()
  })
})
