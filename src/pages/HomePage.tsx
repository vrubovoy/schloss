import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Archive, Eye, Inbox, Mail, ListChecks, NotebookText, Plus, Server, ShieldCheck, Code2 } from 'lucide-react'
import { Header, Footer, Badge, StatTile, Sparkline, ThemeToggle, useAvatarUrl, useUnreadNotifications } from '@zudar107/schloss-ui'
import { HeroIllustration } from '../components/HeroIllustration'
import { useAuth } from '../hooks/useAuth'
import { useServerStats } from '../hooks/useServerStats'
import type { ContainerStatus } from '../hooks/useServerStats'
import { buildSchluesselLoginUrl, buildSchluesselLogoutUrl, buildSchluesselAccountUrl } from '../lib/authRedirect'
import { GLOCKE_NOTIFICATIONS_HREF, GLOCKE_ORIGIN } from '../lib/glocke'
import { notificationApiClient } from '../lib/notificationApiClient'
import { formatUptime } from '../lib/format'
import { pluralizeRu } from '../lib/pluralize'
import { runtimeConfig } from '../lib/runtimeConfig'
import type { OptionalServices } from '../lib/runtimeConfig'

const LOGO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

interface Highlight {
  icon: React.ReactNode
  titel: string
  beschreibung: string
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <Server size={20} strokeWidth={1.75} />,
    titel: 'Свой хостинг',
    beschreibung: 'Работает на твоём железе, не в чужом облаке',
  },
  {
    icon: <Code2 size={20} strokeWidth={1.75} />,
    titel: 'Открытый код',
    beschreibung: 'AGPL-3.0, весь исходный код на GitHub',
  },
  {
    icon: <ShieldCheck size={20} strokeWidth={1.75} />,
    titel: 'Твои данные — твои',
    beschreibung: 'Ничего не уходит на сторонние серверы',
  },
]

interface Dienst {
  id: keyof OptionalServices
  name: string
  beschreibung: string
  url: string | null
  icon: React.ReactNode
  farbe: string
  status: 'aktiv' | 'bald'
}

const DIENSTE: Dienst[] = [
  {
    id: 'kuvert',
    name: 'Kuvert',
    beschreibung: 'Бюджет по методу конвертов',
    url: runtimeConfig.kuvertUrl,
    // Same envelope glyph as Kuvert's own favicon/sidebar badge, not a
    // generic wallet - this card should read as "that specific service".
    icon: <Mail size={28} strokeWidth={1.5} />,
    // Kuvert's own real accent (teal) - this used to be schlussel's blue
    // by mistake, making the card read as the wrong service's brand.
    farbe: '#0d9488',
    status: 'aktiv',
  },
  {
    id: 'tafel',
    name: 'Tafel',
    beschreibung: 'Личные проекты и задачи',
    url: runtimeConfig.tafelUrl,
    // Same checklist glyph as Tafel's own favicon/sidebar badge, not a
    // generic dashboard icon.
    icon: <ListChecks size={28} strokeWidth={1.5} />,
    farbe: '#f59e0b',
    status: 'aktiv',
  },
  {
    id: 'zettel',
    name: 'Zettel',
    beschreibung: 'Быстрое хранилище заметок',
    url: runtimeConfig.zettelUrl,
    // Same note-card glyph as Zettel's own favicon/sidebar badge - was
    // StickyNote by mistake, a different glyph than Zettel actually uses.
    icon: <NotebookText size={28} strokeWidth={1.5} />,
    farbe: '#db2777',
    status: 'aktiv',
  },
  {
    id: 'schrank',
    name: 'Schrank',
    beschreibung: 'Хранилище файлов с папками',
    url: runtimeConfig.schrankUrl,
    // Same wardrobe/archive glyph as Schrank's own favicon/sidebar badge.
    icon: <Archive size={28} strokeWidth={1.5} />,
    // Schrank's own real accent (brown), matching its HeroIllustration body.
    farbe: '#92400e',
    status: 'aktiv',
  },
  {
    id: 'herold',
    name: 'Herold',
    beschreibung: 'Почта из внешних IMAP/SMTP-аккаунтов',
    url: runtimeConfig.heroldUrl,
    // Same inbox glyph as Herold's own favicon/sidebar badge - Mail is
    // already Kuvert's icon above, so a different one keeps the two
    // cards from reading as the same service at a glance.
    icon: <Inbox size={28} strokeWidth={1.5} />,
    // Herold's own real accent (magenta/fuchsia), matching its
    // HeroIllustration seal.
    farbe: '#c026d3',
    status: 'aktiv',
  },
]

