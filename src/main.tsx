import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { router } from './router'
import { applyTheme, getStoredTheme, ThemeSync } from '@zudar107/schloss-ui'
import { runtimeConfig } from './lib/runtimeConfig'
import './index.css'

// Applied here, eagerly, before React ever renders - matching
// schlussel/web and kuvert - rather than inside a useEffect on the home
// page, which only runs after the first paint and briefly flashes the
// default light theme first.
applyTheme(getStoredTheme())

function Root() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <ThemeSync apiOrigin={runtimeConfig.schlusselUrl} />
      <RouterProvider router={router} />
    </AuthContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
