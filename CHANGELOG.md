# Changelog

Brief log of notable changes, grouped by theme — not a full commit history
(see `git log` for that). New entries get appended under the section they
fit best; add a new section if none fits.

## Auth
- Logged-in/out header state via silent token refresh, redirect to
  schlussel's hosted login and back.
- The home page now requires authentication - unauthenticated visitors
  redirect straight to schlussel's login instead of seeing any content.
- Adopted Authorization Code + PKCE for the login handoff: generates and
  stores a PKCE verifier before redirecting, and the callback page
  exchanges the returned code for the real token via POST /auth/token
  instead of reading it from the URL fragment.
- Restore the stored theme before first paint (a synchronous inline
  script in index.html's `<head>`, matching schlussel/web and kuvert)
  instead of only after HomePage's first render, and render a themed
  blank div in AuthCallbackPage instead of nothing - reduces the flash
  during the SSO silent-reauth redirect chain, which can load and unload
  this page within a fraction of a second.

## Infrastructure
- CI (tests + lint) on every push/PR.
- Docker Compose networking on a shared `schloss-net`.
- Migrated from nginx to Caddy in the web image.
- Docker images published to GHCR on merge to `main`.
- Dependabot for both npm and GitHub Actions dependencies.
- Dropped published host port - reached only through the tor gateway now.
- Fixed docker-compose.yml's default `VITE_KUVERT_URL`/`VITE_SCHLUSSEL_URL`
  to `https://` - tor's gateway auto-upgrades everything to HTTPS, so the
  old `http://` defaults sent visitors to the wrong redirect target.
- Fixed a stale `http://` mention of the gateway URL in README.md.
- Pinned `pnpm/action-setup`'s version exactly in CI - letting it
  self-update to the latest 11.x broke every workflow run once pnpm
  11.12.0 shipped with a bug in its own self-installer, unrelated to
  any change in this repo.
- Security audit finding: the `/auth/*` proxy to schlussel forwarded a
  client-supplied `X-Schlussel-Frontend` header unchanged - that header
  is schlussel's own signal for "this request is genuinely same-origin to
  my own hosted frontend," and only schlussel-web's own Caddyfile is
  supposed to ever set it. Now stripped (`header_up -X-Schlussel-Frontend`)
  before proxying, so it can only ever be absent through this path.
- Bumped the vendored `schloss-ui` submodule pointer to pick up
  `ThemeToggle`'s dropdown-positioning fix (schloss-ui#59/#60) - routine
  sync, no behavior change reported for schloss's own header.
- The selected theme didn't carry over to/from schlussel and kuvert -
  each is a separate origin, so `localStorage` isn't shared. Mounted the
  new `ThemeSync` component (schloss-ui#61) pointed at schlussel's
  `/theme-sync.html` hub.
- The sync above didn't actually work - a freshly-visited origin's own
  default-theme timestamp could outrank a real pick made moments earlier
  on another origin. Bumped `schloss-ui` again for the fix
  (schloss-ui#64).
- The sync still didn't actually work even after that, for a bigger
  reason: the hidden-iframe design's own storage was partitioned by
  Firefox/Safari per embedding site, so it could never sync anything
  regardless of application logic. Replaced with `ThemeSync` talking
  directly to a real API (`GET`/`PUT` schlussel's `/theme`) via plain
  `fetch` - `hubOrigin` prop renamed `apiOrigin`, no more hidden iframe.
  Bumped `schloss-ui` again.

## Docs
- README, AGPL-3.0 LICENSE, CONTRIBUTING.md.
- Improved the browser tab title.
- Added CODE_OF_CONDUCT.md, SECURITY.md, issue templates, and a pull
  request template.
- Added a `/help` page: a plain-language usage guide for regular
  end users (how to sign in, read the service cards, find account
  settings, switch theme), linked from the Footer's new help link.
  Text skeleton only for now, with screenshot slots at
  `public/guide/schloss-*.png` for the user to fill in later.
- Fixed the `/help` page's "Первые шаги" numbered list rendering with no
  visible `1./2./3.` markers - just unexplained indentation. Tailwind's
  preflight base styles reset `ol`/`ul` to `list-style: none`; the page's
  own inline style set the indent (`paddingLeft`) but never restored a
  `list-style-type`. Added `listStyleType: 'decimal'` explicitly.

## Polish
- Homepage visual polish: hero illustration, a three-tile highlights strip,
  a GitHub link in the footer, smoother card hover easing.
- Extracted Header/Footer out of HomePage.tsx into their own components
  (`src/components/Header.tsx`, `Footer.tsx`) - same visuals, now the
  reference structure the other two services' header/footer work copies.
  Also stopped caching `/favicon.svg` as `immutable` for a year - the
  Caddyfile's cache rule now only matches Vite's hashed `/assets/*`
  output, not root-level static files that never change filename.
- Replaced the homepage hero illustration - an 8-bit indexed-color raster
  PNG that looked washed out/banded at display size - with a crisp inline
  SVG castle (`src/components/HeroIllustration.tsx`), in the existing
  brand palette. Also redrew `favicon.svg`: the old mark was an abstract
  gradient-blob silhouette that read as a generic lightning bolt at a
  glance; replaced with a padlock matching the header logo's shape.
- License/CI badges, a link to the Hof meta-repo, fixed gateway repo URL
  casing after its rename to lowercase.
- Wrote the gateway's project name lowercase ("tor") everywhere in prose.
- Adopted `@zudar107/schloss-ui`: replaced the local Header/Footer
  components and ThemeToggle's hand-styled button with the shared
  package's Header/Footer/Button/Badge, and swapped the hand-copied
  design tokens for the package's `tokens.css`, layering schloss's own
  purple accent on top so the header UI and favicon logo share one
  brand color. Also fixed the favicon's stroke width (2.4 -> 2) to
  match the shared icon-size/stroke rules.
- Added an "Updated docs" line to the PR checklist template, matching
  the same addition across the platform's other repos.
