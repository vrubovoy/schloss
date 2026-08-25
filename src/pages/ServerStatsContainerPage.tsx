import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Header, Footer, Badge, Button, Modal, SegmentedControl, ThemeToggle, useAvatarUrl, useUnreadNotifications } from '@zudar107/schloss-ui'
import { RotateCw } from 'lucide-react'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../hooks/useAuth'
import { useServerStats, useContainerHistory, restartContainer } from '../hooks/useServerStats'
import type { HistoryRange } from '../hooks/useServerStats'
import { buildSchluesselLogoutUrl, buildSchluesselAccountUrl } from '../lib/authRedirect'
import { GLOCKE_NOTIFICATIONS_HREF, GLOCKE_ORIGIN } from '../lib/glocke'
import { notificationApiClient } from '../lib/notificationApiClient'
import { HISTORY_RANGE_OPTIONS } from '../lib/historyRange'

const SCHLUSSEL_URL = (import.meta.env.VITE_SCHLUSSEL_URL as string | undefined) ?? 'http://localhost:4001'

const LOGO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

type RestartState = 'idle' | 'confirming' | 'restarting' | 'error'

export default function ServerStatsContainerPage() {
  const { name } = useParams({ from: '/server-stats/$name' })
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!loading && !isAdmin) void navigate({ to: '/', replace: true })
  }, [loading, isAdmin, navigate])

  const notificationState = useUnreadNotifications({
    glockeOrigin: GLOCKE_ORIGIN ?? '',
    userId: user?.id ?? null,
    apiClient: notificationApiClient,
  })
  const avatarUrl = useAvatarUrl({
    schluesselOrigin: SCHLUSSEL_URL,
    userId: user?.id ?? null,
    apiClient: notificationApiClient,
  })

  const [range, setRange] = useState<HistoryRange>('hour')
  const [restartState, setRestartState] = useState<RestartState>('idle')
  const [restartError, setRestartError] = useState('')

  // The container list already comes from the same 5s poll the home
  // widget uses (instant cpuPercent/memPercent, no history) - the
  // dedicated history endpoint below only adds the two graphs.
  const { stats } = useServerStats(isAdmin)
  const { history, error, notFound } = useContainerHistory(name, range, isAdmin)

  if (loading || !isAdmin || !user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
      }} />
    )
  }

  const container = stats?.containers.find((c) => c.name === name) ?? null
  const down = container ? (container.state !== 'running' || container.health === 'unhealthy') : false

  async function confirmRestart() {
    setRestartState('restarting')
    const result = await restartContainer(name)
    if (result.ok) {
      // No local "success" state to show - the next 5s poll picks up
      // the container's real state as it comes back on its own, same
      // as every other live number on this page.
      setRestartState('idle')
    } else {
      setRestartState('error')
      setRestartError(result.error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        logo={LOGO}
        homeHref="/"
        user={{ ...user, avatarUrl }}
        onSettings={() => { window.location.href = buildSchluesselAccountUrl(window.location.pathname) }}
        onLogout={() => { void logout().then(() => { window.location.href = buildSchluesselLogoutUrl() }) }}
        notifications={GLOCKE_NOTIFICATIONS_HREF
          ? { href: GLOCKE_NOTIFICATIONS_HREF, state: notificationState, glockeOrigin: GLOCKE_ORIGIN ?? '', apiClient: notificationApiClient }
          : undefined}
        rightSlot={<ThemeToggle />}
      />

      <main style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <Link to="/server-stats" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← К обзору сервера
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', margin: '1rem 0 0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              {name}
            </h1>
            {container && (
              <Badge variant={down ? 'danger' : 'success'}>
                {container.health === 'unhealthy' ? 'unhealthy' : container.state}
              </Badge>
            )}
          </div>
          {container && (
            <Button
              variant="secondary"
              onClick={() => { setRestartState('confirming'); setRestartError('') }}
              disabled={restartState === 'restarting'}
            >
              <RotateCw size={14} strokeWidth={2} />
              {restartState === 'restarting' ? 'Перезапускается…' : 'Перезапустить'}
            </Button>
          )}
        </div>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          {container?.status ?? 'Ещё не опрошен планировщиком - обновится через несколько секунд'}
        </p>

        {restartState === 'error' && (
          <div style={{
            marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            background: 'var(--badge-danger-bg)', color: 'var(--badge-danger-text)', fontSize: '0.8125rem',
          }}>
            Не удалось перезапустить контейнер: {restartError}
          </div>
        )}

        <Modal
          open={restartState === 'confirming'}
          onClose={() => setRestartState('idle')}
          title="Перезапустить контейнер?"
          actions={[
            { label: 'Отмена', onClick: () => setRestartState('idle') },
            { label: 'Перезапустить', variant: 'danger', onClick: () => { void confirmRestart() } },
          ]}
        >
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Контейнер <strong>{name}</strong> будет остановлен и запущен заново. Сервис,
            который он обслуживает, станет недоступен на несколько секунд.
          </p>
        </Modal>

        <div style={{ marginBottom: '1rem' }}>
          <SegmentedControl options={HISTORY_RANGE_OPTIONS} value={range} onChange={setRange} />
        </div>

        {!container && notFound ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Контейнер с таким именем не найден, либо ещё не был опрошен.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <MetricCard title="CPU" current={container?.cpuPercent ?? 0} history={history?.cpuHistory ?? null} error={error} />
            <MetricCard title="Память" current={container?.memPercent ?? 0} history={history?.memHistory ?? null} error={error} />
          </div>
        )}
      </main>

      <Footer serviceName="Schloss" description="Домашняя страница и точка входа" version={__APP_VERSION__} />
    </div>
  )
}
