// The five DIENSTE-card services, plus glocke - which has no card of its
// own (reached via the header bell instead, see src/lib/glocke.ts), so its
// flag gates the bell's visibility, not a launcher card. schlussel is
// mandatory core and has neither.
export interface OptionalServices {
  kuvert: boolean
  tafel: boolean
  zettel: boolean
  schrank: boolean
  herold: boolean
  glocke: boolean
  wachter: boolean
}

export interface RuntimeConfig {
  schemaVersion: 1
  kuvertUrl: string
  tafelUrl: string
  zettelUrl: string
  glockeUrl: string
  schrankUrl: string
  heroldUrl: string
  schlusselUrl: string
  services: OptionalServices
}

const DEFAULTS: RuntimeConfig = {
  schemaVersion: 1,
  kuvertUrl: 'http://localhost:5174',
  tafelUrl: 'http://localhost:5175',
  zettelUrl: 'http://localhost:5176',
  glockeUrl: 'http://localhost:5177',
  schrankUrl: 'http://localhost:5178',
  heroldUrl: 'http://localhost:5179',
  schlusselUrl: 'http://localhost:4001',
  services: { kuvert: true, tafel: true, zettel: true, schrank: true, herold: true, glocke: true, wachter: false },
}

type UrlField = Exclude<keyof RuntimeConfig, 'schemaVersion' | 'services'>

function parseOrigin(field: UrlField, value: unknown): string {
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return DEFAULTS[field]
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid runtime config ${field}: expected an HTTP(S) origin`)
  }

  const input = value.trim()
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error(`Invalid runtime config ${field}: expected an HTTP(S) origin`)
  }

  const authorityMatch = input.match(/^https?:\/\/[^/?#]+(.*)$/i)
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:')
    || url.username !== ''
    || url.password !== ''
    || url.pathname !== '/'
    || url.search !== ''
    || url.hash !== ''
    || (authorityMatch?.[1] !== '' && authorityMatch?.[1] !== '/')
  ) {
    throw new Error(`Invalid runtime config ${field}: expected an HTTP(S) origin`)
  }

  return url.origin
}

// Missing or non-boolean per-service flags default to enabled (true) - a
// deployment that hasn't started emitting `services` yet (or a hand-edited
// config.js) should keep showing every card, matching the platform's
// behavior before this field existed, rather than hiding services nobody
// asked to disable.
function parseServices(value: unknown): OptionalServices {
  const source = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const flag = (name: keyof OptionalServices, fallback = true): boolean => {
    const raw = source[name]
    return typeof raw === 'boolean' ? raw : fallback
  }
  return {
    kuvert: flag('kuvert'),
    tafel: flag('tafel'),
    zettel: flag('zettel'),
    schrank: flag('schrank'),
    herold: flag('herold'),
    glocke: flag('glocke'),
    wachter: flag('wachter', false),
  }
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid runtime config: expected an object')
  }

  const source = value as Record<string, unknown>
  if (source.schemaVersion !== 1) {
    throw new Error('Unsupported runtime config schemaVersion')
  }

  return {
    schemaVersion: 1,
    kuvertUrl: parseOrigin('kuvertUrl', source.kuvertUrl),
    tafelUrl: parseOrigin('tafelUrl', source.tafelUrl),
    zettelUrl: parseOrigin('zettelUrl', source.zettelUrl),
    glockeUrl: parseOrigin('glockeUrl', source.glockeUrl),
    schrankUrl: parseOrigin('schrankUrl', source.schrankUrl),
    heroldUrl: parseOrigin('heroldUrl', source.heroldUrl),
    schlusselUrl: parseOrigin('schlusselUrl', source.schlusselUrl),
    services: parseServices(source.services),
  }
}

export const runtimeConfig = parseRuntimeConfig(window.__HOF_CONFIG__)
