import { normalizeNotificationOrigin } from '@zudar107/schloss-ui'

const configuredOrigin = (import.meta.env as Record<string, string>)['VITE_GLOCKE_URL'] ?? 'http://localhost:5177'

export const GLOCKE_ORIGIN = normalizeNotificationOrigin(configuredOrigin)
export const GLOCKE_NOTIFICATIONS_HREF = GLOCKE_ORIGIN ? `${GLOCKE_ORIGIN}/notifications` : null
