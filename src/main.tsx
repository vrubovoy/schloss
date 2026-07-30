import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { router } from './router'
import { applyTheme, getStoredTheme, ThemeSync } from '@zudar107/schloss-ui'
import './index.css'

// Applied here, eagerly, before React ever renders - matching
// schlussel/web and kuvert - rather than inside a useEffect on the home
// page, which only runs after the first paint and briefly flashes the
// default light theme first.
applyTheme(getStoredTheme())

// Same origin schlussel's own login links already point at (see
// lib/authRedirect.ts) - it doubles as the theme-sync API's origin since
// schloss's own localStorage can't be read from schlussel's or kuvert's
// origin directly.
const SCHLUSSEL_URL: string = (import.meta.env.VITE_SCHLUSSEL_URL as string | undefined) ?? 'http://localhost:4001'

function Root() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <ThemeSync apiOrigin={SCHLUSSEL_URL} />
      <RouterProvider router={router} />
    </AuthContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
