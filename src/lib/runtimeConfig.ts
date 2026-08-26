export interface RuntimeConfig {
  schemaVersion: 1
  kuvertUrl: string
  tafelUrl: string
  zettelUrl: string
  glockeUrl: string
  schrankUrl: string
  heroldUrl: string
  schlusselUrl: string
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
}

type UrlField = Exclude<keyof RuntimeConfig, 'schemaVersion'>

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
  }
}

export const runtimeConfig = parseRuntimeConfig(window.__HOF_CONFIG__)
