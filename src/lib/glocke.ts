import { runtimeConfig } from './runtimeConfig'

export const GLOCKE_ENABLED = runtimeConfig.services.glocke
export const GLOCKE_ORIGIN = runtimeConfig.glockeUrl
export const GLOCKE_NOTIFICATIONS_HREF = `${GLOCKE_ORIGIN}/notifications`
