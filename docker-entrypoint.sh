#!/bin/sh
set -eu

tmp="$(mktemp /config/config.js.XXXXXX)"
trap 'rm -f "$tmp"' EXIT HUP INT TERM

printf '%s' 'window.__HOF_CONFIG__ = ' > "$tmp"
jq -n \
  --arg kuvertUrl "${KUVERT_URL:-}" \
  --arg tafelUrl "${TAFEL_URL:-}" \
  --arg zettelUrl "${ZETTEL_URL:-}" \
  --arg glockeUrl "${GLOCKE_URL:-}" \
  --arg schrankUrl "${SCHRANK_URL:-}" \
  --arg heroldUrl "${HEROLD_URL:-}" \
  --arg schlusselUrl "${SCHLUSSEL_WEB_URL:-}" \
  --argjson kuvertEnabled "$([ -n "${KUVERT_URL:-}" ] && echo true || echo false)" \
  --argjson tafelEnabled "$([ -n "${TAFEL_URL:-}" ] && echo true || echo false)" \
  --argjson zettelEnabled "$([ -n "${ZETTEL_URL:-}" ] && echo true || echo false)" \
  --argjson schrankEnabled "$([ -n "${SCHRANK_URL:-}" ] && echo true || echo false)" \
  --argjson heroldEnabled "$([ -n "${HEROLD_URL:-}" ] && echo true || echo false)" \
  --argjson glockeEnabled "$([ -n "${GLOCKE_URL:-}" ] && echo true || echo false)" \
  --argjson wachterEnabled "$([ "${WACHTER_ENABLED:-false}" = true ] && echo true || echo false)" \
  '{
    schemaVersion: 1,
    kuvertUrl: $kuvertUrl,
    tafelUrl: $tafelUrl,
    zettelUrl: $zettelUrl,
    glockeUrl: $glockeUrl,
    schrankUrl: $schrankUrl,
    heroldUrl: $heroldUrl,
    schlusselUrl: $schlusselUrl,
    services: {
      kuvert: $kuvertEnabled,
      tafel: $tafelEnabled,
      zettel: $zettelEnabled,
      schrank: $schrankEnabled,
      herold: $heroldEnabled,
      glocke: $glockeEnabled,
      wachter: $wachterEnabled
    }
  }' >> "$tmp"
printf ';\n' >> "$tmp"
mv -f "$tmp" /config/config.js
trap - EXIT HUP INT TERM

exec "$@"
