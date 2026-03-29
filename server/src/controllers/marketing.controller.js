/**
 * marketing.controller.js
 * Read-only analytics endpoints for the marketing admin dashboard.
 * All queries are optimised for read performance — no writes happen here.
 */
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../config/database.js'
import { AppError } from '../utils/errorHandler.js'
import logger from '../utils/logger.js'

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

    const MARKETING_EMAIL = 'adminmarketing@bybloshq.space'
    if (email.toLowerCase().trim() !== MARKETING_EMAIL) {
      return next(new AppError('Invalid credentials', 401))
    }

    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    const user = rows[0]
    if (!user || !user.is_active) {
      return next(new AppError('Invalid credentials', 401))
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return next(new AppError('Invalid credentials', 401))
    }

    // Issue a short-lived token specifically for the marketing dashboard
    const token = jwt.sign(
      { id: user.id, role: 'marketing', email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }  // 8-hour session — a working day
    )

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
    const { rows } = await pool.query(`
      SELECT
        -- Platform totals
        (SELECT COUNT(*)  FROM sellers WHERE is_active = true)                          AS total_sellers,
        (SELECT COUNT(*)  FROM buyers  WHERE user_id IS NOT NULL)                       AS total_buyers,
        (SELECT COUNT(*)  FROM products WHERE status = 'available')                     AS active_products,

        -- GMV and revenue
        (SELECT COALESCE(SUM(total_amount), 0)
           FROM product_orders WHERE payment_status = 'completed')                      AS total_gmv,
        (SELECT COALESCE(SUM(platform_fee_amount), 0)
           FROM product_orders WHERE payment_status = 'completed')                      AS total_revenue,

        -- Orders
        (SELECT COUNT(*) FROM product_orders WHERE payment_status = 'completed')        AS completed_orders,
        (SELECT COUNT(*) FROM product_orders WHERE status = 'CANCELLED')                AS cancelled_orders,
        (SELECT COUNT(*) FROM product_orders)                                           AS total_orders,

        -- This month snapshot
        (SELECT COUNT(*) FROM sellers
           WHERE created_at >= date_trunc('month', CURRENT_DATE))                       AS new_sellers_this_month,
        (SELECT COUNT(*) FROM buyers
           WHERE created_at >= date_trunc('month', CURRENT_DATE))                       AS new_buyers_this_month,
        (SELECT COALESCE(SUM(total_amount), 0) FROM product_orders
           WHERE payment_status = 'completed'
             AND paid_at >= date_trunc('month', CURRENT_DATE))                          AS gmv_this_month,

        -- Wishlist engagement
        (SELECT COUNT(*) FROM wishlists)                                                AS total_wishlists,

        -- Refund rate
        (SELECT COALESCE(SUM(amount), 0) FROM refund_requests WHERE status = 'completed') AS total_refunded,

        -- Referral rewards paid out
        (SELECT COALESCE(SUM(reward_amount), 0) FROM referral_earnings_log)            AS total_referral_rewards
    `)

    const d = rows[0]

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
        totalSellers: parseInt(d.total_sellers),
        totalBuyers: parseInt(d.total_buyers),
        activeProducts: parseInt(d.active_products),
        totalGmv: parseFloat(d.total_gmv),
        totalRevenue: parseFloat(d.total_revenue),
        completedOrders: parseInt(d.completed_orders),
        cancelledOrders: parseInt(d.cancelled_orders),
        totalOrders: parseInt(d.total_orders),
        cancellationRate: parseFloat(cancellationRate),
        avgOrderValue: parseFloat(avgOrderValue),
        newSellersThisMonth: parseInt(d.new_sellers_this_month),
        newBuyersThisMonth: parseInt(d.new_buyers_this_month),
        gmvThisMonth: parseFloat(d.gmv_this_month),
        totalWishlists: parseInt(d.total_wishlists),
        totalRefunded: parseFloat(d.total_refunded),
        totalReferralRewards: parseFloat(d.total_referral_rewards),
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
    const months = Math.min(parseInt(req.query.months) || 12, 24)

    const { rows } = await pool.query(`
      WITH month_series AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - (($1 - 1) || ' months')::interval,
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) AS month
      )
      SELECT
        TO_CHAR(ms.month, 'YYYY-MM')                                           AS month,
        TO_CHAR(ms.month, 'Mon YY')                                            AS label,
        COALESCE(SUM(o.total_amount), 0)                                       AS gmv,
        COALESCE(SUM(o.platform_fee_amount), 0)                                AS revenue,
        COALESCE(SUM(o.seller_payout_amount), 0)                               AS seller_payouts,
        COUNT(o.id)                                                            AS order_count,
        COALESCE(AVG(o.total_amount), 0)                                       AS avg_order_value
      FROM month_series ms
      LEFT JOIN product_orders o
        ON date_trunc('month', o.paid_at) = ms.month
        AND o.payment_status = 'completed'
      GROUP BY ms.month
      ORDER BY ms.month ASC
    `, [months])

    res.status(200).json({
      status: 'success',
      data: rows.map(r => ({
        month: r.month,
        label: r.label,
        gmv: parseFloat(r.gmv),
        revenue: parseFloat(r.revenue),
        sellerPayouts: parseFloat(r.seller_payouts),
        orderCount: parseInt(r.order_count),
        avgOrderValue: parseFloat(r.avg_order_value)
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
    const months = Math.min(parseInt(req.query.months) || 12, 24)

    const { rows } = await pool.query(`
      WITH month_series AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - (($1 - 1) || ' months')::interval,
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) AS month
      )
      SELECT
        TO_CHAR(ms.month, 'YYYY-MM')  AS month,
        TO_CHAR(ms.month, 'Mon YY')   AS label,
        COUNT(DISTINCT s.id)          AS new_sellers,
        COUNT(DISTINCT b.id)          AS new_buyers
      FROM month_series ms
      LEFT JOIN sellers s ON date_trunc('month', s.created_at) = ms.month
      LEFT JOIN buyers  b ON date_trunc('month', b.created_at) = ms.month
      GROUP BY ms.month
      ORDER BY ms.month ASC
    `, [months])

    res.status(200).json({
      status: 'success',
      data: rows.map(r => ({
        month: r.month,
        label: r.label,
        newSellers: parseInt(r.new_sellers),
        newBuyers: parseInt(r.new_buyers)
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
      pool.query(`
        SELECT
          product_type,
          COUNT(*) AS count,
          COALESCE(SUM(oi.subtotal), 0) AS total_revenue
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN product_orders po ON oi.order_id = po.id AND po.payment_status = 'completed'
        WHERE p.status = 'available' OR p.status = 'sold'
        GROUP BY product_type
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT
          COALESCE(aesthetic, 'uncategorised') AS aesthetic,
          COUNT(*) AS product_count
        FROM products
        GROUP BY aesthetic
        ORDER BY product_count DESC
        LIMIT 8
      `)
    ])

    res.status(200).json({
      status: 'success',
      data: {
        productTypes: typeRows.rows.map(r => ({
          type: r.product_type,
          count: parseInt(r.count),
          totalRevenue: parseFloat(r.total_revenue)
        })),
        aesthetics: aestheticRows.rows.map(r => ({
          aesthetic: r.aesthetic,
          productCount: parseInt(r.product_count)
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
    const { rows } = await pool.query(`
      SELECT
        status,
        COUNT(*) AS count,
        COALESCE(SUM(total_amount), 0) AS total_value
      FROM product_orders
      GROUP BY status
      ORDER BY count DESC
    `)

    // Also get payment status breakdown
    const { rows: paymentRows } = await pool.query(`
      SELECT
        payment_status,
        COUNT(*) AS count,
        COALESCE(SUM(total_amount), 0) AS total_value
      FROM product_orders
      GROUP BY payment_status
    `)

    res.status(200).json({
      status: 'success',
      data: {
        orderStatuses: rows.map(r => ({
          status: r.status,
          count: parseInt(r.count),
          totalValue: parseFloat(r.total_value)
        })),
        paymentStatuses: paymentRows.map(r => ({
          status: r.payment_status,
          count: parseInt(r.count),
          totalValue: parseFloat(r.total_value)
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
    const [buyerCities, sellerCities, gmvCities] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(city), ''), 'Unknown') AS city,
          COUNT(*) AS buyer_count
        FROM buyers
        GROUP BY city
        ORDER BY buyer_count DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(city), ''), 'Unknown') AS city,
          COUNT(*) AS seller_count,
          COALESCE(SUM(total_sales), 0) AS city_gmv
        FROM sellers
        WHERE is_active = true
        GROUP BY city
        ORDER BY seller_count DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(s.city), ''), 'Unknown') AS city,
          COALESCE(SUM(o.total_amount), 0) AS gmv,
          COUNT(o.id) AS order_count
        FROM product_orders o
        JOIN sellers s ON o.seller_id = s.id
        WHERE o.payment_status = 'completed'
        GROUP BY s.city
        ORDER BY gmv DESC
        LIMIT 10
      `)
    ])

    res.status(200).json({
      status: 'success',
      data: {
        topBuyerCities: buyerCities.rows.map(r => ({ city: r.city, count: parseInt(r.buyer_count) })),
        topSellerCities: sellerCities.rows.map(r => ({ city: r.city, count: parseInt(r.seller_count), gmv: parseFloat(r.city_gmv) })),
        topGmvCities: gmvCities.rows.map(r => ({ city: r.city, gmv: parseFloat(r.gmv), orderCount: parseInt(r.order_count) }))
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
      pool.query(`
        SELECT
          s.id,
          s.shop_name,
          s.city,
          s.total_sales,
          s.client_count,
          COUNT(DISTINCT o.id) AS order_count
        FROM sellers s
        LEFT JOIN product_orders o ON o.seller_id = s.id AND o.payment_status = 'completed'
        WHERE s.is_active = true
        GROUP BY s.id
        ORDER BY s.total_sales DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          p.id,
          p.name,
          p.product_type,
          p.aesthetic,
          COALESCE(SUM(oi.subtotal), 0) AS total_revenue,
          COALESCE(SUM(oi.quantity), 0) AS units_sold
        FROM products p
        JOIN order_items oi ON oi.product_id = p.id
        JOIN product_orders po ON oi.order_id = po.id AND po.payment_status = 'completed'
        GROUP BY p.id
        ORDER BY total_revenue DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          p.id,
          p.name,
          p.product_type,
          p.price,
          COUNT(w.id) AS wishlist_count
        FROM products p
        JOIN wishlists w ON w.product_id = p.id
        GROUP BY p.id
        ORDER BY wishlist_count DESC
        LIMIT 10
      `)
    ])

    res.status(200).json({
      status: 'success',
      data: {
        topSellers: topSellers.rows.map(r => ({
          id: r.id,
          shopName: r.shop_name,
          city: r.city,
          totalSales: parseFloat(r.total_sales),
          clientCount: parseInt(r.client_count),
          orderCount: parseInt(r.order_count)
        })),
        topProducts: topProducts.rows.map(r => ({
          id: r.id,
          name: r.name,
          productType: r.product_type,
          aesthetic: r.aesthetic,
          totalRevenue: parseFloat(r.total_revenue),
          unitsSold: parseInt(r.units_sold)
        })),
        topWishlisted: topWishlisted.rows.map(r => ({
          id: r.id,
          name: r.name,
          productType: r.product_type,
          price: parseFloat(r.price),
          wishlistCount: parseInt(r.wishlist_count)
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
    const [monthlyRewards, topReferrers] = await Promise.all([
      pool.query(`
        SELECT
          period_year,
          period_month,
          TO_CHAR(TO_DATE(period_month::text, 'MM'), 'Mon') || ' ' || period_year AS label,
          COUNT(DISTINCT referrer_seller_id) AS active_referrers,
          COUNT(*) AS referral_pairs,
          COALESCE(SUM(reward_amount), 0) AS total_rewards,
          COALESCE(SUM(referred_gmv), 0)  AS referred_gmv
        FROM referral_earnings_log
        GROUP BY period_year, period_month
        ORDER BY period_year DESC, period_month DESC
        LIMIT 12
      `),
      pool.query(`
        SELECT
          s.shop_name,
          s.city,
          COUNT(DISTINCT rel.referred_seller_id) AS referrals_made,
          COALESCE(SUM(rel.reward_amount), 0)    AS total_earned
        FROM referral_earnings_log rel
        JOIN sellers s ON s.id = rel.referrer_seller_id
        GROUP BY s.id
        ORDER BY total_earned DESC
        LIMIT 10
      `)
    ])

    // Total active sellers with referral codes
    const { rows: referralStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE referral_code IS NOT NULL) AS sellers_with_codes,
        COUNT(*) FILTER (WHERE referred_by_seller_id IS NOT NULL) AS referred_sellers
      FROM sellers
    `)

    res.status(200).json({
      status: 'success',
      data: {
        monthlyRewards: monthlyRewards.rows.map(r => ({
          label: r.label,
          year: r.period_year,
          month: r.period_month,
          activeReferrers: parseInt(r.active_referrers),
          referralPairs: parseInt(r.referral_pairs),
          totalRewards: parseFloat(r.total_rewards),
          referredGmv: parseFloat(r.referred_gmv)
        })).reverse(),
        topReferrers: topReferrers.rows.map(r => ({
          shopName: r.shop_name,
          city: r.city,
          referralsMade: parseInt(r.referrals_made),
          totalEarned: parseFloat(r.total_earned)
        })),
        sellersWithCodes: parseInt(referralStats[0]?.sellers_with_codes || 0),
        referredSellers: parseInt(referralStats[0]?.referred_sellers || 0)
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
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)

    const { rows } = await pool.query(`
      (
        SELECT
          'order' AS type,
          o.created_at AS timestamp,
          'New order: KSh ' || o.total_amount || ' from ' || s.shop_name AS description,
          o.total_amount AS value
        FROM product_orders o
        JOIN sellers s ON o.seller_id = s.id
        WHERE o.payment_status = 'completed'
        ORDER BY o.created_at DESC
        LIMIT $1
      )
      UNION ALL
      (
        SELECT
          'seller' AS type,
          s.created_at AS timestamp,
          'New seller: ' || s.shop_name || ' (' || COALESCE(s.city, 'Kenya') || ')' AS description,
          NULL AS value
        FROM sellers s
        ORDER BY s.created_at DESC
        LIMIT $1
      )
      UNION ALL
      (
        SELECT
          'buyer' AS type,
          b.created_at AS timestamp,
          'New buyer registered in ' || COALESCE(b.city, 'Kenya') AS description,
          NULL AS value
        FROM buyers b
        WHERE b.user_id IS NOT NULL
        ORDER BY b.created_at DESC
        LIMIT $1
      )
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit])

    res.status(200).json({
      status: 'success',
      data: rows.map(r => ({
        type: r.type,
        timestamp: r.timestamp,
        description: r.description,
        value: r.value ? parseFloat(r.value) : null
      }))
    })
  } catch (err) {
    next(err)
  }
}
