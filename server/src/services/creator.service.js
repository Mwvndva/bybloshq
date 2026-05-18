import crypto from 'crypto';
import User from '../models/user.model.js';
import AuthService from './auth.service.js';
import { pool } from '../shared/db/database.js';
import { signToken } from '../shared/utils/jwt.js';
import { sendEmail, sendVerificationEmail } from '../shared/utils/email.js';
import Fees from '../config/fees.js';
import logger from '../shared/utils/logger.js';
import payoutService from './payout.service.js';

const DEFAULT_CREATOR_COMMISSION_RATE = Number(Fees.CREATOR_COMMISSION_RATE || 0.01);
const INVITE_EXPIRY_DAYS = 14;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const roundMoney = (amount) => Math.round(Number(amount || 0) * 100) / 100;
const CREATOR_ANALYSIS_PERIODS = {
  daily: { unit: 'day', interval: '30 days', labelFormat: 'YYYY-MM-DD' },
  weekly: { unit: 'week', interval: '12 weeks', labelFormat: 'IYYY "W"IW' },
  monthly: { unit: 'month', interval: '12 months', labelFormat: 'YYYY-MM' }
};

class CreatorService {
  static async findByUserId(userId, client = pool) {
    const { rows } = await client.query(
      `SELECT * FROM creators WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  static async findByEmail(email, client = pool) {
    const { rows } = await client.query(
      `SELECT * FROM creators WHERE LOWER(email) = $1 LIMIT 1`,
      [normalizeEmail(email)]
    );
    return rows[0] || null;
  }

  static async inviteCreator({ sellerId, invitedByUserId, email }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Enter a valid creator email.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const existing = await pool.query(
      `SELECT id
       FROM seller_creator_invites
       WHERE seller_id = $1 AND LOWER(email) = $2 AND status = 'pending'
       LIMIT 1`,
      [sellerId, normalizedEmail]
    );

    const { rows } = existing.rows[0]
      ? await pool.query(
        `UPDATE seller_creator_invites
         SET invite_token = $2,
             invited_by_user_id = $3,
             expires_at = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, token, invitedByUserId, expiresAt]
      )
      : await pool.query(
        `INSERT INTO seller_creator_invites
           (seller_id, email, invite_token, invited_by_user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [sellerId, normalizedEmail, token, invitedByUserId, expiresAt]
      );

    const invite = rows[0];
    const seller = await this.getSellerSummary(sellerId);
    await this.sendCreatorInviteEmail(invite, seller);
    return this.decorateInvite(invite);
  }

  static async getSellerSummary(sellerId, client = pool) {
    const { rows } = await client.query(
      `SELECT id, shop_name, full_name, email FROM sellers WHERE id = $1 LIMIT 1`,
      [sellerId]
    );
    return rows[0] || null;
  }

  static async sendCreatorInviteEmail(invite, seller) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/creator/register?token=${invite.invite_token}`;
    const shopName = seller?.shop_name || 'a Byblos seller';

    await sendEmail({
      to: invite.email,
      subject: `${shopName} invited you to earn on Byblos`,
      text: `${shopName} invited you to become a Byblos creator. Create your account here: ${inviteUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;padding:24px">
          <h2 style="margin:0 0 12px">You have been invited to Byblos Creators</h2>
          <p>${shopName} wants you to promote their shop and earn from completed sales made through your creator link.</p>
          <p><a href="${inviteUrl}" style="display:inline-block;background:#facc15;color:#111;padding:12px 18px;border-radius:10px;font-weight:700;text-decoration:none">Create creator account</a></p>
          <p style="font-size:12px;color:#666">This invite expires in ${INVITE_EXPIRY_DAYS} days.</p>
        </div>
      `
    });
  }

