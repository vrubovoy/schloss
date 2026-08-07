import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [tailwindcss(), react()],
    server: {
      port: 3000,
      proxy: {
        '/auth': {
          target: env.SCHLUSSEL_API_URL || 'http://localhost:4000',
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('X-Schlussel-Frontend')
            })
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  }
})
