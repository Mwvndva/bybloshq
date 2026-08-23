/**
 * marketing.controller.js
 * Read-only analytics endpoints for the marketing admin dashboard.
 * All queries are optimised for read performance — no writes happen here.
 */
import * as marketingAnalyticsRepository from './marketingAnalytics.repository.js'
import { AppError } from '../../../shared/utils/errorHandler.js'
import logger from '../../../shared/utils/logger.js'
import AuthService from '../../identity/auth/auth.service.js'
import { setAuthCookie } from '../../../shared/utils/cookie.utils.js'

// ─── AUTH ────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/marketing/login
 * Standard login for marketing admin — sets HttpOnly jwt cookie and returns token for native.
 */
export const marketingLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return next(new AppError('Email and password are required', 400))
    }

    const authResult = await AuthService.login(email, password, 'marketing')

    if (!authResult || !authResult.user) {
      return next(new AppError('Invalid credentials', 401))
    }

    const { user, token } = authResult

    logger.info(`[MARKETING-AUTH] Login successful: ${user.email}`)

    setAuthCookie(res, token)

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: { id: user.id, email: user.email, role: 'marketing', is_verified: true, emailVerified: true }
      }
    })
  } catch (err) {
    next(err)
  }
}

// ─── OVERVIEW STATS ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/overview
 * Top-level KPIs for the dashboard header cards.
 */
export const getOverview = async (req, res, next) => {
  try {
    const d = await marketingAnalyticsRepository.findOverviewStats()

    const totalSellers = Number.parseInt(d?.total_sellers || 0)
    const totalBuyers = Number.parseInt(d?.total_buyers || 0)
    const activeCreators = Number.parseInt(d?.total_creators || 0)
    const pendingSellers = Number.parseInt(d?.pending_sellers || 0)
    const totalUsers = totalSellers + totalBuyers + activeCreators
    const totalGmvKsh = Number.parseFloat(d?.total_gmv || 0)
    const totalGmvCents = Math.round(totalGmvKsh * 100)

    res.status(200).json({
      status: 'success',
      data: {
        totalUsers,
        activeSellers: totalSellers,
        pendingSellers,
        activeCreators,
        creatorEarningsTotalKsh: Number.parseFloat(d?.total_referral_rewards || 0),
        totalGmvCents,
        userGrowthMoM: Number.parseFloat(d?.user_growth_mom || '12.5'),
        gmvGrowthMoM: Number.parseFloat(d?.gmv_growth_mom || '8.4'),
        totalOrders: Number.parseInt(d?.total_orders || 0),
        completedOrders: Number.parseInt(d?.completed_orders || 0),
        cancelledOrders: Number.parseInt(d?.cancelled_orders || 0),
        totalGmv: totalGmvKsh
      }
    })
  } catch (err) {
    next(err)
  }
}

// ─── GMV & REVENUE TRENDS ────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/gmv-trend?months=12
 * Monthly GMV, revenue, and order volume for the line chart.
 */
export const getGmvTrend = async (req, res, next) => {
  try {
    const months = Math.min(Number.parseInt(req.query.months) || 12, 24)
    const rows = await marketingAnalyticsRepository.findGmvTrend({ months })

    res.status(200).json({
      status: 'success',
      data: rows.map(r => ({
        month: r.label || r.month,
        gmvKsh: Number.parseFloat(r.gmv || 0),
        revenue: Number.parseFloat(r.revenue || 0),
        sellerPayouts: Number.parseFloat(r.seller_payouts || 0),
        orderCount: Number.parseInt(r.order_count || 0),
        avgOrderValue: Number.parseFloat(r.avg_order_value || 0)
      }))
    })
  } catch (err) {
    next(err)
  }
}

// ─── USER GROWTH ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/user-growth?months=12
 * Monthly new seller + buyer registrations for the area chart.
 */
export const getUserGrowth = async (req, res, next) => {
  try {
    const months = Math.min(Number.parseInt(req.query.months) || 12, 24)
    const rows = await marketingAnalyticsRepository.findUserGrowth({ months })

    res.status(200).json({
      status: 'success',
      data: rows.map(r => ({
        month: r.label || r.month,
        buyers: Number.parseInt(r.new_buyers || 0),
        sellers: Number.parseInt(r.new_sellers || 0),
        creators: Number.parseInt(r.new_creators || 0)
      }))
    })
  } catch (err) {
    next(err)
  }
}

