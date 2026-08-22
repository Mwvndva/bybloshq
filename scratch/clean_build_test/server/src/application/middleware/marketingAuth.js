/**
 * marketingAuth.js
 * Lightweight middleware that validates marketing JWT tokens.
 * Marketing tokens have role='marketing' — they grant read-only dashboard access.
 */
import { protect, restrictTo } from './auth.js'

/**
 * protectMarketing
 * Deprecated middleware alias that delegates to unified protect + restrictTo.
 */
export const protectMarketing = [
    protect,
    restrictTo('marketing', 'admin')
]
