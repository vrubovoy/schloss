import { pluralizeRu } from './pluralize'

const ONE = 'файл'
const FEW = 'файла'
const MANY = 'файлов'

function p(n: number): string {
  return pluralizeRu(n, ONE, FEW, MANY)
}

describe('pluralizeRu', () => {
  it.each([1, 21, 31, 41, 101, 121])('uses the "one" form for %i', (n) => {
    expect(p(n)).toBe(ONE)
  })

  it.each([2, 3, 4, 22, 23, 24, 32, 33, 34])('uses the "few" form for %i', (n) => {
    expect(p(n)).toBe(FEW)
  })

  it.each([0, 5, 6, 10, 20, 25, 26, 30, 100])('uses the "many" form for %i', (n) => {
    expect(p(n)).toBe(MANY)
  })

  it.each([11, 12, 13, 14])('uses the "many" form for the 11-14 exception: %i', (n) => {
    expect(p(n)).toBe(MANY)
  })

  it.each([111, 112, 113, 114])('uses the "many" form for the 11-14 exception repeated in higher hundreds: %i', (n) => {
    expect(p(n)).toBe(MANY)
  })
})