// Glocke (and any future auxiliary/infrastructure service - schlussel's
// auth is the other member) deliberately has no launcher card here: it's
// not a content app a user picks from the home page, it's reached only
// via the shared header bell every service already renders. See
// GLOCKE_NOTIFICATIONS_HREF wiring on <Header notifications=.../> below.

export default function HomePage() {
  const { user, loading, logout } = useAuth()
  const notificationState = useUnreadNotifications({
    glockeOrigin: GLOCKE_ORIGIN,
    userId: user?.id ?? null,
    apiClient: notificationApiClient,
  })
  const avatarUrl = useAvatarUrl({
    schluesselOrigin: runtimeConfig.schlusselUrl,
    userId: user?.id ?? null,
    apiClient: notificationApiClient,
  })

  // Set synchronously (before logout()'s own async work starts) by
  // onLogout below, so this effect can tell "no user because the session
  // was never established" (needs the login redirect) apart from "no user
  // because we just deliberately logged out" (already navigating to
  // schlussel's logout page - a second, competing navigation to the LOGIN
  // page here would race it and could win, undoing the logout).
  const loggingOutRef = useRef(false)

  // The home page requires authentication: once the silent-refresh check
  // resolves with no user, bounce straight to schlussel's hosted login
  // instead of ever showing page content.
  useEffect(() => {
    if (!loading && !user && !loggingOutRef.current) {
      void buildSchluesselLoginUrl('/').then((url) => { window.location.href = url })
    }
  }, [loading, user])

  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
      }} />
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        logo={LOGO}
        homeHref="/"
        user={{ ...user, avatarUrl }}
        // Opens the platform-wide account settings hosted on schlussel
        // (password, delete account, ...) - schloss has no settings page
        // of its own to route to instead.
        onSettings={() => { window.location.href = buildSchluesselAccountUrl(window.location.pathname) }}
        onLogout={() => {
          loggingOutRef.current = true
          void logout().then(() => { window.location.href = buildSchluesselLogoutUrl() })
        }}
        notifications={{ href: GLOCKE_NOTIFICATIONS_HREF, state: notificationState, glockeOrigin: GLOCKE_ORIGIN, apiClient: notificationApiClient }}
        rightSlot={<ThemeToggle />}
      />

      <main style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1.5rem', marginBottom: '2.5rem',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              {`Добрый день, ${user.name}`}
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Твои личные сервисы под рукой
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <HeroIllustration size={120} className="hero-illustration" />
          </div>
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem',
          marginBottom: '2rem',
        }}>
          {HIGHLIGHTS.map((h) => (
            <div key={h.titel} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
              padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              flex: '0 1 220px',
            }}>
              <div style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>{h.icon}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{h.titel}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{h.beschreibung}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {DIENSTE.filter((d) => runtimeConfig.services[d.id]).map((d) => <DienstKarte key={d.id} dienst={d} />)}
          <PlatzhalterKarte />
        </div>

        {/* Wächter's own widget - admin-only, no launcher card, no accent
            color of its own (see wachter's own README for why: it's an
            auxiliary/infrastructure service, not a content app). Placed
            after the launcher grid, an "ops corner" rather than
            competing with the page's actual purpose for everyone else. */}
        {user.role === 'admin' && <ServerStatsWidget />}
      </main>

      <Footer serviceName="Schloss" description="Домашняя страница и точка входа" version={__APP_VERSION__} helpHref="/help" />
    </div>
  )
}