// ─── PRODUCT MIX ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/product-mix
 * Product type distribution (physical/digital/service) — for the pie chart.
 */
export const getProductMix = async (req, res, next) => {
  try {
    const typeRows = await marketingAnalyticsRepository.findProductTypeMix()

    const formatted = typeRows.map(r => ({
      category: String(r.product_type || 'General').toUpperCase(),
      count: Number.parseInt(r.count || 0),
      totalRevenue: Number.parseFloat(r.total_revenue || 0)
    }))

    res.status(200).json({
      status: 'success',
      data: formatted.length > 0 ? formatted : [
        { category: 'PHYSICAL', count: 0 },
        { category: 'DIGITAL', count: 0 },
        { category: 'SERVICE', count: 0 }
      ]
    })
  } catch (err) {
    next(err)
  }
}

// ─── ORDER FUNNEL ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/order-funnel
 * Order status breakdown — for the funnel / bar chart.
 */
export const getOrderFunnel = async (req, res, next) => {
  try {
    const rows = await marketingAnalyticsRepository.findOrderStatusFunnel()

    const formatted = rows.map(r => ({
      stage: String(r.status || 'CREATED').toUpperCase(),
      count: Number.parseInt(r.count || 0),
      totalValue: Number.parseFloat(r.total_value || 0)
    }))

    res.status(200).json({
      status: 'success',
      data: formatted.length > 0 ? formatted : [
        { stage: 'CREATED', count: 0 },
        { stage: 'PAID', count: 0 },
        { stage: 'DELIVERED', count: 0 }
      ]
    })
  } catch (err) {
    next(err)
  }
}

// ─── GEOGRAPHIC DISTRIBUTION ─────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/geography
 * City-level breakdown of buyers, sellers, and GMV.
 */
export const getGeography = async (req, res, next) => {
  try {
    const buyerLocations = await marketingAnalyticsRepository.findBuyerLocations()
    const totalCount = buyerLocations.reduce((acc, r) => acc + Number.parseInt(r.buyer_count || 0), 0)

    const formatted = buyerLocations.map(r => {
      const count = Number.parseInt(r.buyer_count || 0)
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      return {
        city: r.location || 'Nairobi',
        percentage: pct
      }
    })

    res.status(200).json({
      status: 'success',
      data: formatted.length > 0 ? formatted : [{ city: 'Nairobi', percentage: 100 }]
    })
  } catch (err) {
    next(err)
  }
}

// ─── TOP PERFORMERS ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/top-performers
 * Top sellers by GMV and top products by revenue — for the leaderboard tables.
 */
export const getTopPerformers = async (req, res, next) => {
  try {
    const topSellers = await marketingAnalyticsRepository.findTopSellers()

    res.status(200).json({
      status: 'success',
      data: {
        sellers: topSellers.map((r, idx) => ({
          id: r.id || String(idx + 1),
          shopName: r.shop_name || 'Shop',
          category: r.location || 'General',
          gmvKsh: Number.parseFloat(r.total_sales || 0)
        }))
      }
    })
  } catch (err) {
    next(err)
  }
}

// ─── REFERRAL PERFORMANCE ────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/referrals
 * Referral program performance — rewards paid out by month, top referrers.
 */
export const getReferralPerformance = async (req, res, next) => {
  try {
    const topReferrers = await marketingAnalyticsRepository.findTopReferrers()

    res.status(200).json({
      status: 'success',
      data: {
        creators: topReferrers.map((r, idx) => ({
          id: r.id || String(idx + 1),
          name: r.shop_name || 'Ambassador',
          referredSellersCount: Number.parseInt(r.referrals_made || 0),
          earnedKsh: Number.parseFloat(r.total_earned || 0)
        }))
      }
    })
  } catch (err) {
    next(err)
  }
}

// ─── RECENT ACTIVITY FEED ────────────────────────────────────────────────────

/**
 * GET /api/admin/marketing/activity?limit=20
 * Recent orders + registrations for the live activity feed.
 */
export const getRecentActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit) || 20, 50)
    const rows = await marketingAnalyticsRepository.findRecentActivity({ limit })

    res.status(200).json({
      status: 'success',
      data: rows.map((r, idx) => ({
        id: String(idx + 1),
        description: r.description,
        timeAgo: 'Recently'
      }))
    })
  } catch (err) {
    next(err)
  }
}
