import { Sparkline } from '@zudar107/schloss-ui'
import { downsample } from '../lib/downsample'

export interface MetricCardProps {
  title: string
  current: number
  history: number[] | null
  error: boolean
}

// Shared by the server-stats overview page (one card per host metric) and
// the per-container detail page (one card each for CPU/memory) - same
// "big number + graph + min/max" shape either way, just a different data
// source. Downsampled here rather than by the caller so both call sites
// get a readable chart regardless of how many raw samples the backend
// retains (up to an hour at 5s resolution = 720 points).
export function MetricCard({ title, current, history, error }: MetricCardProps) {
  const points = history ? downsample(history, 120) : []
  const min = points.length ? Math.min(...points) : 0
  const max = points.length ? Math.max(...points) : 0

  return (
    <section className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
        <span style={{ fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
          {Math.round(current)}%
        </span>
      </div>
      {points.length > 1 ? (
        <>
          <Sparkline values={points} height={72} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>мин {Math.round(min)}%</span>
            <span>макс {Math.round(max)}%</span>
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {error ? 'Не удалось загрузить историю' : 'Накопление данных…'}
        </p>
      )}
    </section>
  )
}
