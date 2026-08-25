import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ServerStatsPage from './ServerStatsPage'
import type { ServerStats, MetricHistory, MetricName, HistoryRange } from '../hooks/useServerStats'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { useAuthMock, useServerStatsMock, useMetricHistoryMock, navigateMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useServerStatsMock: vi.fn(),
  useMetricHistoryMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: useAuthMock,
}))

// The hooks' own fetch/polling behavior is covered in useServerStats.test.ts
// - this page only needs to be tested against what the hooks return.
vi.mock('../hooks/useServerStats', () => ({
  useServerStats: useServerStatsMock,
  useMetricHistory: useMetricHistoryMock,
}))

// The page's real <Link>/useNavigate require a mounted RouterProvider -
// render() here mounts the page standalone, same convention as
// HomePage.test.tsx (Link) and AuthCallbackPage.test.tsx (useNavigate).
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
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
  cpuPercent: 45.6,
  memPercent: 63.7,
  diskPercent: 28,
  uptimeSeconds: 3 * 86400 + 4 * 3600,
  cpuHistory: points([10, 20, 45.6]),
  memHistory: points([60, 62, 63.7]),
  diskHistory: points([20, 25, 28]),
  containers: [],
}

function metricHistoryFor(values: Record<MetricName, number[]>) {
  return (metric: MetricName, range: HistoryRange): { history: MetricHistory | null; error: boolean } => ({
    history: { metric, range, values: points(values[metric]), sampleIntervalMs: 5000 },
    error: false,
  })
}

