/**
 * marketing.routes.js
 * All routes are read-only. No writes happen in this router.
 */
import express from 'express'
import { protectMarketing } from '../middleware/marketingAuth.js'
import {
    marketingLogin,
    getOverview,
    getGmvTrend,
    getUserGrowth,
    getProductMix,
    getOrderFunnel,
    getGeography,
    getTopPerformers,
    getReferralPerformance,
    getRecentActivity
} from '../controllers/marketing.controller.js'

const router = express.Router()

// Public: login only
router.post('/login', marketingLogin)

// All remaining routes require marketing JWT
router.use(protectMarketing)

router.get('/overview', getOverview)
router.get('/gmv-trend', getGmvTrend)
router.get('/user-growth', getUserGrowth)
router.get('/product-mix', getProductMix)
router.get('/order-funnel', getOrderFunnel)
router.get('/geography', getGeography)
router.get('/top-performers', getTopPerformers)
router.get('/referrals', getReferralPerformance)
router.get('/activity', getRecentActivity)

export default router
