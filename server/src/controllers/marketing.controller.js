/**
 * marketing.controller.js
 * Read-only analytics endpoints for the marketing admin dashboard.
 * All queries are optimised for read performance — no writes happen here.
 */
import * as marketingAnalyticsRepository from '../repositories/marketingAnalytics.repository.js'
import { AppError } from '../shared/utils/errorHandler.js'
import logger from '../shared/utils/logger.js'
import AuthService from '../services/auth.service.js'

// ─── AUTH ────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/marketing/login
 * Separate login for marketing admin — does NOT use the main admin cookie.
 * Returns a JWT in the response body (marketing dashboard reads it from localStorage).
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

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: { id: user.id, email: user.email, role: 'marketing' }
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

    // Calculate derived metrics
    const cancellationRate = d.total_orders > 0
      ? ((d.cancelled_orders / d.total_orders) * 100).toFixed(1)
      : '0.0'

    const avgOrderValue = d.completed_orders > 0
      ? (d.total_gmv / d.completed_orders).toFixed(2)
      : '0.00'

    res.status(200).json({
      status: 'success',
      data: {
        totalSellers: Number.parseInt(d.total_sellers),
        totalBuyers: Number.parseInt(d.total_buyers),
        activeProducts: Number.parseInt(d.active_products),
        totalGmv: Number.parseFloat(d.total_gmv),
        totalRevenue: Number.parseFloat(d.total_revenue),
        completedOrders: Number.parseInt(d.completed_orders),
        cancelledOrders: Number.parseInt(d.cancelled_orders),
        totalOrders: Number.parseInt(d.total_orders),
        cancellationRate: Number.parseFloat(cancellationRate),
        avgOrderValue: Number.parseFloat(avgOrderValue),
        newSellersThisMonth: Number.parseInt(d.new_sellers_this_month),
        newBuyersThisMonth: Number.parseInt(d.new_buyers_this_month),
        gmvThisMonth: Number.parseFloat(d.gmv_this_month),
        totalWishlists: Number.parseInt(d.total_wishlists),
        totalRefunded: Number.parseFloat(d.total_refunded),
        totalReferralRewards: Number.parseFloat(d.total_referral_rewards),
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
        month: r.month,
        label: r.label,
        gmv: Number.parseFloat(r.gmv),
        revenue: Number.parseFloat(r.revenue),
        sellerPayouts: Number.parseFloat(r.seller_payouts),
        orderCount: Number.parseInt(r.order_count),
        avgOrderValue: Number.parseFloat(r.avg_order_value)
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
        month: r.month,
        label: r.label,
        newSellers: Number.parseInt(r.new_sellers),
        newBuyers: Number.parseInt(r.new_buyers)
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
 * Also returns aesthetic distribution.
 */
export const getProductMix = async (req, res, next) => {
  try {
    const [typeRows, aestheticRows] = await Promise.all([
      marketingAnalyticsRepository.findProductTypeMix(),
      marketingAnalyticsRepository.findAestheticMix()
    ])

    res.status(200).json({
      status: 'success',
      data: {
        productTypes: typeRows.map(r => ({
          type: r.product_type,
          count: Number.parseInt(r.count),
          totalRevenue: Number.parseFloat(r.total_revenue)
        })),
        aesthetics: aestheticRows.map(r => ({
          aesthetic: r.aesthetic,
          productCount: Number.parseInt(r.product_count)
        }))
      }
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
    const [rows, paymentRows] = await Promise.all([
      marketingAnalyticsRepository.findOrderStatusFunnel(),
      marketingAnalyticsRepository.findPaymentStatusFunnel()
    ])

    res.status(200).json({
      status: 'success',
      data: {
        orderStatuses: rows.map(r => ({
          status: r.status,
          count: Number.parseInt(r.count),
          totalValue: Number.parseFloat(r.total_value)
        })),
        paymentStatuses: paymentRows.map(r => ({
          status: r.payment_status,
          count: Number.parseInt(r.count),
          totalValue: Number.parseFloat(r.total_value)
        }))
      }
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
    const [buyerLocations, sellerLocations, gmvLocations] = await Promise.all([
      marketingAnalyticsRepository.findBuyerLocations(),
      marketingAnalyticsRepository.findSellerLocations(),
      marketingAnalyticsRepository.findGmvLocations()
    ])

    res.status(200).json({
      status: 'success',
      data: {
        topBuyerRegions: buyerLocations.map(r => ({ location: r.location, count: Number.parseInt(r.buyer_count) })),
        topSellerRegions: sellerLocations.map(r => ({ location: r.location, count: Number.parseInt(r.seller_count), gmv: Number.parseFloat(r.location_gmv) })),
        topGmvRegions: gmvLocations.map(r => ({ location: r.location, gmv: Number.parseFloat(r.gmv), orderCount: Number.parseInt(r.order_count) }))
      }
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
    const [topSellers, topProducts, topWishlisted] = await Promise.all([
      marketingAnalyticsRepository.findTopSellers(),
      marketingAnalyticsRepository.findTopProducts(),
      marketingAnalyticsRepository.findTopWishlisted()
    ])

    res.status(200).json({
      status: 'success',
      data: {
        topSellers: topSellers.map(r => ({
          id: r.id,
          shopName: r.shop_name,
          location: r.location,
          totalSales: Number.parseFloat(r.total_sales),
          clientCount: Number.parseInt(r.client_count),
          orderCount: Number.parseInt(r.order_count)
        })),
        topProducts: topProducts.map(r => ({
          id: r.id,
          name: r.name,
          productType: r.product_type,
          aesthetic: r.aesthetic,
          totalRevenue: Number.parseFloat(r.total_revenue),
          unitsSold: Number.parseInt(r.units_sold)
        })),
        topWishlisted: topWishlisted.map(r => ({
          id: r.id,
          name: r.name,
          productType: r.product_type,
          price: Number.parseFloat(r.price),
          wishlistCount: Number.parseInt(r.wishlist_count)
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
    const [monthlyRewards, topReferrers, referralStats] = await Promise.all([
      marketingAnalyticsRepository.findMonthlyReferralRewards(),
      marketingAnalyticsRepository.findTopReferrers(),
      marketingAnalyticsRepository.findReferralStats()
    ])

    res.status(200).json({
      status: 'success',
      data: {
        monthlyRewards: monthlyRewards.map(r => ({
          label: r.label,
          year: r.period_year,
          month: r.period_month,
          activeReferrers: Number.parseInt(r.active_referrers),
          referralPairs: Number.parseInt(r.referral_pairs),
          totalRewards: Number.parseFloat(r.total_rewards),
          referredGmv: Number.parseFloat(r.referred_gmv)
        })).reverse(),
        topReferrers: topReferrers.map(r => ({
          shopName: r.shop_name,
          location: r.location,
          referralsMade: Number.parseInt(r.referrals_made),
          totalEarned: Number.parseFloat(r.total_earned)
        })),
        sellersWithCodes: Number.parseInt(referralStats?.sellers_with_codes || 0),
        referredSellers: Number.parseInt(referralStats?.referred_sellers || 0)
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
      data: rows.map(r => ({
        type: r.type,
        timestamp: r.timestamp,
        description: r.description,
        value: r.value ? Number.parseFloat(r.value) : null
      }))
    })
  } catch (err) {
    next(err)
  }
}
