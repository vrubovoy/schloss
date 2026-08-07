import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  envDir: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // schloss-ui is its own workspace package with its own
    // vitest.config.ts and test suite - without this exclude, running
    // from the repo root also sweeps its test files into this run.
    exclude: ['**/node_modules/**', 'schloss-ui/**'],
  },
})
