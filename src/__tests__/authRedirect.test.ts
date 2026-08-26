import { buildSchluesselLoginUrl, buildSchluesselLogoutUrl, CODE_VERIFIER_STORAGE_KEY } from '../lib/authRedirect'

/**
 * Computes the expected URL directly from the behavioral spec:
 *
 *   base = {runtimeConfig.schlusselUrl}
 *   returnTo = `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`
 *   result = `${base}/login?return_to=${encodeURIComponent(returnTo)}&code_challenge=...&code_challenge_method=S256`
 *
 * Since code_challenge is random per call, tests that need an exact string
 * match strip/ignore the PKCE params and assert on the return_to portion,
 * or assert the PKCE params separately via shape checks.
 */
function expectedReturnToParam(origin: string, currentPath: string): string {
  const returnTo = `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`
  return `return_to=${encodeURIComponent(returnTo)}`
}

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/

describe('buildSchluesselLoginUrl', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    window.__HOF_CONFIG__.schlusselUrl = 'http://localhost:4001'
    sessionStorage.clear()
  })

  it('uses the localhost runtime default', async () => {
    const result = await buildSchluesselLoginUrl('/dashboard')
    expect(result.startsWith('http://localhost:4001/login?')).toBe(true)
    expect(result).toContain(expectedReturnToParam(window.location.origin, '/dashboard'))
  })

  it('uses window.location.origin as the default origin when the second arg is omitted', async () => {
    const result = await buildSchluesselLoginUrl('/settings')
    const returnTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings')}`
    expect(result).toContain(encodeURIComponent(returnTo))
  })

  it('uses the explicitly-provided origin instead of window.location.origin when given', async () => {
    const result = await buildSchluesselLoginUrl('/settings', 'https://custom.example.org')
    expect(result).toContain(expectedReturnToParam('https://custom.example.org', '/settings'))

    // Must differ from the default-origin call since the origins differ.
    const other = await buildSchluesselLoginUrl('/settings')
    expect(result).not.toBe(other)
  })

  it('reads schlusselUrl from runtime config', async () => {
    window.__HOF_CONFIG__.schlusselUrl = 'https://schluessel.example.com'
    vi.resetModules()
    const { buildSchluesselLoginUrl: buildConfiguredLoginUrl } = await import('../lib/authRedirect')
    const result = await buildConfiguredLoginUrl('/', 'https://app.example.com')
    expect(result.startsWith('https://schluessel.example.com/login?')).toBe(true)
    expect(result).toContain(expectedReturnToParam('https://app.example.com', '/'))
  })

  it('url-encodes special characters in currentPath (query params, spaces, unicode)', async () => {
    const path = '/settings?tab=profile&x=1 2#frag'
    const result = await buildSchluesselLoginUrl(path, 'https://app.example.com')
    expect(result).toContain(expectedReturnToParam('https://app.example.com', path))
  })

  it('handles the root path "/"', async () => {
    const result = await buildSchluesselLoginUrl('/', 'https://app.example.com')
    expect(result).toContain(expectedReturnToParam('https://app.example.com', '/'))
  })

  it('handles an empty-string currentPath', async () => {
    const result = await buildSchluesselLoginUrl('', 'https://app.example.com')
    expect(result).toContain(expectedReturnToParam('https://app.example.com', ''))
  })

  it('double-encodes correctly: the inner next value is percent-encoded once, then the whole return_to is percent-encoded again', async () => {
    const path = '/a/b?c=d'
    const result = await buildSchluesselLoginUrl(path, 'https://app.example.com')

    // Reconstruct manually, step by step, and confirm the return_to portion matches exactly.
    const innerNext = encodeURIComponent(path) // "%2Fa%2Fb%3Fc%3Dd"
    const returnTo = `https://app.example.com/auth/callback?next=${innerNext}`
    const outerReturnTo = encodeURIComponent(returnTo)
    expect(result.startsWith(`http://localhost:4001/login?`)).toBe(true)
    expect(result).toContain(`return_to=${outerReturnTo}`)

    // Sanity check: the return_to value itself should not contain a literal,
    // unescaped '?' or '&' (they must all have been percent-encoded away).
    expect(outerReturnTo).not.toContain('?')
    expect(outerReturnTo).not.toContain('&')
  })

  it('produces a result containing "/login?" regardless of inputs', async () => {
    const result = await buildSchluesselLoginUrl('/anything', 'https://app.example.com')
    expect(result).toContain('/login?')
  })

  // -------------------------------------------------------------------------
  // PKCE behavior
  // -------------------------------------------------------------------------

  it('includes a code_challenge and code_challenge_method=S256 query param in the resolved URL', async () => {
    const result = await buildSchluesselLoginUrl('/dashboard', 'https://app.example.com')
    const url = new URL(result)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')

    const challenge = url.searchParams.get('code_challenge')
    expect(challenge).not.toBeNull()
    expect(challenge!.length).toBeGreaterThanOrEqual(40)
    expect(challenge).toMatch(BASE64URL_RE)
  })

  it('stores something in sessionStorage (the PKCE code_verifier) before resolving', async () => {
    expect(sessionStorage.length).toBe(0)
    await buildSchluesselLoginUrl('/dashboard', 'https://app.example.com')
    expect(sessionStorage.length).toBeGreaterThanOrEqual(1)

    // The stored value should look like a plausible verifier: a nonempty string.
    let foundPlausibleValue = false
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (!key) continue
      const value = sessionStorage.getItem(key)
      if (typeof value === 'string' && value.length > 0) {
        foundPlausibleValue = true
      }
    }
    expect(foundPlausibleValue).toBe(true)
  })

  it('generates a different code_challenge on each call (fresh random verifier every time)', async () => {
    const first = await buildSchluesselLoginUrl('/dashboard', 'https://app.example.com')
    const second = await buildSchluesselLoginUrl('/dashboard', 'https://app.example.com')

    const firstChallenge = new URL(first).searchParams.get('code_challenge')
    const secondChallenge = new URL(second).searchParams.get('code_challenge')

    expect(firstChallenge).not.toBeNull()
    expect(secondChallenge).not.toBeNull()
    expect(firstChallenge).not.toBe(secondChallenge)
  })
})

