// Schloss has no login form of its own — signing in sends the browser to
// schlussel's hosted login page via a full navigation. schlussel redirects
// back to return_to with a one-time authorization code (PKCE) once the
// user has signed in; /auth/callback exchanges it for the real token, so
// the token itself never travels through a URL.
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { runtimeConfig } from './runtimeConfig'

export const CODE_VERIFIER_STORAGE_KEY = 'pkce_code_verifier'

export async function buildSchluesselLoginUrl(currentPath: string, origin: string = window.location.origin): Promise<string> {
  const schluesselUrl = runtimeConfig.schlusselUrl
  const returnTo = `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`

  const verifier = generateCodeVerifier()
  sessionStorage.setItem(CODE_VERIFIER_STORAGE_KEY, verifier)
  const challenge = await generateCodeChallenge(verifier)

  const params = new URLSearchParams({
    return_to: returnTo,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${schluesselUrl}/login?${params.toString()}`
}

// The session cookie is host-only to schlussel's own origin (no Domain
// attribute, by design - it's never shared cross-subdomain), so schloss
// can never clear it itself via a fetch proxied through its own origin -
// that request is same-origin from the browser's point of view (schloss's,
// not schlussel's), and the cookie simply never gets sent. Instead this
// sends the browser to a real page hosted by schlussel (same-origin with
// the cookie there), which does the actual logout and bounces back to
// returnTo.
export function buildSchluesselLogoutUrl(returnTo: string = `${window.location.origin}/`): string {
  const schluesselUrl = runtimeConfig.schlusselUrl
  return `${schluesselUrl}/logout?return_to=${encodeURIComponent(returnTo)}`
}

// Account settings (password, delete account, ...) are unified across the
// whole platform, not a per-service concept - schloss has no account page
// of its own, same reasoning as having no login page of its own. The
// header's settings button sends the browser to schlussel's hosted
// account page instead of a local route; return_to lets that page offer
// a "back to schloss" link once the visitor is done. No PKCE needed here
// (unlike login) - this is a plain link, not a redirect that has to hand
// a token back across the origin boundary.
export function buildSchluesselAccountUrl(currentPath: string, origin: string = window.location.origin): string {
  const schluesselUrl = runtimeConfig.schlusselUrl
  const returnTo = `${origin}${currentPath}`
  return `${schluesselUrl}/account?return_to=${encodeURIComponent(returnTo)}`
}
