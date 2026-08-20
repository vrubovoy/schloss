import { createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router'
import { NotFoundPage } from '@zudar107/schloss-ui'
import HomePage from '../pages/HomePage'
import HelpPage from '../pages/HelpPage'
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

const routeTree = rootRoute.addChildren([indexRoute, helpRoute, authCallbackRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
