// Reduces a chronological series to at most maxPoints by averaging
// consecutive buckets - keeps an hour of 5s samples (up to 720 points)
// readable as a chart instead of hundreds of near-invisible slivers.
export function downsample(values: number[], maxPoints: number): number[] {
  if (maxPoints <= 0 || values.length <= maxPoints) return values

  const bucketSize = values.length / maxPoints
  const result: number[] = []
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * bucketSize)
    const end = Math.max(Math.floor((i + 1) * bucketSize), start + 1)
    const bucket = values.slice(start, end)
    result.push(bucket.reduce((sum, v) => sum + v, 0) / bucket.length)
  }
  return result
}
