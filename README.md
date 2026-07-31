# Schloss

[![Test](https://github.com/zudaR107/schloss/actions/workflows/test.yml/badge.svg)](https://github.com/zudaR107/schloss/actions/workflows/test.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

Part of the [Hof platform](https://github.com/zudaR107/Hof) — a suite of
self-hosted personal services:

- **`schloss`** (this repo) — home page / launcher
- [`schlussel`](https://github.com/zudaR107/schlussel) — auth: accounts, login, tokens
- [`kuvert`](https://github.com/zudaR107/kuvert) — envelope budgeting
- [`tafel`](https://github.com/zudaR107/tafel) — task/project tracking
- [`tor`](https://github.com/zudaR107/tor) — reverse-proxy gateway
- [`schloss-ui`](https://github.com/zudaR107/schloss-ui) — shared frontend components
- [`schloss-server-kit`](https://github.com/zudaR107/schloss-server-kit) — shared backend auth/CORS kit

Schloss ("castle" / "lock" in German) is the home page and launcher for this suite of
self-hosted personal services. It's the first thing you see: it shows which services are
available and, once you're signed in, a bit of personalization. The home page requires
being signed in — an unauthenticated visitor is redirected straight to Schlüssel's
hosted login page and back, after which the header shows your name and a logout option.

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

See `.env.example`. `VITE_KUVERT_URL` and `VITE_SCHLUSSEL_URL` are read at *build* time
(Vite bakes them into the bundle) — they're where the Kuvert service card links to and
where the "Войти" button redirects, respectively. `KUVERT_URL` / `SCHLUSSEL_WEB_URL` are
the same values, but as the Docker build args `docker-compose.yml` passes through.

## Running with Docker

```sh
docker network create schloss-net   # one-time, shared with the other repos
docker compose up -d
```

Does not publish a host port — reached through the
[tor](https://github.com/zudaR107/tor) gateway (`https://localhost` in local dev - tor's
Caddy auto-upgrades everything to HTTPS with its own locally-trusted CA), on the same
`schloss-net` network as `schlussel` and `kuvert` so it can reach both by hostname.

## License

AGPL-3.0 — see [LICENSE](LICENSE).
