import crypto from 'crypto';
import User from '../models/user.model.js';
import AuthService from './auth.service.js';
import { pool } from '../shared/db/database.js';
import { signToken } from '../shared/utils/jwt.js';
import { sendEmail, sendVerificationEmail } from '../shared/utils/email.js';
import Fees from '../config/fees.js';
import logger from '../shared/utils/logger.js';

const DEFAULT_CREATOR_COMMISSION_RATE = Number(Fees.CREATOR_COMMISSION_RATE || 0.01);
const INVITE_EXPIRY_DAYS = 14;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const roundMoney = (amount) => Math.round(Number(amount || 0) * 100) / 100;

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
      } else if (user.role !== 'creator') {
        throw new Error('This email is already used by another Byblos account. Use a different creator email.');
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

      await AuthService.sendEmailVerification(email, 'creator');
      return { status: 'pending_verification', email };
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

  static async getDashboard(creatorId) {
    const { rows: creatorRows } = await pool.query(`SELECT * FROM creators WHERE id = $1`, [creatorId]);
    const creator = creatorRows[0];
    if (!creator) throw new Error('Creator profile not found.');

    const { rows: shops } = await pool.query(
      `SELECT scl.id,
              scl.code,
              scl.commission_rate,
              scl.status,
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

    return { creator, shops, earnings };
  }

  static async getReferralDashboard(creatorId) {
    const code = await this.generateReferralCode(creatorId);
    const { rows } = await pool.query(
      `SELECT c.id,
              c.first_name,
              c.last_name,
              c.created_at,
              COALESCE(SUM(cre.amount), 0) AS earnings,
              COALESCE(SUM(cre.units_sold), 0) AS units_sold
       FROM creators c
       LEFT JOIN creator_referral_earnings cre ON cre.referred_creator_id = c.id
       WHERE c.referred_by_creator_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [creatorId]
    );
    return { referralCode: code, referredCreators: rows };
  }
}

export default CreatorService;
