import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Header, Footer, Badge, SegmentedControl, ThemeToggle, useAvatarUrl, useUnreadNotifications } from '@zudar107/schloss-ui'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../hooks/useAuth'
import { useServerStats, useMetricHistory } from '../hooks/useServerStats'
import type { ContainerStatus, HistoryRange } from '../hooks/useServerStats'
import { buildSchluesselLogoutUrl, buildSchluesselAccountUrl } from '../lib/authRedirect'
import { GLOCKE_NOTIFICATIONS_HREF, GLOCKE_ORIGIN } from '../lib/glocke'
import { notificationApiClient } from '../lib/notificationApiClient'
import { formatUptime } from '../lib/format'
import { pluralizeRu } from '../lib/pluralize'
import { HISTORY_RANGE_OPTIONS } from '../lib/historyRange'

const SCHLUSSEL_URL = (import.meta.env.VITE_SCHLUSSEL_URL as string | undefined) ?? 'http://localhost:4001'

const LOGO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

function isContainerDown(c: ContainerStatus): boolean {
  return c.state !== 'running' || c.health === 'unhealthy'
}

function ContainerRow({ container }: { container: ContainerStatus }) {
  const down = isContainerDown(container)
  return (
    <Link
      to="/server-stats/$name"
      params={{ name: container.name }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
        <Badge variant={down ? 'danger' : 'success'}>{container.health === 'unhealthy' ? 'unhealthy' : container.state}</Badge>
        <span style={{
          fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {container.name}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        <span>CPU {Math.round(container.cpuPercent)}%</span>
        <span>Память {Math.round(container.memPercent)}%</span>
      </div>
    </Link>
  )
}

// Wächter's detailed drill-down, reached by clicking any metric or the
// container line in HomePage's own widget. Same "no accent color, plain
// card" framing as the widget itself - this is still an auxiliary/ops
// page, not a content app.
export default function ServerStatsPage() {
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

  const { stats, error: statsError } = useServerStats(isAdmin)
  const { history: cpuHistory, error: cpuError } = useMetricHistory('cpu', range, isAdmin)
  const { history: memHistory, error: memError } = useMetricHistory('memory', range, isAdmin)
  const { history: diskHistory, error: diskError } = useMetricHistory('disk', range, isAdmin)

  if (loading || !isAdmin || !user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
      }} />
    )
  }

  const containers = stats?.containers ?? []
  const healthyCount = containers.filter((c) => !isContainerDown(c)).length
  const sortedContainers = [...containers].sort((a, b) => {
    const aDown = isContainerDown(a)
    const bDown = isContainerDown(b)
    if (aDown !== bDown) return aDown ? -1 : 1
    return a.name.localeCompare(b.name)
  })

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
        <Link to="/" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← На главную
        </Link>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', margin: '1rem 0 0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Состояние сервера
          </h1>
          <Link to="/server-stats/docs" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            API-документация →
          </Link>
        </div>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Обновляется каждые несколько секунд
          {stats ? ` · аптайм ${formatUptime(stats.uptimeSeconds)}` : ''}
        </p>

        {(statsError || stats?.stale || stats?.status === 'degraded') && (
          <div role="status" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)', fontSize: '0.8125rem' }}>
            {statsError || stats?.stale
              ? `Данные устарели${stats?.sampledAt ? ` · последний опрос ${new Date(stats.sampledAt).toLocaleString('ru-RU')}` : ''}`
              : 'Часть источников мониторинга недоступна'}
          </div>
        )}
        {!stats && statsError && (
          <div role="alert" style={{ marginBottom: '1rem', color: 'var(--badge-danger-text)', fontSize: '0.875rem' }}>
            Не удалось загрузить состояние сервера
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <SegmentedControl options={HISTORY_RANGE_OPTIONS} value={range} onChange={setRange} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <MetricCard title="CPU" current={stats?.cpuPercent ?? 0} history={cpuHistory?.values.map((point) => point.value) ?? null} error={cpuError} />
          <MetricCard title="Память" current={stats?.memPercent ?? 0} history={memHistory?.values.map((point) => point.value) ?? null} error={memError} />
          <MetricCard title="Диск" current={stats?.diskPercent ?? 0} history={diskHistory?.values.map((point) => point.value) ?? null} error={diskError} />
        </div>

        <section className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Контейнеры
          </h2>
          {containers.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Пока нет данных о контейнерах</p>
          ) : (
            <>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {healthyCount} из {containers.length}{' '}
                {pluralizeRu(containers.length, 'контейнер', 'контейнера', 'контейнеров')} активны
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sortedContainers.map((c) => <ContainerRow key={c.name} container={c} />)}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer serviceName="Schloss" description="Домашняя страница и точка входа" version={__APP_VERSION__} />
    </div>
  )
}
