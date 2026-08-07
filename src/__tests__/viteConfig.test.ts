import { resolve } from 'node:path'
import { loadConfigFromFile } from 'vite'
import { describe, expect, it, vi } from 'vitest'

describe('Vite development server config', () => {
  it('proxies same-origin /auth requests to the local Schlussel API', async () => {
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      resolve(process.cwd(), 'vite.config.ts'),
    )

    expect(loaded?.config.server?.proxy?.['/auth']).toMatchObject({
      target: 'http://localhost:4000',
      changeOrigin: true,
    })
  })

  it('strips a client-supplied X-Schlussel-Frontend header before proxying', async () => {
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      resolve(process.cwd(), 'vite.config.ts'),
    )
    const authProxy = loaded?.config.server?.proxy?.['/auth']
    if (!authProxy || typeof authProxy === 'string') throw new Error('Expected /auth proxy options')

    const on = vi.fn()
    authProxy.configure?.({ on } as never, authProxy)
    const listener = on.mock.calls.find(([event]) => event === 'proxyReq')?.[1] as
      | ((request: { removeHeader: (name: string) => void }) => void)
      | undefined
    expect(listener).toBeTypeOf('function')

    const headers = new Map([['x-schlussel-frontend', 'forged']])
    listener?.({ removeHeader: (name) => headers.delete(name.toLowerCase()) })
    expect(headers.has('x-schlussel-frontend')).toBe(false)
  })
})