function DienstKarte({ dienst }: { dienst: Dienst }) {
  const aktiv = dienst.status === 'aktiv'
  const clickable = aktiv && dienst.url !== null
  return (
    <a
      href={clickable ? dienst.url ?? undefined : undefined}
      className="card"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minHeight: 160,
        cursor: clickable ? 'pointer' : 'default',
        textDecoration: 'none',
        transition: 'box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!clickable) return
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = ''
        e.currentTarget.style.transform = ''
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: dienst.farbe,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }} />
      <div style={{
        width: 48, height: 48,
        borderRadius: 'var(--radius-md)',
        background: `${dienst.farbe}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: dienst.farbe,
      }}>
        {dienst.icon}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{dienst.name}</span>
          {!aktiv && <Badge variant="warning">Скоро</Badge>}
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {dienst.beschreibung}
        </p>
      </div>
    </a>
  )
}

function isContainerDown(c: ContainerStatus): boolean {
  return c.state !== 'running' || c.health === 'unhealthy'
}

// Neutral styling throughout - plain .card/var(--text-*)/var(--border),
// no accent token of its own, matching Wächter's own "no color" framing.
// Every clickable area below leads to /server-stats (or a specific
// container's own page) for the full graphs - this widget itself only
// ever shows the live instant numbers plus a short recent trend.
function ServerStatsWidget() {
  // Fails silently rather than showing an error card while no reading
  // has ever succeeded yet - this is a nice-to-have ops widget, not core
  // page functionality, and a half-broken "could not load server stats"
  // banner on the home page would be a worse experience than the widget
  // just not appearing yet. Once a first reading lands, it keeps
  // showing that last-known snapshot even if a later poll fails.
  const { stats, error } = useServerStats(true)
  if (!stats && !error) return null
  if (!stats) return (
    <div className="card" role="status" style={{ padding: '1.5rem', marginTop: '2rem', color: 'var(--text-secondary)' }}>
      Состояние сервера сейчас недоступно
    </div>
  )

  const downContainers = stats.containers.filter(isContainerDown)
  const healthyCount = stats.containers.length - downContainers.length
  const containerSummary = stats.containers.length === 0
    ? 'Нет данных о контейнерах'
    : downContainers.length === 0
      ? `Все ${stats.containers.length} ${pluralizeRu(stats.containers.length, 'контейнер', 'контейнера', 'контейнеров')} активны`
      : `${healthyCount} из ${stats.containers.length} ${pluralizeRu(stats.containers.length, 'контейнер', 'контейнера', 'контейнеров')} активны`

  return (
    <div className="card" style={{ padding: '1.5rem', marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Eye size={18} color="var(--text-secondary)" strokeWidth={1.75} />
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Состояние сервера
        </h2>
      </div>

      {(error || stats.stale || stats.status !== 'ok') && (
        <p role="status" style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--badge-warning-text)' }}>
          {stats.stale || error ? 'Показаны последние сохранённые данные' : 'Часть источников мониторинга недоступна'}
        </p>
      )}

      <Link
        to="/server-stats"
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        aria-label="Подробная статистика сервера"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <StatTile label="CPU" value={`${Math.round(stats.cpuPercent)}%`} />
          <StatTile label="Память" value={`${Math.round(stats.memPercent)}%`} />
          <StatTile label="Диск" value={`${Math.round(stats.diskPercent)}%`} />
          <StatTile label="Аптайм" value={formatUptime(stats.uptimeSeconds)} />
        </div>

        {(stats.cpuHistory.length > 1 || stats.memHistory.length > 1) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>CPU за последние минуты</div>
              <Sparkline values={stats.cpuHistory.map((point) => point.value)} height={32} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Память за последние минуты</div>
              <Sparkline values={stats.memHistory.map((point) => point.value)} height={32} />
            </div>
          </div>
        )}
      </Link>

      <Link
        to="/server-stats"
        style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: downContainers.length > 0 ? '0.625rem' : 0 }}
      >
        {containerSummary} →
      </Link>

      {downContainers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {downContainers.map((c) => (
            <Link key={c.name} to="/server-stats/$name" params={{ name: c.name }} style={{ textDecoration: 'none' }}>
              <Badge variant="danger">
                {c.name}: {c.health === 'unhealthy' ? 'unhealthy' : c.state}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function PlatzhalterKarte() {
  return (
    <div className="card" style={{
      padding: '1.5rem',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '0.5rem', minHeight: 160,
      borderStyle: 'dashed', opacity: 0.5, cursor: 'default',
    }}>
      <Plus size={24} color="var(--text-muted)" strokeWidth={1.5} />
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
        Скоро появятся новые сервисы
      </span>
    </div>
  )
}