  static async listSellerInvites(sellerId) {
    const { rows } = await pool.query(
      `SELECT sci.*,
              s.shop_name,
              c.first_name,
              c.last_name,
              scl.code,
              scl.commission_rate,
              scl.status AS link_status
       FROM seller_creator_invites sci
       JOIN sellers s ON s.id = sci.seller_id
       LEFT JOIN creators c ON c.id = sci.accepted_creator_id
       LEFT JOIN seller_creator_links scl
         ON scl.seller_id = sci.seller_id AND scl.creator_id = sci.accepted_creator_id
       WHERE sci.seller_id = $1
       ORDER BY sci.created_at DESC`,
      [sellerId]
    );
    return rows.map(this.decorateInvite);
  }

  static decorateInvite(invite) {
    const baseUrl = process.env.FRONTEND_URL || '';
    const shopPath = invite.code ? `/shop/${invite.shop_name || ''}?creator=${invite.code}` : null;
    return {
      id: invite.id,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
      creatorName: invite.first_name ? `${invite.first_name} ${invite.last_name || ''}`.trim() : null,
      code: invite.code || null,
      commissionRate: Number(invite.commission_rate || DEFAULT_CREATOR_COMMISSION_RATE),
      linkStatus: invite.link_status || null,
      shopUrl: shopPath ? `${baseUrl}${shopPath}` : null
    };
  }

  static async getInviteByToken(token) {
    const { rows } = await pool.query(
      `SELECT sci.*, s.shop_name, s.full_name AS seller_name
       FROM seller_creator_invites sci
       JOIN sellers s ON s.id = sci.seller_id
       WHERE sci.invite_token = $1
       LIMIT 1`,
      [token]
    );
    const invite = rows[0];
    if (!invite) throw new Error('Creator invite not found.');
    if (invite.status !== 'pending') throw new Error('This creator invite has already been used.');
    if (new Date(invite.expires_at) < new Date()) throw new Error('This creator invite has expired.');
    return invite;
  }

