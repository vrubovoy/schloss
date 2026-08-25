import { downsample } from './downsample'

describe('downsample', () => {
  it('returns the input unchanged when it already has fewer points than maxPoints', () => {
    const values = [1, 2, 3]
    expect(downsample(values, 10)).toBe(values)
  })

  it('returns the input unchanged when it has exactly maxPoints points', () => {
    const values = [1, 2, 3, 4]
    expect(downsample(values, 4)).toBe(values)
  })

  it('reduces a longer array to exactly maxPoints entries', () => {
    const values = Array.from({ length: 100 }, (_, i) => i)
    expect(downsample(values, 12)).toHaveLength(12)
  })

  it('averages each bucket, evenly-sized buckets', () => {
    // 6 values into 3 buckets of 2: [1,2] [3,4] [5,6]
    expect(downsample([1, 2, 3, 4, 5, 6], 3)).toEqual([1.5, 3.5, 5.5])
  })

  it('averages each bucket, unevenly-sized buckets', () => {
    // bucketSize = 2.5: bucket 0 = indices [0,2) = [10,20], bucket 1 = indices [2,5) = [30,40,50]
    expect(downsample([10, 20, 30, 40, 50], 2)).toEqual([15, 40])
  })

  it('returns the input unchanged when maxPoints is 0', () => {
    const values = [1, 2, 3, 4, 5]
    expect(downsample(values, 0)).toBe(values)
  })

  it('returns the input unchanged when maxPoints is negative', () => {
    const values = [1, 2, 3, 4, 5]
    expect(downsample(values, -3)).toBe(values)
  })

  it('leaves a single-element input unchanged', () => {
    const values = [42]
    expect(downsample(values, 120)).toBe(values)
  })

  it('leaves an empty input unchanged', () => {
    const values: number[] = []
    expect(downsample(values, 120)).toEqual([])
  })
})
