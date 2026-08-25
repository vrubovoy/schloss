import { formatUptime } from './format'

describe('formatUptime', () => {
  it('formats a seconds-only input as minutes', () => {
    expect(formatUptime(125)).toBe('2м')
  })

  it('formats an hours+minutes input', () => {
    // 3665s = 1h 1m 5s
    expect(formatUptime(3665)).toBe('1ч 1м')
  })

  it('formats a days+hours input', () => {
    // 90000s = 1d 1h
    expect(formatUptime(90000)).toBe('1д 1ч')
  })

  it('formats zero as "0м"', () => {
    expect(formatUptime(0)).toBe('0м')
  })

  it('formats exactly 60 seconds as "1м"', () => {
    expect(formatUptime(60)).toBe('1м')
  })

  it('formats exactly 3600 seconds as "1ч 0м"', () => {
    expect(formatUptime(3600)).toBe('1ч 0м')
  })

  it('formats exactly 86400 seconds as "1д 0ч"', () => {
    expect(formatUptime(86400)).toBe('1д 0ч')
  })
})