  static async registerFromInvite(data) {
    const invite = await this.getInviteByToken(data.token);
    const email = normalizeEmail(data.email || invite.email);

    if (email !== normalizeEmail(invite.email)) {
      throw new Error('Use the email address that received the invite.');
    }
    if (!data.firstName || !data.lastName || !data.password || !data.mpesaNumber) {
      throw new Error('First name, last name, M-Pesa number, and password are required.');
    }

    const existingCreator = await this.findByEmail(email);
    if (existingCreator) throw new Error('A creator account already exists for this email.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let user = await User.findByEmail(email);
      if (!user) {
        user = await User.create({ email, password: data.password, role: 'creator', is_verified: false }, client);
      } else {
        const isPasswordCorrect = await User.verifyPassword(data.password, user.password_hash);
        if (!isPasswordCorrect) {
          throw new Error('This email already has a Byblos account. Enter that account password to add creator access.');
        }

        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE slug = 'creator'
           ON CONFLICT DO NOTHING`,
          [user.id]
        );
      }

      const referredBy = data.referralCode
        ? await this.findCreatorByReferralCode(data.referralCode, client)
        : null;

      const { rows: creatorRows } = await client.query(
        `INSERT INTO creators
           (user_id, first_name, last_name, email, mpesa_number, instagram_link, tiktok_link, referred_by_creator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          user.id,
          String(data.firstName).trim(),
          String(data.lastName).trim(),
          email,
          String(data.mpesaNumber).trim(),
          data.instagramLink || null,
          data.tiktokLink || null,
          referredBy?.id || null
        ]
      );
      const creator = creatorRows[0];

      const code = await this.generateLinkCode(client);
      await client.query(
        `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (seller_id, creator_id)
         DO UPDATE SET status = 'active', updated_at = NOW()
         RETURNING *`,
        [invite.seller_id, creator.id, code, DEFAULT_CREATOR_COMMISSION_RATE]
      );

      await client.query(
        `UPDATE seller_creator_invites
         SET status = 'accepted', accepted_creator_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [creator.id, invite.id]
      );

      await client.query('COMMIT');

      if (!user.is_verified) {
        await AuthService.sendEmailVerification(email, 'creator');
        return { status: 'pending_verification', email };
      }

      return { status: 'created', email };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async login(email, password) {
    const result = await AuthService.login(email, password, 'creator');
    if (!result) return null;
    const profile = result.profile || await this.findByUserId(result.user.id);
    const token = result.token || signToken(result.user.id, 'creator', result.user.email);
    return { user: result.user, profile, token };
  }

  static async verifyEmail(email, token) {
    return AuthService.verifyEmail(email, token);
  }

  static async resendVerification(email) {
    return AuthService.resendVerificationEmail(email, 'creator');
  }

  static async findCreatorByReferralCode(code, client = pool) {
    const { rows } = await client.query(
      `SELECT * FROM creators WHERE referral_code = $1 AND status = 'active' LIMIT 1`,
      [String(code || '').trim().toUpperCase()]
    );
    return rows[0] || null;
  }

  static async generateReferralCode(creatorId) {
    const code = `CR${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { rows } = await pool.query(
      `UPDATE creators
       SET referral_code = COALESCE(referral_code, $2), updated_at = NOW()
       WHERE id = $1
       RETURNING referral_code`,
      [creatorId, code]
    );
    return rows[0]?.referral_code;
  }

  static async generateLinkCode(client = pool) {
    for (let i = 0; i < 8; i += 1) {
      const code = `C${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      const { rows } = await client.query('SELECT id FROM seller_creator_links WHERE code = $1', [code]);
      if (!rows.length) return code;
    }
    return `C${Date.now().toString(36).toUpperCase()}`;
  }

  static async resolveAttribution({ code, sellerId, productSubtotal }) {
    if (!code) return null;

    const { rows } = await pool.query(
      `SELECT scl.id AS link_id,
              scl.seller_id,
              scl.creator_id,
              scl.code,
              scl.commission_rate,
              c.status AS creator_status
       FROM seller_creator_links scl
       JOIN creators c ON c.id = scl.creator_id
       WHERE scl.code = $1
         AND scl.seller_id = $2
         AND scl.status = 'active'
       LIMIT 1`,
      [String(code).trim().toUpperCase(), sellerId]
    );
    const link = rows[0];
    if (!link || link.creator_status !== 'active') return null;

    const baseAmount = Math.max(roundMoney(productSubtotal - Number(Fees.PLATFORM_COMMISSION_AMOUNT || 0)), 0);
    const rate = Number(link.commission_rate || DEFAULT_CREATOR_COMMISSION_RATE);
    const commissionAmount = roundMoney(baseAmount * rate);

    if (commissionAmount <= 0) return null;

    return {
      code: link.code,
      creator_id: link.creator_id,
      seller_creator_link_id: link.link_id,
      seller_id: link.seller_id,
      commission_rate: rate,
      commission_base_amount: baseAmount,
      commission_amount: commissionAmount
    };
  }

  static async creditCreatorForOrder(client, { order, paymentId }) {
    const metadata = typeof order.metadata === 'string'
      ? JSON.parse(order.metadata || '{}')
      : (order.metadata || {});
    const attribution = metadata.creator_attribution;
    if (!attribution?.creator_id || !attribution?.commission_amount) return null;

    const amount = roundMoney(attribution.commission_amount);
    if (amount <= 0) return null;

    const { rows: inserted } = await client.query(
      `INSERT INTO creator_earnings
         (creator_id, seller_id, seller_creator_link_id, order_id, payment_id, amount, rate, base_amount, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id`,
      [
        attribution.creator_id,
        order.seller_id,
        attribution.seller_creator_link_id || null,
        order.id,
        paymentId || null,
        amount,
        Number(attribution.commission_rate || DEFAULT_CREATOR_COMMISSION_RATE),
        roundMoney(attribution.commission_base_amount || 0),
        JSON.stringify({ source: 'escrow_release' })
      ]
    );

    if (!inserted.length) return null;

    await client.query(
      `UPDATE creators
       SET balance = balance + $1,
           total_earnings = total_earnings + $1,
           total_sales = total_sales + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, attribution.creator_id]
    );

    await this.creditCreatorReferral(client, { creatorId: attribution.creator_id, order });
    return inserted[0];
  }

  static async creditCreatorReferral(client, { creatorId, order }) {
    const { rows } = await client.query(
      `SELECT referred_by_creator_id FROM creators WHERE id = $1 LIMIT 1`,
      [creatorId]
    );
    const referrerId = rows[0]?.referred_by_creator_id;
    if (!referrerId) return;

    const units = Math.max(Number(order.total_quantity || 1), 1);
    const amount = roundMoney(units * Number(Fees.REFERRAL_REWARD_PER_PRODUCT || 3));
    const { rows: inserted } = await client.query(
      `INSERT INTO creator_referral_earnings
         (referrer_creator_id, referred_creator_id, order_id, amount, units_sold)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id`,
      [referrerId, creatorId, order.id, amount, units]
    );

    if (!inserted.length) return;

    await client.query(
      `UPDATE creators
       SET balance = balance + $1,
           total_referral_earnings = total_referral_earnings + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, referrerId]
    );
  }

  static async creditCreatorReferralForSeller(client, { order }) {
    const sellerId = order.seller_id ?? order.sellerId;
    if (!sellerId) return;

    const { rows } = await client.query(
      `SELECT referred_by_creator_id FROM sellers WHERE id = $1 LIMIT 1`,
      [sellerId]
    );
    const referrerId = rows[0]?.referred_by_creator_id;
    if (!referrerId) return;

    const units = Math.max(Number(order.total_quantity || 1), 1);
    const amount = roundMoney(units * Number(Fees.REFERRAL_REWARD_PER_PRODUCT || 3));
    const { rows: inserted } = await client.query(
      `INSERT INTO creator_referral_earnings
         (referrer_creator_id, referred_creator_id, referred_seller_id, order_id, amount, units_sold)
       VALUES ($1, NULL, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id`,
      [referrerId, sellerId, order.id, amount, units]
    );

    if (!inserted.length) return;

    await client.query(
      `UPDATE creators
       SET balance = balance + $1,
           total_referral_earnings = total_referral_earnings + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, referrerId]
    );
  }

  static async recordLinkClick({ code, ipAddress, userAgent }) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) return null;

    const { rows } = await pool.query(
      `WITH target AS (
         SELECT id, creator_id, seller_id
         FROM seller_creator_links
         WHERE code = $1 AND status = 'active'
         LIMIT 1
       ),
       updated AS (
         UPDATE seller_creator_links
         SET click_count = click_count + 1,
             updated_at = NOW()
         WHERE id = (SELECT id FROM target)
         RETURNING id
       ),
       inserted AS (
         INSERT INTO creator_link_clicks (seller_creator_link_id, creator_id, seller_id, ip_address, user_agent)
         SELECT id, creator_id, seller_id, $2, $3 FROM target
         RETURNING id
       )
       SELECT target.id, target.creator_id, target.seller_id FROM target`,
      [normalizedCode, ipAddress || null, userAgent || null]
    );

    return rows[0] || null;
  }

  static getAnalysisPeriod(period) {
    const normalized = String(period || 'monthly').trim().toLowerCase();
    return {
      key: CREATOR_ANALYSIS_PERIODS[normalized] ? normalized : 'monthly',
      ...CREATOR_ANALYSIS_PERIODS[normalized in CREATOR_ANALYSIS_PERIODS ? normalized : 'monthly']
    };
  }

  static async getDashboard(creatorId, period = 'monthly') {
    const analysisPeriod = this.getAnalysisPeriod(period);
    const { rows: creatorRows } = await pool.query(`SELECT * FROM creators WHERE id = $1`, [creatorId]);
    const creator = creatorRows[0];
    if (!creator) throw new Error('Creator profile not found.');

    const { rows: shops } = await pool.query(
      `SELECT scl.id,
              scl.code,
              scl.commission_rate,
              scl.status,
              scl.click_count,
              s.shop_name,
              s.full_name AS seller_name,
              COUNT(ce.id) AS sales_count,
              COALESCE(SUM(ce.amount), 0) AS earnings
       FROM seller_creator_links scl
       JOIN sellers s ON s.id = scl.seller_id
       LEFT JOIN creator_earnings ce ON ce.seller_creator_link_id = scl.id
       WHERE scl.creator_id = $1
       GROUP BY scl.id, s.shop_name, s.full_name
       ORDER BY scl.created_at DESC`,
      [creatorId]
    );

    const { rows: earnings } = await pool.query(
      `SELECT ce.*, po.order_number, s.shop_name
       FROM creator_earnings ce
       JOIN product_orders po ON po.id = ce.order_id
       JOIN sellers s ON s.id = ce.seller_id
       WHERE ce.creator_id = $1
       ORDER BY ce.created_at DESC
       LIMIT 20`,
      [creatorId]
    );

    const { rows: analysis } = await pool.query(
      `SELECT TO_CHAR(period_start, $2) AS period,
              period_start,
              SUM(sales_count)::int AS sales,
              SUM(sales_value)::numeric AS sales_value,
              SUM(earnings)::numeric AS earnings,
              SUM(clicks)::int AS clicks
       FROM (
         SELECT DATE_TRUNC('${analysisPeriod.unit}', ce.created_at) AS period_start,
                COUNT(*) AS sales_count,
                COALESCE(SUM(po.total_amount), 0) AS sales_value,
                COALESCE(SUM(ce.amount), 0) AS earnings,
                0 AS clicks
         FROM creator_earnings ce
         JOIN product_orders po ON po.id = ce.order_id
         WHERE ce.creator_id = $1
           AND ce.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', ce.created_at)
         UNION ALL
         SELECT DATE_TRUNC('${analysisPeriod.unit}', cre.created_at) AS period_start,
                0 AS sales_count,
                0 AS sales_value,
                COALESCE(SUM(cre.amount), 0) AS earnings,
                0 AS clicks
         FROM creator_referral_earnings cre
         WHERE cre.referrer_creator_id = $1
           AND cre.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', cre.created_at)
         UNION ALL
         SELECT DATE_TRUNC('${analysisPeriod.unit}', clc.created_at) AS period_start,
                0 AS sales_count,
                0 AS sales_value,
                0 AS earnings,
                COUNT(*) AS clicks
         FROM creator_link_clicks clc
         WHERE clc.creator_id = $1
           AND clc.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', clc.created_at)
       ) series
       GROUP BY period_start
       ORDER BY period_start`,
      [creatorId, analysisPeriod.labelFormat]
    );

    const { rows: leaderboard } = await pool.query(
      `SELECT id,
              first_name,
              last_name,
              total_sales,
              total_earnings,
              total_referral_earnings,
              (total_earnings + total_referral_earnings) AS total_income
       FROM creators
       WHERE status = 'active'
       ORDER BY total_income DESC, total_sales DESC, id ASC
       LIMIT 10`
    );

    const { rows: clickRows } = await pool.query(
      `SELECT COUNT(*)::int AS link_clicks
       FROM creator_link_clicks
       WHERE creator_id = $1`,
      [creatorId]
    );

    const { rows: withdrawals } = await pool.query(
      `SELECT id, amount, withdrawal_fee, total_deducted, mpesa_number, status, provider_reference, created_at
       FROM creator_withdrawal_requests
       WHERE creator_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [creatorId]
    );

    return {
      creator,
      shops,
      earnings,
      analysis,
      analysisPeriod: analysisPeriod.key,
      monthly: analysis,
      leaderboard,
      withdrawals,
      linkClicks: Number.parseInt(clickRows[0]?.link_clicks || 0, 10)
    };
  }

  static async getReferralDashboard(creatorId) {
    const code = await this.generateReferralCode(creatorId);
    const { rows } = await pool.query(
      `SELECT s.id,
              s.shop_name AS first_name,
              '' AS last_name,
              s.created_at,
              s.shop_name,
              COALESCE(SUM(cre.amount), 0) AS earnings,
              COALESCE(SUM(cre.units_sold), 0) AS units_sold
       FROM sellers s
       LEFT JOIN creator_referral_earnings cre ON cre.referred_seller_id = s.id AND cre.referrer_creator_id = $1
       WHERE s.referred_by_creator_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [creatorId]
    );
    return { referralCode: code, referredSellers: rows };
  }

  static async createWithdrawalRequest({ creatorId, amount, idempotencyKey }) {
    const validatedAmount = payoutService.validateAmount(amount);
    const normalizedIdempotencyKey = String(idempotencyKey || '').trim().slice(0, 120);
    if (!normalizedIdempotencyKey) throw new Error('Idempotency-Key header is required.');

    const withdrawalFee = Fees.calculateWithdrawalFee(validatedAmount);
    const totalDeducted = roundMoney(validatedAmount + withdrawalFee);
    const client = await pool.connect();
    let request;
    let creator;

    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, first_name, last_name, mpesa_number, balance
         FROM creators
         WHERE id = $1 AND status = 'active'
         FOR UPDATE`,
        [creatorId]
      );
      creator = rows[0];
      if (!creator) throw new Error('Creator profile not found.');

      const { rows: existing } = await client.query(
        `SELECT * FROM creator_withdrawal_requests
         WHERE creator_id = $1 AND idempotency_key = $2
         FOR UPDATE`,
        [creatorId, normalizedIdempotencyKey]
      );
      if (existing[0]) {
        await client.query('COMMIT');
        return existing[0];
      }

      if (Number(creator.balance || 0) < totalDeducted) {
        throw new Error(`Insufficient balance. Required KES ${totalDeducted.toLocaleString()} including withdrawal charge.`);
      }

      await client.query(
        `UPDATE creators SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
        [totalDeducted, creatorId]
      );

      const mpesaName = `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Byblos Creator';
      const insert = await client.query(
        `INSERT INTO creator_withdrawal_requests
           (creator_id, amount, withdrawal_fee, total_deducted, mpesa_number, mpesa_name, idempotency_key, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING *`,
        [
          creatorId,
          validatedAmount,
          withdrawalFee,
          totalDeducted,
          payoutService.normalizePhoneForPayout(creator.mpesa_number),
          mpesaName,
          normalizedIdempotencyKey,
          JSON.stringify({ source: 'creator_dashboard' })
        ]
      );
      request = insert.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    payoutService.initiatePayout({
      phone_number: request.mpesa_number,
      amount: validatedAmount,
      narration: `Byblos creator withdrawal ${request.id}`,
      idempotency_key: normalizedIdempotencyKey,
      recipient_name: request.mpesa_name
    }).then(async (providerResult) => {
      await pool.query(
        `UPDATE creator_withdrawal_requests
         SET status = 'processing',
             provider_reference = $2,
             metadata = metadata || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [request.id, providerResult.provider_reference || providerResult.reference || null, JSON.stringify({ provider_result: providerResult })]
      );
    }).catch(async (error) => {
      logger.error('[CREATOR_WITHDRAWAL] Payout failed:', error.message);
      await pool.query(
        `UPDATE creator_withdrawal_requests
         SET status = 'failed',
             metadata = metadata || $2::jsonb,
             updated_at = NOW(),
             processed_at = NOW()
         WHERE id = $1`,
        [request.id, JSON.stringify({ provider_error: { message: error.message, code: error.code || null } })]
      );
      await pool.query(
        `UPDATE creators SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [request.total_deducted, creatorId]
      );
    });

    return request;
  }
}

export default CreatorService;
