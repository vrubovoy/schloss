import { parseRuntimeConfig } from './runtimeConfig'

describe('parseRuntimeConfig', () => {
  it('uses localhost defaults only for missing or blank URL fields', () => {
    expect(parseRuntimeConfig({ schemaVersion: 1, kuvertUrl: '  ' })).toEqual({
      schemaVersion: 1,
      kuvertUrl: 'http://localhost:5174',
      tafelUrl: 'http://localhost:5175',
      zettelUrl: 'http://localhost:5176',
      glockeUrl: 'http://localhost:5177',
      schrankUrl: 'http://localhost:5178',
      heroldUrl: 'http://localhost:5179',
      schlusselUrl: 'http://localhost:4001',
    })
  })

  it('accepts HTTP(S) origins and normalizes them', () => {
    const config = parseRuntimeConfig({
      schemaVersion: 1,
      kuvertUrl: 'https://KUVERT.example.test:443/',
      tafelUrl: 'http://tafel.example.test:80',
    })

    expect(config.kuvertUrl).toBe('https://kuvert.example.test')
    expect(config.tafelUrl).toBe('http://tafel.example.test')
  })

  it.each([
    ['non-string', null],
    ['unsupported protocol', 'javascript:alert(1)'],
    ['credentials', 'https://user:secret@example.test'],
    ['path', 'https://example.test/app'],
    ['query', 'https://example.test?tenant=one'],
    ['empty query', 'https://example.test?'],
    ['hash', 'https://example.test/#section'],
  ])('rejects an explicitly supplied malformed %s value', (_label, kuvertUrl) => {
    expect(() => parseRuntimeConfig({ schemaVersion: 1, kuvertUrl })).toThrow(/kuvertUrl/)
  })

  it('rejects unknown schema versions', () => {
    expect(() => parseRuntimeConfig({ schemaVersion: 2 })).toThrow(/schemaVersion/)
  })
})
