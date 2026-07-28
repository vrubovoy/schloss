import { createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router'
import HomePage from '../pages/HomePage'
import HelpPage from '../pages/HelpPage'
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
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