describe('ServerStatsPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    navigateMock.mockClear()
    useServerStatsMock.mockReset().mockReturnValue({ stats: null, error: false })
    useMetricHistoryMock.mockReset().mockReturnValue({ history: null, error: false })
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects a non-admin user to the home page', async () => {
    useAuthMock.mockReturnValue({ user: sampleUser, loading: false, logout: vi.fn() })

    render(<ServerStatsPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true })
    })
    expect(screen.queryByText('Состояние сервера')).not.toBeInTheDocument()
  })

  it('redirects a logged-out user to the home page', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, logout: vi.fn() })

    render(<ServerStatsPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true })
    })
  })

  it('renders nothing and does not redirect while auth is still loading', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, logout: vi.fn() })

    const { container } = render(<ServerStatsPage />)

    expect(container.textContent).toBe('')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('renders CPU/memory/disk figures and graphs for an admin once data arrives', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useMetricHistoryMock.mockImplementation(metricHistoryFor({
      cpu: [10, 20, 45.6],
      memory: [60, 62, 63.7],
      disk: [20, 25, 28],
    }))

    render(<ServerStatsPage />)

    expect(screen.getByText('Состояние сервера')).toBeInTheDocument()
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('46%')).toBeInTheDocument()
    expect(screen.getByText('Память')).toBeInTheDocument()
    expect(screen.getByText('64%')).toBeInTheDocument()
    expect(screen.getByText('Диск')).toBeInTheDocument()
    expect(screen.getByText('28%')).toBeInTheDocument()
    expect(screen.getByText(/аптайм 3д 4ч/)).toBeInTheDocument()
    // Three metric cards, all with usable (>1-point) history -> three sparklines
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(3)

    expect(useMetricHistoryMock).toHaveBeenCalledWith('cpu', 'hour', true)
    expect(useMetricHistoryMock).toHaveBeenCalledWith('memory', 'hour', true)
    expect(useMetricHistoryMock).toHaveBeenCalledWith('disk', 'hour', true)
  })

  it('renders a container list with name, status, and CPU/memory figures, linking to the per-container page', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({
      stats: {
        ...sampleStats,
        containers: [
          { id: 'c1', name: 'kuvert-backend', state: 'running', status: 'Up 2 hours', health: 'healthy', cpuPercent: 12.4, memPercent: 33.9 },
          { id: 'c2', name: 'tafel-backend', state: 'exited', status: 'Exited (1)', health: null, cpuPercent: 0, memPercent: 0 },
        ],
      },
      error: false,
    })

    render(<ServerStatsPage />)

    expect(screen.getByText('kuvert-backend')).toBeInTheDocument()
    expect(screen.getByText('CPU 12%')).toBeInTheDocument()
    expect(screen.getByText('Память 34%')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()

    expect(screen.getByText('tafel-backend')).toBeInTheDocument()
    expect(screen.getByText('exited')).toBeInTheDocument()

    const kuvertLink = screen.getByText('kuvert-backend').closest('a')
    expect(kuvertLink).toHaveAttribute('href', '/server-stats/kuvert-backend')
    const tafelLink = screen.getByText('tafel-backend').closest('a')
    expect(tafelLink).toHaveAttribute('href', '/server-stats/tafel-backend')
  })

  it('lists down/unhealthy containers before healthy ones', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({
      stats: {
        ...sampleStats,
        containers: [
          { id: 'c1', name: 'aaa-service', state: 'running', status: 'Up', health: 'healthy', cpuPercent: 1, memPercent: 1 },
          { id: 'c2', name: 'zzz-service', state: 'exited', status: 'Exited', health: null, cpuPercent: 0, memPercent: 0 },
        ],
      },
      error: false,
    })

    render(<ServerStatsPage />)

    const names = screen.getAllByText(/-service$/).map((el) => el.textContent)
    expect(names).toEqual(['zzz-service', 'aaa-service'])
  })

  it('shows the healthy/total summary line, pluralized', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({
      stats: {
        ...sampleStats,
        containers: [
          { id: 'c1', name: 'a', state: 'running', status: 'Up', health: 'healthy', cpuPercent: 1, memPercent: 1 },
          { id: 'c2', name: 'b', state: 'running', status: 'Up', health: 'healthy', cpuPercent: 1, memPercent: 1 },
          { id: 'c3', name: 'c', state: 'exited', status: 'Exited', health: null, cpuPercent: 0, memPercent: 0 },
        ],
      },
      error: false,
    })

    render(<ServerStatsPage />)

    expect(screen.getByText(/2 из 3 контейнера активны/)).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no containers', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: { ...sampleStats, containers: [] }, error: false })

    render(<ServerStatsPage />)

    expect(screen.getByText('Пока нет данных о контейнерах')).toBeInTheDocument()
  })

  it('labels retained stats as stale after a polling failure', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: { ...sampleStats, stale: true, status: 'degraded' }, error: true })
    render(<ServerStatsPage />)
    expect(screen.getByText(/Данные устарели/)).toBeInTheDocument()
  })

  it('shows a per-metric error message and does not crash when a metric-history fetch fails', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })
    useMetricHistoryMock.mockImplementation((metric: MetricName) =>
      metric === 'cpu' ? { history: null, error: true } : { history: null, error: false })

    expect(() => render(<ServerStatsPage />)).not.toThrow()

    expect(screen.getByText('Не удалось загрузить историю')).toBeInTheDocument()
    // The other two cards fall back to the "accumulating data" message, not an error.
    expect(screen.getAllByText('Накопление данных…')).toHaveLength(2)
  })

  it('renders the range SegmentedControl with "hour" selected by default', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })

    render(<ServerStatsPage />)

    expect(screen.getByRole('button', { name: 'Час' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Сутки' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Неделя' })).toBeInTheDocument()
  })

  it('requests a different range from useMetricHistory after clicking a different SegmentedControl option', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })

    render(<ServerStatsPage />)

    expect(useMetricHistoryMock).toHaveBeenCalledWith('cpu', 'hour', true)

    await user.click(screen.getByRole('button', { name: 'Неделя' }))

    expect(screen.getByRole('button', { name: 'Неделя' })).toHaveAttribute('aria-pressed', 'true')
    expect(useMetricHistoryMock).toHaveBeenCalledWith('cpu', 'week', true)
    expect(useMetricHistoryMock).toHaveBeenCalledWith('memory', 'week', true)
    expect(useMetricHistoryMock).toHaveBeenCalledWith('disk', 'week', true)
  })

  it('has a link to the API docs page', () => {
    useAuthMock.mockReturnValue({ user: sampleAdmin, loading: false, logout: vi.fn() })
    useServerStatsMock.mockReturnValue({ stats: sampleStats, error: false })

    render(<ServerStatsPage />)

    const docsLink = screen.getByText('API-документация →')
    expect(docsLink.closest('a')).toHaveAttribute('href', '/server-stats/docs')
  })
})
