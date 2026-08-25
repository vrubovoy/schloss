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
        // Wächter's own routes aren't prefixed with /wachter (they're
        // plain /health, /stats, ...) - the prefix exists only as this
        // frontend's own namespacing for "which backend does this
        // request go to", so it's stripped before forwarding, same
        // reasoning as the production Caddyfile's handle_path block.
        '/wachter': {
          target: env.WACHTER_API_URL || 'http://localhost:3007',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/wachter/, ''),
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  }
})
