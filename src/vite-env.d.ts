/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface Window {
  __HOF_CONFIG__: {
    schemaVersion: 1
    kuvertUrl?: unknown
    tafelUrl?: unknown
    zettelUrl?: unknown
    glockeUrl?: unknown
    schrankUrl?: unknown
    heroldUrl?: unknown
    schlusselUrl?: unknown
  }
}
