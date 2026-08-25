export function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  if (days > 0) return `${days}д ${hours}ч`
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}ч ${minutes}м`
  return `${minutes}м`
}
