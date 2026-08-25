import type { SegmentedControlOption } from '@zudar107/schloss-ui'
import type { HistoryRange } from '../hooks/useServerStats'

// Shared by both server-stats detail pages (host metrics and one
// container's own) - same three tiers wachter's own history endpoints
// support (see wachter's lib/tieredHistory.ts).
export const HISTORY_RANGE_OPTIONS: SegmentedControlOption<HistoryRange>[] = [
  { value: 'hour', label: 'Час' },
  { value: 'day', label: 'Сутки' },
  { value: 'week', label: 'Неделя' },
]
