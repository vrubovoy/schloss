FROM node:22-alpine AS builder

# Pinned exactly, matching CI - "pnpm@latest" pulled whatever pnpm
# published most recently, which broke the build outright once (a
# self-installer bug in 11.12.0), unrelated to any change in this repo.
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
WORKDIR /app

# pnpm runs a deps-status check before any "run"/"exec" script (e.g.
# the "pnpm build" below) and, on a mismatch, tries to reinstall -
# which needs interactive confirmation to purge node_modules, and a
# Docker build has no TTY to give it. GitHub Actions sets CI=true for
# every workflow automatically (which is why this never showed up
# there), so it must be set explicitly here.
ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY schloss-ui/package.json ./schloss-ui/

# schloss-ui is a git submodule, linked via pnpm's workspace:* protocol
# - no registry involved, so no auth needed. Unfiltered, so this also
# installs schloss-ui's own devDependencies (tsup etc.), needed below
# to build it - it's no longer pre-built by a separate publish step.
RUN pnpm install --frozen-lockfile

COPY . .

# schloss-ui is still consumed as its built dist/ output (same as when
# it was a registry package), so it needs building here before schloss
# imports it.
RUN pnpm --filter @zudar107/schloss-ui build

RUN pnpm build

# ---

FROM caddy:2-alpine AS runner

RUN apk add --no-cache jq \
    && setcap -r /usr/bin/caddy \
    && addgroup -S -g 10001 caddy-app \
    && adduser -S -D -H -u 10001 -G caddy-app caddy-app \
    && mkdir -p /config \
    && chown caddy-app:caddy-app /config
COPY --from=builder --chown=caddy-app:caddy-app /app/dist /srv
COPY --chown=caddy-app:caddy-app Caddyfile /etc/caddy/Caddyfile
COPY --chmod=755 --chown=caddy-app:caddy-app docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 80
USER caddy-app
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
