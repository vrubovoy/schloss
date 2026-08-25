import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Header, Footer, ThemeToggle, useAvatarUrl, useUnreadNotifications } from '@zudar107/schloss-ui'
import { useAuth } from '../hooks/useAuth'
import { getAccessToken } from '../lib/api'
import { buildSchluesselLogoutUrl, buildSchluesselAccountUrl } from '../lib/authRedirect'
import { GLOCKE_NOTIFICATIONS_HREF, GLOCKE_ORIGIN } from '../lib/glocke'
import { notificationApiClient } from '../lib/notificationApiClient'
import 'swagger-ui-dist/swagger-ui.css'

const SCHLUSSEL_URL = (import.meta.env.VITE_SCHLUSSEL_URL as string | undefined) ?? 'http://localhost:4001'

const LOGO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

// Wächter has no frontend of its own (see its README), so - same as its
// /server-stats pages - its Swagger UI lives here in Schloss rather than
// duplicating the swagger-ui-dist wiring every other service's own
// frontend already carries in a service it doesn't have. Fetches
// /wachter/openapi.json through Schloss's own same-origin proxy and
// injects the Bearer token by hand (a plain browser GET can't carry one,
// same reasoning as every sibling DocsPage).
export default function WachterDocsPage() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState('')

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

  useEffect(() => {
    if (!isAdmin || !containerRef.current) return
    let cancelled = false

    async function mount() {
      try {
        const [specRes, { SwaggerUIBundle }] = await Promise.all([
          fetch('/wachter/openapi.json', { headers: { Authorization: `Bearer ${getAccessToken()}` } }),
          import('swagger-ui-dist'),
        ])
        if (!specRes.ok) throw new Error(`HTTP ${specRes.status}`)
        const spec = await specRes.json() as Record<string, unknown>
        if (cancelled || !containerRef.current) return
        SwaggerUIBundle({
          domNode: containerRef.current,
          spec,
          presets: [SwaggerUIBundle.presets.apis],
          requestInterceptor: (req) => {
            // SwaggerRequest's own type only declares `url`/`credentials`
            // plus an index signature - `headers` is always present at
            // runtime but isn't statically typed, hence the cast.
            (req as unknown as { headers: Record<string, string> }).headers['Authorization'] = `Bearer ${getAccessToken()}`
            return req
          },
        })
      } catch {
        if (!cancelled) setLoadError('Не удалось загрузить документацию API')
      }
    }

    void mount()
    return () => { cancelled = true }
  }, [isAdmin])

  if (loading || !isAdmin || !user) {
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
        onSettings={() => { window.location.href = buildSchluesselAccountUrl(window.location.pathname) }}
        onLogout={() => { void logout().then(() => { window.location.href = buildSchluesselLogoutUrl() }) }}
        notifications={GLOCKE_NOTIFICATIONS_HREF
          ? { href: GLOCKE_NOTIFICATIONS_HREF, state: notificationState, glockeOrigin: GLOCKE_ORIGIN ?? '', apiClient: notificationApiClient }
          : undefined}
        rightSlot={<ThemeToggle />}
      />

      <main style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <Link to="/server-stats" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← К обзору сервера
        </Link>

        <h1 style={{ margin: '1rem 0 1.5rem', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
          API Wächter
        </h1>

        {loadError && (
          <div style={{ maxWidth: 480, padding: '0.75rem 1rem', marginBottom: '1rem', background: 'var(--danger-muted)', border: '1px solid var(--danger)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--danger)' }}>
            {loadError}
          </div>
        )}
        <div ref={containerRef} style={{ background: '#fff', margin: '0 -1.5rem' }} />
      </main>

      <Footer serviceName="Schloss" description="Домашняя страница и точка входа" version={__APP_VERSION__} />
    </div>
  )
}
