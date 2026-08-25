import { createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router'
import { NotFoundPage } from '@zudar107/schloss-ui'
import HomePage from '../pages/HomePage'
import HelpPage from '../pages/HelpPage'
import ServerStatsPage from '../pages/ServerStatsPage'
import ServerStatsContainerPage from '../pages/ServerStatsContainerPage'
import WachterDocsPage from '../pages/WachterDocsPage'
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage'
import { HeroIllustration } from '../components/HeroIllustration'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <NotFoundPage homeHref="/" illustration={<HeroIllustration size={100} />} />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: HelpPage,
})

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallbackPage,
})

// Wächter's detailed stats pages - see the widget on HomePage. Live under
// Schloss's own router (not a separate app) since they're just a deeper
// view of the same admin-only ops widget, not a distinct service.
const serverStatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/server-stats',
  component: ServerStatsPage,
})

// Registered before the $name param route below so the static /docs
// path wins over being captured as a container named "docs".
const serverStatsDocsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/server-stats/docs',
  component: WachterDocsPage,
})

const serverStatsContainerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/server-stats/$name',
  component: ServerStatsContainerPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute, helpRoute, authCallbackRoute, serverStatsRoute, serverStatsDocsRoute, serverStatsContainerRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