describe('buildSchluesselLogoutUrl', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    window.__HOF_CONFIG__.schlusselUrl = 'http://localhost:4001'
    sessionStorage.clear()
  })

  it('returns a URL using the configured schlussel origin', async () => {
    window.__HOF_CONFIG__.schlusselUrl = 'https://schluessel.example.com'
    vi.resetModules()
    const { buildSchluesselLogoutUrl: buildConfiguredLogoutUrl } = await import('../lib/authRedirect')
    const result = buildConfiguredLogoutUrl('https://app.example.com/')
    expect(result.startsWith('https://schluessel.example.com/logout?')).toBe(true)
  })

  it('uses the localhost runtime default', () => {
    const result = buildSchluesselLogoutUrl('https://app.example.com/')
    expect(result.startsWith('http://localhost:4001/logout?')).toBe(true)
  })

  it('appends return_to=<url-encoded returnTo> when an explicit returnTo is passed', () => {
    const returnTo = 'https://schloss.test/dashboard'
    const result = buildSchluesselLogoutUrl(returnTo)
    expect(result).toContain(`return_to=${encodeURIComponent(returnTo)}`)
  })

  it('defaults returnTo to `${window.location.origin}/` when omitted', () => {
    const result = buildSchluesselLogoutUrl()
    const expectedReturnTo = `${window.location.origin}/`
    expect(result).toContain(`return_to=${encodeURIComponent(expectedReturnTo)}`)
  })

  it('does not touch sessionStorage or generate any PKCE verifier/challenge', () => {
    expect(sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.length).toBe(0)

    buildSchluesselLogoutUrl('https://app.example.com/')

    expect(sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('is synchronous and does not return a Promise', () => {
    const result = buildSchluesselLogoutUrl('https://app.example.com/')
    expect(typeof result).toBe('string')
    expect(result).not.toBeInstanceOf(Promise)
  })
})
