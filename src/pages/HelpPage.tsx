import { Header, Footer, ThemeToggle, useUnreadNotifications } from '@zudar107/schloss-ui'
import { useAuth } from '../hooks/useAuth'
import { buildSchluesselLogoutUrl, buildSchluesselAccountUrl } from '../lib/authRedirect'
import { GLOCKE_NOTIFICATIONS_HREF, GLOCKE_ORIGIN } from '../lib/glocke'
import { notificationApiClient } from '../lib/notificationApiClient'

const LOGO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

interface Section {
  titel: string
  text: string
  screenshotSlug: string
  screenshotAlt: string
}

const SECTIONS: Section[] = [
  {
    titel: 'Карточки сервисов',
    text: 'На главной странице ты видишь карточки всех доступных сервисов платформы. Нажми на карточку, чтобы открыть сервис. Карточки с пометкой «Скоро» ещё не готовы — это просто анонс.',
    screenshotSlug: 'services-grid',
    screenshotAlt: 'Главная страница со списком карточек сервисов',
  },
  {
    titel: 'Профиль и выход',
    text: 'Твоё имя и кружок-аватар — в правом верхнем углу. Нажми на аватар, чтобы открыть настройки аккаунта (смена пароля, активные сессии, удаление аккаунта). Рядом — кнопка выхода, а колокольчик открывает уведомления Glocke и показывает число непрочитанных.',
    screenshotSlug: 'header-profile',
    screenshotAlt: 'Верхняя панель с аватаром и кнопкой выхода',
  },
  {
    titel: 'Тема оформления',
    text: 'Переключатель темы (светлая/тёмная/системная) находится в той же верхней панели, слева от аватара.',
    screenshotSlug: 'theme-toggle',
    screenshotAlt: 'Меню переключения темы оформления',
  },
]

export default function HelpPage() {
  const { user, logout } = useAuth()
  const notificationState = useUnreadNotifications({
    glockeOrigin: GLOCKE_ORIGIN ?? '',
    userId: user?.id ?? null,
    apiClient: notificationApiClient,
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        logo={LOGO}
        homeHref="/"
        user={user}
        onSettings={user ? () => { window.location.href = buildSchluesselAccountUrl(window.location.pathname) } : undefined}
        onLogout={user
          ? () => { void logout().then(() => { window.location.href = buildSchluesselLogoutUrl() }) }
          : undefined}
        notifications={user && GLOCKE_NOTIFICATIONS_HREF
          ? { href: GLOCKE_NOTIFICATIONS_HREF, state: notificationState, glockeOrigin: GLOCKE_ORIGIN ?? '', apiClient: notificationApiClient }
          : undefined}
        rightSlot={<ThemeToggle />}
      />

      <main style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <a
          href="/"
          style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          ← На главную
        </a>

        <h1 style={{ margin: '1rem 0 0.5rem', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
          Как пользоваться Schloss
        </h1>
        <p style={{ margin: '0 0 2rem', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
          Schloss — стартовая страница платформы. Отсюда открываются все остальные
          сервисы, и здесь же ты найдёшь свой профиль и настройки.
        </p>

        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Первые шаги
          </h2>
          {/* Tailwind's preflight resets ol/ul to `list-style: none`, so the
              numbers need to be explicitly restored - otherwise paddingLeft
              below just looks like unexplained indentation. */}
          <ol style={{ margin: 0, paddingLeft: '1.25rem', listStyleType: 'decimal', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
            <li>Войди через форму входа Schlüssel (единая для всей платформы).</li>
            <li>На главной странице Schloss увидишь карточки доступных сервисов.</li>
            <li>Открой нужный сервис, нажав на его карточку.</li>
          </ol>
        </section>

        {SECTIONS.map((s) => (
          <section key={s.titel} className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {s.titel}
            </h2>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              {s.text}
            </p>
            {/* TODO(screenshot): drop a PNG at public/guide/schloss-{s.screenshotSlug}.png */}
            <img
              src={`/guide/schloss-${s.screenshotSlug}.png`}
              alt={s.screenshotAlt}
              style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
            />
          </section>
        ))}
      </main>

      <Footer serviceName="Schloss" description="Домашняя страница и точка входа" version={__APP_VERSION__} />
    </div>
  )
}
