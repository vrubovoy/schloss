# Schloss

[![Test](https://github.com/zudaR107/schloss/actions/workflows/test.yml/badge.svg)](https://github.com/zudaR107/schloss/actions/workflows/test.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

Part of the [Hof platform](https://github.com/zudaR107/Hof) — a suite of
self-hosted personal services:

- **`schloss`** (this repo) — home page / launcher
- [`schlussel`](https://github.com/zudaR107/schlussel) — auth: accounts, login, tokens
- [`kuvert`](https://github.com/zudaR107/kuvert) — envelope budgeting
- [`tafel`](https://github.com/zudaR107/tafel) — task/project tracking
- [`zettel`](https://github.com/zudaR107/zettel) — markdown note-taking
- [`glocke`](https://github.com/zudaR107/glocke) — in-app notification center and delivery foundation
- [`schrank`](https://github.com/zudaR107/schrank) — file storage with nested folders
- [`herold`](https://github.com/zudaR107/herold) — webmail client for external IMAP/SMTP accounts
- [`wachter`](https://github.com/vrubovoy/wachter) — server resource monitoring
- [`tor`](https://github.com/zudaR107/tor) — reverse-proxy gateway
- [`schloss-ui`](https://github.com/zudaR107/schloss-ui) — shared frontend components
- [`schloss-server-kit`](https://github.com/zudaR107/schloss-server-kit) — shared backend auth/CORS kit

Schloss ("castle" / "lock" in German) is the home page and launcher for this suite of
self-hosted personal services. It renders a static, configured card for each platform
service; it does not discover services or probe whether they are currently available.
The home page requires being signed in: an unauthenticated visitor is automatically
redirected through Schlüssel's Authorization Code + PKCE flow and back. If the hosted
auth origin still has a session, that round trip silently reuses it; otherwise Schlüssel
shows the credentials form. Afterward the header shows your name, a logout option, and
the shared Glocke bell with the current unread-notification count. The bell links to
Glocke's `/notifications` page and is also available on Schloss's help page while signed in.
The configured launcher cards currently link to Kuvert, Tafel, Zettel, and Glocke, followed by a
non-clickable placeholder for future services.

For an admin, the home page also embeds a live server-stats widget -
CPU/memory/disk, uptime, and container status - reported by
[`wachter`](https://github.com/vrubovoy/wachter), reached same-origin at
`/wachter/*` via this repo's own Caddyfile. Wächter has no web app of
its own, so its full admin UI lives here too: `/server-stats` (graphs
over an hour/day/week), `/server-stats/:name` (one container's own
graphs plus a restart action), and `/server-stats/docs` (its Swagger
UI). Regular (non-admin) users never see any of it.
Retained readings are visibly marked stale after polling failures, degraded
sources are identified, and restart controls appear only for containers that
Wächter explicitly marks restartable and non-critical.

Schloss also mounts the shared `ThemeSync` client against Schlüssel's public `/theme`
API. Theme choices are reconciled across platform origins by their `updatedAt`
timestamps; the server-returned winner is adopted after both reads and writes, including
when a concurrent newer choice beats this page's write.

## Local development

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Runs on `http://localhost:3000`.

```sh
pnpm test
pnpm lint
```

### Environment variables

See `.env.example`. `VITE_KUVERT_URL`, `VITE_TAFEL_URL`, `VITE_ZETTEL_URL`,
`VITE_GLOCKE_URL`, and `VITE_SCHLUSSEL_URL` are read at *build* time (Vite bakes them into the bundle) — they're
where each static service card links to and where authentication/account/theme-sync
navigations and requests are sent, respectively. `VITE_GLOCKE_URL` also supplies the
trusted Glocke origin used by the authenticated header bell.
`KUVERT_URL` / `TAFEL_URL` / `ZETTEL_URL` / `GLOCKE_URL` / `SCHLUSSEL_WEB_URL` are the same values, but
as the Docker build args `docker-compose.yml` passes through. During `pnpm dev`, Vite
proxies same-origin `/auth` requests to `SCHLUSSEL_API_URL`, which defaults to
`http://localhost:4000`. Like the production Caddy proxy, it strips any client-supplied
`X-Schlussel-Frontend` trusted-origin header before forwarding the request.

## Running with Docker

```sh
docker network create schloss-net   # one-time, shared with the other repos
docker compose up -d
```

Does not publish a host port — reached through the
[tor](https://github.com/zudaR107/tor) gateway (`https://localhost` in local dev - tor's
Caddy auto-upgrades everything to HTTPS with its own locally-trusted CA), on the same
`schloss-net` network as `schlussel`, `kuvert`, `tafel`, `zettel`, and `glocke`.

## License

AGPL-3.0 — see [LICENSE](LICENSE).
