import crypto from 'crypto';
import User from '../../identity/users/user.model.js';
import AuthService from '../../identity/auth/auth.service.js';
import { pool } from '../../../infrastructure/database/database.js';
import { signToken } from '../../../shared/utils/jwt.js';
import { sendEmail, sendVerificationEmail } from '../../../shared/utils/email.js';
import Fees from '../../../shared/config/fees.js';
import logger from '../../../shared/utils/logger.js';
import notificationService from '../../communication/notifications/notification.service.js';
import WithdrawalService from '../../payments/withdrawals/withdrawal.service.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import { computeCreatorReferralReward, isSelfReferral, computeClearance } from './creatorMoney.utils.js';
import { addBusinessDays } from '../../orders/escrow/settlement.service.js';
import { normalizeKenyanPhone } from '../../../shared/utils/phone.js';
import { MAX_ACTIVE_PROMOTIONS } from './creatorLimits.js';

/**
 * Number of shops a creator is actively promoting, excluding one seller (so the
 * link being (re)activated for that seller isn't counted against itself). Used
 * to enforce MAX_ACTIVE_PROMOTIONS. Runs on the provided client so it sees the
 * FOR UPDATE-locked state inside the accept transactions.
 */
async function countActivePromotions(client, creatorId, excludeSellerId = null) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
       FROM seller_creator_links
      WHERE creator_id = $1 AND status = 'active'
        AND ($2::int IS NULL OR seller_id <> $2)`,
    [creatorId, excludeSellerId]
  );
  return rows[0].n;
}
import { recordFraudEvent } from '../../../shared/utils/fraudEvents.js';

const DEFAULT_CREATOR_COMMISSION_RATE = Number(Fees.CREATOR_COMMISSION_RATE || 0.01);
const INVITE_EXPIRY_DAYS = 14;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const roundMoney = (amount) => Math.round(Number(amount || 0) * 100) / 100;
const normalizeCommissionRate = (rate) => {
  const numericRate = Number(rate);
  if (!Number.isFinite(numericRate)) return DEFAULT_CREATOR_COMMISSION_RATE;
  return Math.min(1, Math.max(DEFAULT_CREATOR_COMMISSION_RATE, numericRate));
};
const CREATOR_ANALYSIS_PERIODS = {
  daily: { unit: 'day', interval: '30 days', labelFormat: 'YYYY-MM-DD' },
  weekly: { unit: 'week', interval: '12 weeks', labelFormat: 'IYYY "W"IW' },
  monthly: { unit: 'month', interval: '12 months', labelFormat: 'YYYY-MM' },
  yearly: { unit: 'year', interval: '5 years', labelFormat: 'YYYY' }
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
    const seller = await this.getSellerSummary(sellerId);
    const existingCreator = await this.findByEmail(normalizedEmail);

    if (existingCreator) {
      const { rows: activeLinks } = await pool.query(
        `SELECT scl.*,
                s.shop_name,
                c.first_name,
                c.last_name
         FROM seller_creator_links scl
         JOIN sellers s ON s.id = scl.seller_id
         JOIN creators c ON c.id = scl.creator_id
         WHERE scl.seller_id = $1
           AND scl.creator_id = $2
           AND scl.status = 'active'
         LIMIT 1`,
        [sellerId, existingCreator.id]
      );
      if (activeLinks[0]) {
        return this.decorateInvite({
          ...activeLinks[0],
          email: normalizedEmail,
          status: 'linked',
          link_status: activeLinks[0].status
        });
      }
    }

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
             accepted_creator_id = $5,
             expires_at = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, token, invitedByUserId, expiresAt, existingCreator?.id || null]
      )
      : await pool.query(
        `INSERT INTO seller_creator_invites
           (seller_id, email, invite_token, invited_by_user_id, accepted_creator_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [sellerId, normalizedEmail, token, invitedByUserId, existingCreator?.id || null, expiresAt]
      );

    const invite = rows[0];
    if (existingCreator) {
      await this.sendExistingCreatorShopRequestEmail(invite, seller, existingCreator);
      // In-app indicator + device push so the creator sees the request without
      // waiting on email. Fire-and-forget: notification failure must not fail
      // the invite.
      if (existingCreator.user_id) {
        notificationService.send({
          recipientUserId: existingCreator.user_id,
          recipientRole: 'creator',
          type: 'creator_shop_request_received',
          title: 'New shop request',
          body: `${seller?.shop_name || 'A seller'} wants you to promote their shop. Review it in your dashboard.`,
          data: { path: '/creator/dashboard', inviteId: invite.id },
          channels: ['in_app', 'push']
        }).catch((err) => logger.warn('[Feed] Creator shop-request received notification failed', { error: err.message }));
      }
      return this.decorateInvite({
        ...invite,
        first_name: existingCreator.first_name,
        last_name: existingCreator.last_name,
        shop_name: seller?.shop_name,
        seller_creator_commission_rate: seller?.creator_commission_rate
      });
    }

    await this.sendCreatorInviteEmail(invite, seller);
    return this.decorateInvite({
      ...invite,
      seller_creator_commission_rate: seller?.creator_commission_rate
    });
  }

  static async getSellerSummary(sellerId, client = pool) {
    const { rows } = await client.query(
      `SELECT id, shop_name, full_name, email, creator_commission_rate FROM sellers WHERE id = $1 LIMIT 1`,
      [sellerId]
    );
    return rows[0] || null;
  }

  static async sendCreatorInviteEmail(invite, seller) {
    const baseUrl = process.env.FRONTEND_URL.replace(/\/+$/, '');
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

  static async sendExistingCreatorShopRequestEmail(invite, seller, creator) {
    const baseUrl = process.env.FRONTEND_URL.replace(/\/+$/, '');
    const dashboardUrl = `${baseUrl}/creator/dashboard`;

    const shopName = seller?.shop_name || 'a Byblos seller';

    await sendEmail({
      to: invite.email,
      subject: `${shopName} wants you to promote their shop`,
      text: `${shopName} sent you a Byblos creator request. Log in to accept or deny it: ${dashboardUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;padding:24px">
          <h2 style="margin:0 0 12px">New shop request on Byblos</h2>
          <p>Hi ${creator?.first_name || 'creator'}, ${shopName} wants you to promote their shop and earn from completed sales made through your creator link.</p>
          <p><a href="${dashboardUrl}" style="display:inline-block;background:#facc15;color:#111;padding:12px 18px;border-radius:10px;font-weight:700;text-decoration:none">Review request</a></p>
          <p style="font-size:12px;color:#666">You can accept or deny this request in your creator dashboard.</p>
        </div>
      `
    });
  }

  static async listSellerInvites(sellerId) {
    const { rows } = await pool.query(
      `SELECT sci.*,
              s.shop_name,
              s.slug,
              c.first_name,
              c.last_name,
              scl.code,
              scl.commission_rate,
              s.creator_commission_rate AS seller_creator_commission_rate,
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
    const slug = invite.slug || invite.shop_name || '';
    const shopPath = invite.code ? `/${slug}?creator=${invite.code}` : null;
    return {
      id: invite.id,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
      creatorName: invite.first_name ? `${invite.first_name} ${invite.last_name || ''}`.trim() : null,
      code: invite.code || null,
      commissionRate: normalizeCommissionRate(invite.commission_rate || invite.seller_creator_commission_rate),
      linkStatus: invite.link_status || null,
      shopUrl: shopPath ? `${baseUrl}${shopPath}` : null
    };
  }

  static async respondToShopRequest({ creatorId, inviteId, action }) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (!['accept', 'deny'].includes(normalizedAction)) {
      throw new Error('Choose accept or deny.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT sci.*, s.shop_name, s.creator_commission_rate
         FROM seller_creator_invites sci
         JOIN sellers s ON s.id = sci.seller_id
         WHERE sci.id = $1
           AND sci.accepted_creator_id = $2
           AND sci.status = 'pending'
         FOR UPDATE`,
        [inviteId, creatorId]
      );
      const invite = rows[0];
      if (!invite) throw new Error('Shop request not found or already handled.');

      if (normalizedAction === 'deny') {
        const denied = await client.query(
          `UPDATE seller_creator_invites
           SET status = 'declined', updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [invite.id]
        );
        await client.query('COMMIT');
        return { status: 'declined', invite: this.decorateInvite({ ...denied.rows[0], shop_name: invite.shop_name }) };
      }

      const activeCount = await countActivePromotions(client, creatorId, invite.seller_id);
      if (activeCount >= MAX_ACTIVE_PROMOTIONS) {
        throw new AppError(`You can promote at most ${MAX_ACTIVE_PROMOTIONS} shops at once. Leave one to accept this.`, 400);
      }

      const existing = await client.query(
        `SELECT id, code FROM seller_creator_links
         WHERE seller_id = $1 AND creator_id = $2
         LIMIT 1`,
        [invite.seller_id, creatorId]
      );
      const code = existing.rows[0]?.code || await this.generateLinkCode(client);
      const commissionRate = normalizeCommissionRate(invite.creator_commission_rate);
      await client.query(
        `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (seller_id, creator_id)
         DO UPDATE SET commission_rate = EXCLUDED.commission_rate,
                       status = 'active',
                       updated_at = NOW()
         RETURNING *`,
        [invite.seller_id, creatorId, code, commissionRate]
      );
      const accepted = await client.query(
        `UPDATE seller_creator_invites
         SET status = 'accepted', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [invite.id]
      );
      await client.query('COMMIT');
      return { status: 'accepted', invite: this.decorateInvite({ ...accepted.rows[0], code, shop_name: invite.shop_name, commission_rate: commissionRate }) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Creator leaves a shop they are promoting: terminate the active
   * seller_creator_link (stops all future commission) — but only once every
   * sale contract that ran through this collaboration is settled. Any order
   * attributed to this creator+seller that is not in a terminal state blocks
   * the exit so in-flight commission can never be orphaned.
   */
  static async leavePromotedShop(creatorId, sellerId) {
    const sid = Number(sellerId);
    if (!Number.isInteger(sid)) throw new AppError('Invalid shop.', 400);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const linkRes = await client.query(
        `SELECT id FROM seller_creator_links
          WHERE creator_id = $1 AND seller_id = $2 AND status = 'active'
          FOR UPDATE`,
        [creatorId, sid]
      );
      if (!linkRes.rows[0]) {
        throw new AppError('You are not actively promoting this shop.', 404);
      }

      const openRes = await client.query(
        `SELECT COUNT(*)::int AS n
           FROM product_orders po
          WHERE po.seller_id = $2
            AND (po.metadata -> 'creator_attribution' ->> 'creator_id')::int = $1
            AND po.status NOT IN ('COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED')`,
        [creatorId, sid]
      );
      const openCount = openRes.rows[0].n;
      if (openCount > 0) {
        throw new AppError(
          `Complete ${openCount} open order${openCount === 1 ? '' : 's'} before leaving this shop.`,
          409
        );
      }

      await client.query(
        `UPDATE seller_creator_links
            SET status = 'left', updated_at = NOW()
          WHERE id = $1`,
        [linkRes.rows[0].id]
      );

      await client.query('COMMIT');
      return { status: 'left', sellerId: sid };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Creator leaves a business they invited: detach the referral so no future
   * KSh reward accrues, and cancel only the still-PENDING (T+2-clearing)
   * referral earnings from that business — reversing their amount out of the
   * creator's balance. Earnings that have already cleared (or been withdrawn)
   * are left untouched.
   */
  static async leaveInvitedBusiness(creatorId, sellerId) {
    const sid = Number(sellerId);
    if (!Number.isInteger(sid)) throw new AppError('Invalid business.', 400);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sellerRes = await client.query(
        `SELECT id FROM sellers WHERE id = $1 AND referred_by_creator_id = $2 FOR UPDATE`,
        [sid, creatorId]
      );
      if (!sellerRes.rows[0]) {
        throw new AppError('You have not invited this business.', 404);
      }

      const { rows: earnings } = await client.query(
        `SELECT id, amount, created_at
           FROM creator_referral_earnings
          WHERE referrer_creator_id = $1 AND referred_seller_id = $2
            AND status = 'credited'
          FOR UPDATE`,
        [creatorId, sid]
      );

      const now = new Date();
      const pending = earnings.filter((e) => now < addBusinessDays(new Date(e.created_at), 2));
      const pendingIds = pending.map((e) => e.id);
      const pendingTotal = roundMoney(pending.reduce((sum, e) => sum + Number(e.amount || 0), 0));

      if (pendingIds.length > 0) {
        await client.query(
          `UPDATE creator_referral_earnings
              SET status = 'cancelled',
                  metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
            WHERE id = ANY($1::int[])`,
          [pendingIds, JSON.stringify({ cancelled_reason: 'creator_left_invited_business', cancelled_at: now.toISOString() })]
        );
        await client.query(
          `UPDATE creators
              SET balance = GREATEST(0, balance - $1),
                  total_referral_earnings = GREATEST(0, total_referral_earnings - $1),
                  updated_at = NOW()
            WHERE id = $2`,
          [pendingTotal, creatorId]
        );
      }

      await client.query(
        `UPDATE sellers SET referred_by_creator_id = NULL
          WHERE id = $1 AND referred_by_creator_id = $2`,
        [sid, creatorId]
      );

      await client.query('COMMIT');
      return { status: 'left', sellerId: sid, cancelledPending: pendingTotal, cancelledCount: pendingIds.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seller removes a creator who is promoting their shop: terminates the
   * seller_creator_link (stops future commission). Mirrors the creator's own
   * leavePromotedShop guard — blocked while any order attributed to this
   * creator+seller is still open, so in-flight commission is never orphaned.
   */
  static async sellerRemoveCreator(sellerId, creatorId) {
    const cid = Number(creatorId);
    if (!Number.isInteger(cid)) throw new AppError('Invalid creator.', 400);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const linkRes = await client.query(
        `SELECT id FROM seller_creator_links
          WHERE seller_id = $1 AND creator_id = $2 AND status = 'active'
          FOR UPDATE`,
        [sellerId, cid]
      );
      if (!linkRes.rows[0]) {
        throw new AppError('This creator is not actively promoting your shop.', 404);
      }

      const openRes = await client.query(
        `SELECT COUNT(*)::int AS n
           FROM product_orders po
          WHERE po.seller_id = $1
            AND (po.metadata -> 'creator_attribution' ->> 'creator_id')::int = $2
            AND po.status NOT IN ('COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED')`,
        [sellerId, cid]
      );
      const openCount = openRes.rows[0].n;
      if (openCount > 0) {
        throw new AppError(
          `Complete ${openCount} open order${openCount === 1 ? '' : 's'} with this creator before removing them.`,
          409
        );
      }

      await client.query(
        `UPDATE seller_creator_links
            SET status = 'removed', updated_at = NOW()
          WHERE id = $1`,
        [linkRes.rows[0].id]
      );

      await client.query('COMMIT');
      return { status: 'removed', creatorId: cid };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getInviteByToken(token) {
    const { rows } = await pool.query(
      `SELECT sci.*, s.shop_name, s.full_name AS seller_name, s.creator_commission_rate
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
    if (data.password !== data.confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    // Same terms requirement as registerDirect -- an invite from a seller
    // doesn't substitute for the creator's own consent to Byblos's terms.
    if (data.termsAccepted !== true) {
      throw new AppError('You must accept the terms and conditions to create an account.', 400);
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
          const { rows: roles } = await client.query(
            `SELECT
               EXISTS(SELECT 1 FROM buyers WHERE user_id = $1) as has_buyer,
               EXISTS(SELECT 1 FROM sellers WHERE user_id = $1) as has_seller`,
            [user.id]
          );
          const hasBuyer = Boolean(roles[0]?.has_buyer);
          const hasSeller = Boolean(roles[0]?.has_seller);
          const suggestedRole = hasSeller && !hasBuyer ? 'seller' : hasBuyer && !hasSeller ? 'buyer' : user.role || 'buyer';

          const err = new Error('This email already has a Byblos account. Enter that account password to add creator access.');
          err.code = 'EXISTING_ACCOUNT';
          err.existingRoles = {
            hasBuyer,
            hasSeller,
            suggestedRole,
            loginPath: suggestedRole === 'seller' ? '/seller/login' : '/buyer/login'
          };
          throw err;
        }

        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE slug = 'creator'
           ON CONFLICT DO NOTHING`,
          [user.id]
        );
      }

      const { rows: creatorRows } = await client.query(
        `INSERT INTO creators
           (user_id, first_name, last_name, email, mpesa_number, whatsapp_number, terms_accepted, terms_accepted_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
         RETURNING *`,
        [
          user.id,
          String(data.firstName).trim(),
          String(data.lastName).trim(),
          email,
          String(data.mpesaNumber).trim(),
          data.whatsappNumber ? String(data.whatsappNumber).trim() : null
        ]
      );
      const creator = creatorRows[0];

      const code = await this.generateLinkCode(client);
      const commissionRate = normalizeCommissionRate(invite.creator_commission_rate);
      await client.query(
        `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (seller_id, creator_id)
         DO UPDATE SET commission_rate = EXCLUDED.commission_rate,
                       status = 'active',
                       updated_at = NOW()
         RETURNING *`,
        [invite.seller_id, creator.id, code, commissionRate]
      );

      await client.query(
        `UPDATE seller_creator_invites
         SET status = 'accepted', accepted_creator_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [creator.id, invite.id]
      );

      await client.query('COMMIT');

      if (!user.is_verified) {
        try {
          await AuthService.sendEmailVerification(email, 'creator');
        } catch (emailErr) {
          logger.error('[CREATOR] Failed to dispatch verification email during invite registration:', {
            email,
            error: emailErr.message,
            stack: emailErr.stack
          });
        }
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

  static async registerDirect(data) {
    const email = normalizeEmail(data.email);

    if (!email || !email.includes('@')) {
      throw new Error('Enter a valid email address.');
    }
    if (!data.firstName || !data.lastName || !data.password || !data.mpesaNumber) {
      throw new Error('First name, last name, email, M-Pesa number, and password are required.');
    }
    if (data.password !== data.confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    // Buyers/sellers have always required this (AuthService.register); creators
    // never did -- registerDirect had no concept of terms acceptance at all.
    // AppError (not a plain Error) because the controller's catch block below
    // classifies 400-vs-500 by matching substrings in error.message, and this
    // message doesn't match any of them -- it would otherwise fall through to
    // next(error) and get masked as a generic 500 by globalErrorHandler.
    if (data.termsAccepted !== true) {
      throw new AppError('You must accept the terms and conditions to create an account.', 400);
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
          const { rows: roles } = await client.query(
            `SELECT
               EXISTS(SELECT 1 FROM buyers WHERE user_id = $1) as has_buyer,
               EXISTS(SELECT 1 FROM sellers WHERE user_id = $1) as has_seller`,
            [user.id]
          );
          const hasBuyer = Boolean(roles[0]?.has_buyer);
          const hasSeller = Boolean(roles[0]?.has_seller);
          const suggestedRole = hasSeller && !hasBuyer ? 'seller' : hasBuyer && !hasSeller ? 'buyer' : user.role || 'buyer';

          const err = new Error('This email already has a Byblos account. Enter that account password to add creator access.');
          err.code = 'EXISTING_ACCOUNT';
          err.existingRoles = {
            hasBuyer,
            hasSeller,
            suggestedRole,
            loginPath: suggestedRole === 'seller' ? '/seller/login' : '/buyer/login'
          };
          throw err;
        }

        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE slug = 'creator'
           ON CONFLICT DO NOTHING`,
          [user.id]
        );
      }

      await client.query(
        `INSERT INTO creators
           (user_id, first_name, last_name, email, mpesa_number, whatsapp_number, terms_accepted, terms_accepted_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
        [
          user.id,
          String(data.firstName).trim(),
          String(data.lastName).trim(),
          email,
          String(data.mpesaNumber).trim(),
          data.whatsappNumber ? String(data.whatsappNumber).trim() : null
        ]
      );

      await client.query('COMMIT');

      if (!user.is_verified) {
        try {
          await AuthService.sendEmailVerification(email, 'creator');
        } catch (emailErr) {
          logger.error('[CREATOR] Failed to dispatch verification email during direct registration:', {
            email,
            error: emailErr.message,
            stack: emailErr.stack
          });
        }
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

  static async resolveAttribution({ code, sellerId, productSubtotal, buyer = null }) {
    if (!code) return null;

    const { rows } = await pool.query(
      `SELECT scl.id AS link_id,
              scl.seller_id,
              scl.creator_id,
              scl.code,
              scl.commission_rate,
              c.status AS creator_status,
              c.user_id AS creator_user_id,
              c.email AS creator_email,
              c.mpesa_number AS creator_mpesa
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

    // RULE 1 — CREATOR SELF-REFERRAL PREVENTION
    // A creator must never receive creator commission from an order where the creator is also the buyer.
    //
    // FIX (audit P1-3): `buyer.userId`/`buyer.creatorId` are now populated by
    // normalizeOrderInput directly from the authenticated `req.user` (server-
    // verified JWT + DB cross-role lookup) — not from anything the client can
    // supply — so a logged-in creator can no longer dodge this check by
    // submitting a guest email/phone that doesn't match their creator profile.
    // A fully unauthenticated guest checkout with fresh contact info that
    // doesn't match the creator's registered identity cannot be caught here —
    // Byblos has no device/session signal for a request that never
    // authenticates. This is an ACCEPTED RISK (decision 2026-09-05): the
    // reward is capped at the platform fee and the post-hoc check
    // (_detectPostHocSelfDealing) still catches guests that later resolve to
    // the creator's own buyer profile. See docs/OPEN_DECISIONS.md.
    if (buyer) {
      let buyerRecord = null;
      if (buyer.id && (!buyer.userId && !buyer.user_id)) {
        const { rows: bRows } = await pool.query(
          `SELECT id, user_id, email, mobile_payment, whatsapp_number FROM buyers WHERE id = $1`,
          [buyer.id]
        );
        buyerRecord = bRows[0] || null;
      }

      const buyerId = buyer.id || buyerRecord?.id;
      const buyerUserId = buyer.userId || buyer.user_id || buyerRecord?.user_id;
      const buyerCreatorId = buyer.creatorId || buyer.creator_id;
      const buyerEmail = buyer.email || buyerRecord?.email || '';
      const buyerPhone = buyer.mobilePayment || buyer.phone || buyerRecord?.mobile_payment || '';

      const selfReferralMatch = isSelfReferral({
        buyerCreatorId,
        buyerUserId,
        buyerEmail,
        buyerPhone,
        creatorId: link.creator_id,
        creatorUserId: link.creator_user_id,
        creatorEmail: link.creator_email,
        creatorPhone: link.creator_mpesa
      });

      if (selfReferralMatch) {
        logger.warn('[CreatorAttribution] Self-referral detected and rejected', {
          creatorId: link.creator_id,
          buyerId,
          code: link.code
        });
        return null;
      }
    }

    // Creator commission base is the FULL product subtotal (authoritative Byblos
    // rule): commission is computed before the KES 10 Byblos seller fee, never
    // from subtotal - 10. Rate comes from the active seller/creator agreement
    // (seller_creator_links.commission_rate); DEFAULT_CREATOR_COMMISSION_RATE is
    // the fallback only.
    const baseAmount = Math.max(roundMoney(productSubtotal), 0);
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

  /**
   * Post-hoc self-dealing re-check, run at credit time (escrow release) using
   * fresh DB state rather than whatever the checkout request carried.
   *
   * FIX (T+2 review-hold — closes the loop the anonymous-guest-checkout gap
   * left open): the checkout-time check in resolveAttribution can only
   * compare against what a guest typed into the checkout form. If that
   * doesn't match the creator's registered identity, the earning gets
   * created normally. This re-check adds one signal checkout-time couldn't
   * use: whether the order's buyer IS the creator's own long-standing buyer
   * profile (matched by the stable `buyers.id` relationship via
   * `creators.user_id`, not fuzzy field comparison) — and re-runs the same
   * email/phone/user-id checks against current DB state in case anything
   * changed between checkout and order completion.
   *
   * This does not block or alter the credit — it only decides whether the
   * resulting earning should be flagged so getCreatorClearance holds it
   * indefinitely instead of releasing it after the normal T+2 window.
   *
   * @returns {Promise<{ flagged: boolean }>}
   */
  static async _detectPostHocSelfDealing(client, { creatorId, buyerId }) {
    const { rows: creatorRows } = await client.query(
      `SELECT id, user_id, email, mpesa_number, whatsapp_number FROM creators WHERE id = $1`,
      [creatorId]
    );
    const creatorRow = creatorRows[0];
    if (!creatorRow) return { flagged: false };

    const [buyerRowResult, creatorOwnBuyerResult] = await Promise.all([
      buyerId
        ? client.query(`SELECT id, user_id, email, mobile_payment, whatsapp_number FROM buyers WHERE id = $1`, [buyerId])
        : Promise.resolve({ rows: [] }),
      creatorRow.user_id
        ? client.query(`SELECT id FROM buyers WHERE user_id = $1 LIMIT 1`, [creatorRow.user_id])
        : Promise.resolve({ rows: [] })
    ]);
    const buyerRow = buyerRowResult.rows[0] || null;
    const creatorOwnBuyerId = creatorOwnBuyerResult.rows[0]?.id || null;

    const flagged = isSelfReferral({
      buyerId,
      creatorOwnBuyerId,
      buyerUserId: buyerRow?.user_id || null,
      buyerEmail: buyerRow?.email || null,
      buyerPhone: buyerRow?.mobile_payment || buyerRow?.whatsapp_number || null,
      creatorId: creatorRow.id,
      creatorUserId: creatorRow.user_id,
      creatorEmail: creatorRow.email,
      creatorPhone: creatorRow.mpesa_number || creatorRow.whatsapp_number
    });

    return { flagged };
  }

  static async creditCreatorForOrder(client, { order, paymentId }) {
    const metadata = typeof order.metadata === 'string'
      ? JSON.parse(order.metadata || '{}')
      : (order.metadata || {});
    const attribution = metadata.creator_attribution;
    if (!attribution?.creator_id || !attribution?.commission_amount) return null;

    const amount = roundMoney(attribution.commission_amount);
    if (amount <= 0) return null;

    const buyerId = order.buyer_id ?? order.buyerId ?? null;
    const { flagged } = await this._detectPostHocSelfDealing(client, {
      creatorId: attribution.creator_id,
      buyerId
    });

    const earningMetadata = {
      source: 'escrow_release',
      ...(flagged ? {
        flagged_for_review: true,
        flag_reason: 'post_hoc_self_referral_match',
        flagged_at: new Date().toISOString()
      } : {})
    };

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
        JSON.stringify(earningMetadata)
      ]
    );

    if (!inserted.length) return null;

    // Balance/notification behavior is unchanged either way — flagging is
    // invisible to the buyer and creator by design (see the remediation
    // report). Only getCreatorClearance's withdrawal-eligibility check and
    // the admin review queue know about the flag.
    await client.query(
      `UPDATE creators
       SET balance = balance + $1,
           total_earnings = total_earnings + $1,
           total_sales = total_sales + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, attribution.creator_id]
    );

    if (flagged) {
      logger.warn('[CreatorAttribution] Post-hoc self-dealing match at credit time; earning held for review', {
        creatorId: attribution.creator_id,
        orderId: order.id,
        buyerId,
        earningId: inserted[0].id
      });
      await recordFraudEvent({
        orderId: order.id,
        eventType: 'creator_self_referral_suspected',
        expectedAmount: amount,
        payload: {
          creator_id: attribution.creator_id,
          buyer_id: buyerId,
          seller_creator_link_id: attribution.seller_creator_link_id || null,
          creator_earning_id: inserted[0].id
        },
        details: {
          stage: 'escrow_release_credit',
          detected_at: new Date().toISOString()
        }
      });
    }

    await this.notifyCreatorSaleSuccess(client, {
      creatorId: attribution.creator_id,
      order,
      amount
    });
    return inserted[0];
  }

  static async notifyCreatorSaleSuccess(client, { creatorId, order, amount }) {
    const { rows } = await client.query(
      `SELECT c.first_name,
              c.whatsapp_number,
              c.user_id,
              s.shop_name
       FROM creators c
       LEFT JOIN sellers s ON s.id = $2
       WHERE c.id = $1
       LIMIT 1`,
      [creatorId, order.seller_id || null]
    );
    const creator = rows[0];
    if (!creator) return;

    if (creator.user_id) {
      const amountText = Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const orderRef = order.order_number || order.orderNumber || ('#' + order.id);
      notificationService.send({
        recipientUserId: creator.user_id,
        recipientRole: 'creator',
        type: 'creator_sale',
        title: 'You earned KSh ' + amountText,
        body: 'Your link generated a sale on order ' + orderRef + '.',
        data: { path: '/creator/dashboard', orderId: order.id },
        channels: ['in_app', 'push']
      }).catch((error) => logger.warn('[Feed] creator sale notification failed', { creatorId, error: error.message }));
    }
  }

  /**
   * Hardened Creator-Refers-Seller Logic:
   * Credits a creator KSh 3 per product sold when a seller they referred to Byblos completes an order.
   * Note: The KSh 3 reward per product is deducted from the platform's KSh 10 flat commission fee.
   *
   * FIX (audit P2-1): the reward was previously `units * 3` with no ceiling, so
   * any order with 4+ units of a product paid out MORE in referral reward than
   * the entire flat KES-10 platform fee it is funded from (e.g. 5 units = 15
   * KES paid from a 10 KES fee) — a guaranteed per-order loss on that revenue
   * line. The reward is capped at the flat platform fee actually collected on
   * the order so it can never exceed its funding source. All money math below
   * stays in integer cents to avoid floating-point rounding drift.
   */
  static async creditCreatorReferralForSeller(client, { order }) {
    const sellerId = order.seller_id ?? order.sellerId;
    if (!sellerId) return null;

    const { rows } = await client.query(
      `SELECT referred_by_creator_id FROM sellers WHERE id = $1 LIMIT 1`,
      [sellerId]
    );
    const referrerId = rows[0]?.referred_by_creator_id;
    if (!referrerId) return null;

    const units = Math.max(Number(order.total_quantity || 1), 1);
    const { amount, amountCents, uncappedAmount, capped } = computeCreatorReferralReward({
      units,
      rewardRatePerUnit: Fees.REFERRAL_REWARD_PER_PRODUCT || 3,
      platformFeeAmount: Fees.PLATFORM_COMMISSION_AMOUNT || 10
    });

    if (capped) {
      logger.warn('[CreatorService] Referral reward capped at platform flat fee', {
        orderId: order.id,
        sellerId,
        referrerId,
        units,
        uncappedAmount,
        cappedAmount: amount
      });
    }

    if (amount <= 0 || amountCents <= 0) return null;

    // Deducted from platform flat commission (KSh 10)
    const { rows: inserted } = await client.query(
      `INSERT INTO creator_referral_earnings
         (referrer_creator_id, referred_seller_id, order_id, amount, units_sold)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id`,
      [referrerId, sellerId, order.id, amount, units]
    );

    if (!inserted.length) return null;

    await client.query(
      `UPDATE creators
       SET balance = balance + $1,
           total_referral_earnings = total_referral_earnings + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, referrerId]
    );

    logger.info(
      `[CreatorService] Credited creator ${referrerId} KES ${amount} (deducted from platform flat fee KES ${Fees.PLATFORM_COMMISSION_AMOUNT || 10}) for seller ${sellerId} referral on Order ${order.id}`
    );

    const { rows: referrerRows } = await client.query(
      `SELECT user_id FROM creators WHERE id = $1 LIMIT 1`,
      [referrerId]
    );
    if (referrerRows[0]?.user_id) {
      const amountText = Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const orderRef = order.order_number || order.orderNumber || ('#' + order.id);
      notificationService.send({
        recipientUserId: referrerRows[0].user_id,
        recipientRole: 'creator',
        type: 'creator_referral',
        title: 'Referral Reward: KSh ' + amountText,
        body: 'You earned a referral reward from a referred seller sale on order ' + orderRef + '.',
        data: { path: '/creator/dashboard', orderId: order.id },
        channels: ['in_app', 'push']
      }).catch((error) => logger.warn('[Feed] creator referral notification failed', { referrerId, error: error.message }));
    }

    return inserted[0];
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

  static async getCreatorClearance(creatorId) {
    const { rows: creatorRows } = await pool.query(
      `SELECT id, balance, withdrawal_reserved_balance, first_name, last_name, mpesa_number FROM creators WHERE id = $1`,
      [creatorId]
    );
    const creator = creatorRows[0];
    if (!creator) return null;

    const totalBalance = Number.parseFloat(creator.balance || 0);

    // FIX (self-referral review-hold follow-up): an earning flagged by the
    // post-hoc self-dealing check in creditCreatorForOrder must never clear
    // just because 2 business days passed — it stays uncleared until an
    // admin resolves it via resolveFlaggedEarning. See computeClearance.
    const toEarning = (e) => ({
      amount: Number.parseFloat(e.amount || 0),
      createdAt: new Date(e.created_at),
      flaggedForReview: (e.metadata || {}).flagged_for_review === true
    });

    // Load recent sales + referral earnings for clearance. Tolerate a database
    // that predates the creator_referral_earnings.metadata migration
    // (20260905130000): on undefined_column (Postgres SQLSTATE 42703) retry
    // without the metadata column and treat those rows as unflagged, so schema
    // drift degrades gracefully instead of 500-ing the entire creator
    // dashboard. Self-heals once the migration is applied — the durable fix is
    // running `npm run migrate` against the affected database.
    const loadEarnings = async (columns) => {
      const [salesEarningsResult, referralEarningsResult] = await Promise.all([
        pool.query(
          `SELECT ${columns}
           FROM creator_earnings
           WHERE creator_id = $1
             AND status = 'credited'
           ORDER BY created_at DESC
           LIMIT 50`,
          [creatorId]
        ),
        pool.query(
          `SELECT ${columns}
           FROM creator_referral_earnings
           WHERE referrer_creator_id = $1
             AND status = 'credited'
           ORDER BY created_at DESC
           LIMIT 50`,
          [creatorId]
        )
      ]);
      return [
        ...salesEarningsResult.rows.map(toEarning),
        ...referralEarningsResult.rows.map(toEarning)
      ];
    };

    let allEarnings;
    try {
      allEarnings = await loadEarnings('id, amount, created_at, metadata');
    } catch (err) {
      if (err && err.code === '42703') {
        allEarnings = await loadEarnings('id, amount, created_at');
      } else {
        throw err;
      }
    }

    const { availableBalance, clearingBalance, flaggedAmount, hasFlaggedHolds, nextAvailableAt, isClearing } =
      computeClearance({ totalBalance, earnings: allEarnings });

    // Split lifetime earnings by source so the withdrawal panel can show
    // commission (sales) vs invited-business (referral) streams separately.
    // SUM over all active rows (not the 50-row clearance sample), net of any
    // reversed/cancelled earnings.
    const [commissionSumRes, referralSumRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::float8 AS s
           FROM creator_earnings WHERE creator_id = $1 AND status = 'credited'`,
        [creatorId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::float8 AS s
           FROM creator_referral_earnings WHERE referrer_creator_id = $1 AND status = 'credited'`,
        [creatorId]
      )
    ]).catch(() => [{ rows: [{ s: 0 }] }, { rows: [{ s: 0 }] }]);
    const commissionEarnings = roundMoney(Number(commissionSumRes.rows[0].s));
    const referralEarnings = roundMoney(Number(referralSumRes.rows[0].s));

    return {
      totalBalance,
      availableBalance,
      clearingBalance,
      flaggedAmount,
      hasFlaggedHolds,
      nextAvailableAt,
      isClearing,
      commissionEarnings,
      referralEarnings
    };
  }

  /**
   * Admin queue of creator earnings held for self-dealing review (see
   * _detectPostHocSelfDealing / creditCreatorForOrder). Never exposed to the
   * creator or buyer — admin-only, by design.
   */
  static async listFlaggedEarnings({ limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200);

    const [salesRows, referralRows] = await Promise.all([
      pool.query(
        `SELECT ce.id, 'sales' AS earning_type, ce.creator_id, ce.order_id, ce.amount,
                ce.created_at, ce.metadata, ce.status,
                CONCAT_WS(' ', c.first_name, c.last_name) AS creator_name,
                po.order_number, po.buyer_id
         FROM creator_earnings ce
         JOIN creators c ON c.id = ce.creator_id
         JOIN product_orders po ON po.id = ce.order_id
         WHERE ce.metadata->>'flagged_for_review' = 'true'
         ORDER BY ce.created_at DESC
         LIMIT $1`,
        [safeLimit]
      ),
      pool.query(
        `SELECT cre.id, 'referral' AS earning_type, cre.referrer_creator_id AS creator_id, cre.order_id, cre.amount,
                cre.created_at, cre.metadata, cre.status,
                CONCAT_WS(' ', c.first_name, c.last_name) AS creator_name,
                po.order_number, po.buyer_id
         FROM creator_referral_earnings cre
         JOIN creators c ON c.id = cre.referrer_creator_id
         JOIN product_orders po ON po.id = cre.order_id
         WHERE cre.metadata->>'flagged_for_review' = 'true'
         ORDER BY cre.created_at DESC
         LIMIT $1`,
        [safeLimit]
      )
    ]);

    return [...salesRows.rows, ...referralRows.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, safeLimit);
  }

  /**
   * Reverse exactly one earning row's balance impact — NOT the whole order.
   *
   * settlementService.reverseCreatorEarningsForRefund reverses every earning
   * type tied to an order_id at once, which is correct for a full-order
   * refund but wrong here: an admin resolving ONE flagged sales-commission
   * row must not also reverse an unrelated creator-refers-seller reward that
   * happens to share the same order_id. Mirrors the same balance-safe
   * pattern (lock, compare, decrement-or-record-deficit) scoped to one row.
   */
  static async _reverseSingleEarning(client, { table, creatorIdColumn, totalsColumn, earning }, source) {
    const amount = Number.parseFloat(earning.amount || 0);
    if (!(amount > 0)) {
      return { adjusted: false, reason: 'invalid_amount' };
    }

    const creatorId = earning[creatorIdColumn];
    const { rows: creatorRows } = await client.query(
      `SELECT id, balance FROM creators WHERE id = $1 FOR UPDATE`,
      [creatorId]
    );
    if (!creatorRows.length) {
      return { adjusted: false, reason: 'creator_not_found' };
    }

    const currentBalance = Number.parseFloat(creatorRows[0].balance || 0);
    if (currentBalance >= amount) {
      await client.query(
        `UPDATE creators
         SET balance = balance - $1,
             ${totalsColumn} = GREATEST(${totalsColumn} - $1, 0),
             updated_at = NOW()
         WHERE id = $2`,
        [amount, creatorId]
      );
      await client.query(
        `UPDATE ${table} SET status = 'reversed' WHERE id = $1`,
        [earning.id]
      );
      return { adjusted: true, amount, creatorId };
    }

    // Already withdrawn (or otherwise insufficient) — record the deficit
    // instead of taking the creator's balance negative.
    await client.query(
      `UPDATE ${table} SET status = 'reversal_compensation_required' WHERE id = $1`,
      [earning.id]
    );
    logger.error(`[CreatorService] Admin reversal deficit for ${table} ${earning.id}: creator ${creatorId} balance insufficient`, {
      source,
      shortfall: amount - currentBalance
    });
    return { adjusted: false, reason: 'creator_balance_insufficient', shortfall: amount - currentBalance, creatorId };
  }

  /**
   * Admin resolution of a flagged earning.
   *   action: 'release' — reviewed and found legitimate; clears the flag so
   *           the earning becomes subject to the normal T+2 rule again (and
   *           immediately available if that window has already elapsed).
   *   action: 'reverse' — confirmed self-dealing; claws back this SPECIFIC
   *           earning only (see _reverseSingleEarning), so a creator who
   *           already withdrew the money gets a recorded deficit instead of
   *           a silent write-off, without touching any unrelated earning
   *           that happens to share the same order.
   */
  static async resolveFlaggedEarning({ earningType, earningId, adminId, action, notes = null }) {
    if (!['sales', 'referral'].includes(earningType)) {
      throw new AppError("earningType must be 'sales' or 'referral'.", 400);
    }
    if (!['release', 'reverse'].includes(action)) {
      throw new AppError("action must be 'release' or 'reverse'.", 400);
    }

    const table = earningType === 'sales' ? 'creator_earnings' : 'creator_referral_earnings';
    const creatorIdColumn = earningType === 'sales' ? 'creator_id' : 'referrer_creator_id';
    const totalsColumn = earningType === 'sales' ? 'total_earnings' : 'total_referral_earnings';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT id, order_id, amount, metadata, status, ${creatorIdColumn} FROM ${table} WHERE id = $1 FOR UPDATE`,
        [earningId]
      );
      const earning = rows[0];
      if (!earning) {
        throw new AppError('Flagged earning not found.', 404);
      }
      if ((earning.metadata || {}).flagged_for_review !== true) {
        throw new AppError('This earning is not currently flagged for review.', 400);
      }
      if (earning.status === 'reversed' || earning.status === 'reversal_compensation_required') {
        throw new AppError(`This earning is already ${earning.status}.`, 400);
      }

      let reversalResult = null;
      if (action === 'reverse') {
        reversalResult = await this._reverseSingleEarning(
          client,
          { table, creatorIdColumn, totalsColumn, earning },
          'admin_self_referral_review'
        );
      }

      const resolutionMetadata = {
        review_resolution: action === 'release' ? 'released' : 'reversed',
        reviewed_by: adminId || null,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        // Clear the hold either way — a reversed row is already excluded
        // from clearance by its own 'reversed'/'reversal_compensation_required'
        // status, so it doesn't need the indefinite hold on top of that.
        flagged_for_review: false
      };

      await client.query(
        `UPDATE ${table}
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
         WHERE id = $1`,
        [earningId, JSON.stringify(resolutionMetadata)]
      );

      await client.query('COMMIT');

      logger.info(`[CreatorService] Admin ${adminId} resolved flagged ${earningType} earning ${earningId}: ${action}`, {
        earningId,
        earningType,
        orderId: earning.order_id,
        action
      });

      return { earningId, earningType, action, reversalResult };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getDashboard(creatorId, period = 'monthly') {
    const analysisPeriod = this.getAnalysisPeriod(period);
    const [creatorRowsResult, clearance] = await Promise.all([
      pool.query(`SELECT * FROM creators WHERE id = $1`, [creatorId]),
      this.getCreatorClearance(creatorId)
    ]);
    const creator = creatorRowsResult.rows[0];
    if (!creator) throw new Error('Creator profile not found.');

    const { rows: shops } = await pool.query(
      `SELECT scl.id,
              scl.seller_id,
              scl.code,
              scl.commission_rate,
              scl.status,
              scl.click_count,
              s.shop_name,
              s.slug,
              s.avatar_url,
              s.full_name AS seller_name,
              COUNT(ce.id) AS sales_count,
              COALESCE(SUM(ce.amount), 0) AS earnings
       FROM seller_creator_links scl
       JOIN sellers s ON s.id = scl.seller_id
       LEFT JOIN creator_earnings ce ON ce.seller_creator_link_id = scl.id
       WHERE scl.creator_id = $1
         AND scl.status = 'active'
       GROUP BY scl.id, scl.seller_id, s.shop_name, s.slug, s.avatar_url, s.full_name
       ORDER BY scl.created_at DESC`,
      [creatorId]
    );

    const { rows: shopRequests } = await pool.query(
      `SELECT sci.id,
              sci.email,
              sci.status,
              sci.created_at,
              sci.expires_at,
              s.shop_name,
              s.full_name AS seller_name
       FROM seller_creator_invites sci
       JOIN sellers s ON s.id = sci.seller_id
       WHERE sci.accepted_creator_id = $1
         AND sci.status = 'pending'
       ORDER BY sci.created_at DESC`,
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
              SUM(commission_earnings)::numeric AS commission_earnings,
              SUM(referral_earnings)::numeric AS referral_earnings,
              (SUM(commission_earnings) + SUM(referral_earnings))::numeric AS earnings,
              SUM(clicks)::int AS clicks
       FROM (
         SELECT DATE_TRUNC('${analysisPeriod.unit}', ce.created_at) AS period_start,
                COUNT(*) AS sales_count,
                COALESCE(SUM(po.total_amount), 0) AS sales_value,
                COALESCE(SUM(ce.amount), 0) AS commission_earnings,
                0 AS referral_earnings,
                0 AS clicks
         FROM creator_earnings ce
         JOIN product_orders po ON po.id = ce.order_id
         WHERE ce.creator_id = $1
           AND ce.status = 'credited'
           AND ce.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', ce.created_at)
         UNION ALL
         SELECT DATE_TRUNC('${analysisPeriod.unit}', cre.created_at) AS period_start,
                0 AS sales_count,
                0 AS sales_value,
                0 AS commission_earnings,
                COALESCE(SUM(cre.amount), 0) AS referral_earnings,
                0 AS clicks
         FROM creator_referral_earnings cre
         WHERE cre.referrer_creator_id = $1
           AND cre.status = 'credited'
           AND cre.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', cre.created_at)
         UNION ALL
         SELECT DATE_TRUNC('${analysisPeriod.unit}', clc.created_at) AS period_start,
                0 AS sales_count,
                0 AS sales_value,
                0 AS commission_earnings,
                0 AS referral_earnings,
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

    // Per-business referral (invited-business) earnings over the same periods,
    // so the "how you're doing" business graph can switch between individual
    // invited businesses (or all) within one line chart.
    const { rows: businessEarnings } = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('${analysisPeriod.unit}', cre.created_at), $2) AS period,
              DATE_TRUNC('${analysisPeriod.unit}', cre.created_at) AS period_start,
              cre.referred_seller_id AS seller_id,
              s.shop_name,
              SUM(cre.amount)::numeric AS earnings
       FROM creator_referral_earnings cre
       JOIN sellers s ON s.id = cre.referred_seller_id
       WHERE cre.referrer_creator_id = $1
         AND cre.status = 'credited'
         AND cre.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
       GROUP BY period_start, cre.referred_seller_id, s.shop_name
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

    const { rows: withdrawals } = await WithdrawalService.getWithdrawalsForCreator(creatorId, { limit: 10 });

    return {
      creator,
      clearance,
      shops,
      shopRequests,
      earnings,
      analysis,
      businessEarnings,
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
    const clearance = await this.getCreatorClearance(creatorId);
    const withdrawalAmount = Number.parseFloat(amount);
    const withdrawalFee = Fees.calculateWithdrawalFee(withdrawalAmount);
    const totalDeducted = withdrawalAmount + withdrawalFee;

    if (clearance && totalDeducted > clearance.availableBalance) {
      if (clearance.isClearing && totalDeducted <= clearance.totalBalance) {
        const nextDateStr = clearance.nextAvailableAt
          ? new Date(clearance.nextAvailableAt).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          : 'soon';
        const error = new Error(
          `Your withdrawal of KES ${withdrawalAmount.toLocaleString()} requires KES ${totalDeducted.toLocaleString()} from your balance (including KES ${withdrawalFee} withdrawal charge). KES ${clearance.clearingBalance.toLocaleString()} is currently clearing under the standard T+2 holding period and will be ready for withdrawal on ${nextDateStr}.`
        );
        error.statusCode = 400;
        throw error;
      }
      const error = new Error(
        `Insufficient available balance. Available: KES ${clearance.availableBalance.toLocaleString()}, Required: KES ${totalDeducted.toLocaleString()} (including KES ${withdrawalFee} withdrawal charge).`
      );
      error.statusCode = 400;
      throw error;
    }

    return WithdrawalService.createWithdrawalRequest({
      entityId: creatorId,
      entityType: 'creator',
      amount,
      idempotencyKey
    });
  }

  static async getAvailableShops(creatorId) {
    const { rows } = await pool.query(
      `SELECT s.id,
              s.shop_name,
              s.slug,
              s.avatar_url,
              s.bio,
              s.location,
              s.physical_address,
              s.creator_commission_rate,
              s.theme,
              COALESCE(p_count.total_products, 0) AS product_count,
              COALESCE(scl.status, csr.status, 'none') AS collaboration_status,
              scl.code AS link_code
       FROM sellers s
       LEFT JOIN (
         SELECT seller_id, COUNT(id) AS total_products
         FROM products
         WHERE status = 'available'
         GROUP BY seller_id
       ) p_count ON p_count.seller_id = s.id
       LEFT JOIN seller_creator_links scl
         ON scl.seller_id = s.id AND scl.creator_id = $1 AND scl.status = 'active'
       LEFT JOIN creator_shop_requests csr
         ON csr.seller_id = s.id AND csr.creator_id = $1
       WHERE s.is_creator_marketplace_enabled = TRUE
         AND (s.status IS NULL OR s.status != 'deleted')
         -- Dedupe: shops the creator is already actively promoting are shown in
         -- the "Your links" section, so keep them out of the browse list.
         AND scl.id IS NULL
       ORDER BY s.updated_at DESC, s.id DESC`,
      [creatorId]
    );

    return rows.map((r) => ({
      id: r.id,
      shopName: r.shop_name,
      slug: r.slug || r.shop_name,
      logoUrl: r.avatar_url,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      location: r.location,
      physicalAddress: r.physical_address,
      creatorCommissionRate: Number(r.creator_commission_rate || 0.01),
      productCount: Number(r.product_count || 0),
      theme: r.theme || 'default',
      collaborationStatus: r.collaboration_status,
      linkCode: r.link_code || null
    }));
  }

  static async requestCollaboration(creatorId, sellerId, message = '') {
    const sellerResult = await pool.query(
      `SELECT id, shop_name, user_id, is_creator_marketplace_enabled, creator_commission_rate
       FROM sellers
       WHERE id = $1 AND (status IS NULL OR status != 'deleted')
       LIMIT 1`,
      [sellerId]
    );
    const seller = sellerResult.rows[0];
    if (!seller) throw new AppError('Seller shop not found.', 404);
    if (!seller.is_creator_marketplace_enabled) {
      throw new AppError('This shop is not currently accepting creator collaboration requests.', 400);
    }

    const activeLink = await pool.query(
      `SELECT id, code FROM seller_creator_links WHERE seller_id = $1 AND creator_id = $2 AND status = 'active' LIMIT 1`,
      [sellerId, creatorId]
    );
    if (activeLink.rows[0]) {
      throw new AppError('You already have an active collaboration link for this shop.', 400);
    }

    const activePromotions = await countActivePromotions(pool, creatorId, sellerId);
    if (activePromotions >= MAX_ACTIVE_PROMOTIONS) {
      throw new AppError(`You can promote at most ${MAX_ACTIVE_PROMOTIONS} shops at once. Leave one before requesting another.`, 400);
    }

    const { rows } = await pool.query(
      `INSERT INTO creator_shop_requests (creator_id, seller_id, status, message, updated_at)
       VALUES ($1, $2, 'pending', $3, NOW())
       ON CONFLICT (creator_id, seller_id)
       DO UPDATE SET status = 'pending', message = EXCLUDED.message, updated_at = NOW()
       RETURNING *`,
      [creatorId, sellerId, String(message || '').trim() || null]
    );

    // Notify seller
    const creatorResult = await pool.query(
      `SELECT id, first_name, last_name, email FROM creators WHERE id = $1 LIMIT 1`,
      [creatorId]
    );
    const creator = creatorResult.rows[0];
    const creatorName = creator ? `${creator.first_name} ${creator.last_name || ''}`.trim() : 'A creator';

    if (seller.user_id) {
      notificationService.send({
        recipientUserId: seller.user_id,
        recipientRole: 'seller',
        type: 'creator_collaboration_request',
        title: 'New Creator Request',
        body: `${creatorName} requested to promote your shop on commission. Review their request in your Creators tab.`,
        data: { path: '/seller/dashboard?tab=creators', requestId: rows[0].id },
        channels: ['in_app', 'push']
      }).catch((err) => logger.warn('[Feed] Seller creator collaboration notification failed', { sellerId, error: err.message }));
    }

    return rows[0];
  }

  static async getSellerCreatorsDashboard(sellerId) {
    const sellerResult = await pool.query(
      `SELECT id, shop_name, slug, is_creator_marketplace_enabled, creator_commission_rate
       FROM sellers WHERE id = $1 LIMIT 1`,
      [sellerId]
    );
    const seller = sellerResult.rows[0];
    if (!seller) throw new AppError('Seller not found', 404);

    // Incoming pending requests from creators
    const { rows: incomingRequests } = await pool.query(
      `SELECT csr.id,
              csr.status,
              csr.message,
              csr.created_at,
              c.id AS creator_id,
              c.first_name,
              c.last_name,
              c.email,
              c.mpesa_number,
              c.whatsapp_number,
              c.instagram_link,
              c.tiktok_link
       FROM creator_shop_requests csr
       JOIN creators c ON c.id = csr.creator_id
       WHERE csr.seller_id = $1 AND csr.status = 'pending'
       ORDER BY csr.created_at DESC`,
      [sellerId]
    );

    // Active collaborating creators
    const { rows: activeCreators } = await pool.query(
      `SELECT scl.id,
              scl.code,
              scl.commission_rate,
              scl.status,
              scl.created_at,
              scl.click_count,
              c.id AS creator_id,
              c.first_name,
              c.last_name,
              c.email,
              c.whatsapp_number,
              c.instagram_link,
              c.tiktok_link,
              COUNT(DISTINCT ce.id) AS sales_count,
              COALESCE(SUM(ce.amount), 0) AS earnings_paid,
              COALESCE(SUM(ce.base_amount), 0) AS revenue_generated
       FROM seller_creator_links scl
       JOIN creators c ON c.id = scl.creator_id
       LEFT JOIN creator_earnings ce ON ce.seller_creator_link_id = scl.id
       WHERE scl.seller_id = $1 AND scl.status = 'active'
       GROUP BY scl.id, c.id
       ORDER BY scl.created_at DESC`,
      [sellerId]
    );

    // Direct invites
    const manualInvites = await this.listSellerInvites(sellerId);

    const baseUrl = process.env.FRONTEND_URL || '';
    const slug = seller.slug || seller.shop_name;

    return {
      isCreatorMarketplaceEnabled: Boolean(seller.is_creator_marketplace_enabled),
      creatorCommissionRate: Number(seller.creator_commission_rate || 0.01),
      incomingRequests: incomingRequests.map((r) => ({
        id: r.id,
        creatorId: r.creator_id,
        creatorName: `${r.first_name} ${r.last_name || ''}`.trim(),
        email: r.email,
        whatsappNumber: r.whatsapp_number || r.mpesa_number,
        instagramLink: r.instagram_link || null,
        tiktokLink: r.tiktok_link || null,
        message: r.message,
        createdAt: r.created_at,
        status: r.status
      })),
      activeCreators: activeCreators.map((a) => ({
        id: a.id,
        creatorId: a.creator_id,
        creatorName: `${a.first_name} ${a.last_name || ''}`.trim(),
        email: a.email,
        whatsappNumber: a.whatsapp_number,
        instagramLink: a.instagram_link || null,
        tiktokLink: a.tiktok_link || null,
        code: a.code,
        commissionRate: Number(a.commission_rate),
        clickCount: Number(a.click_count || 0),
        salesCount: Number(a.sales_count || 0),
        revenueGenerated: Number(a.revenue_generated || 0),
        earningsPaid: Number(a.earnings_paid || 0),
        createdAt: a.created_at,
        shopUrl: `${baseUrl}/${slug}?creator=${a.code}`
      })),
      manualInvites
    };
  }

  static async updateSellerCreatorListing(sellerId, { isCreatorMarketplaceEnabled, creatorCommissionRate }) {
    const updates = [];
    const values = [sellerId];
    let paramIndex = 2;

    if (isCreatorMarketplaceEnabled !== undefined) {
      updates.push(`is_creator_marketplace_enabled = $${paramIndex++}`);
      values.push(Boolean(isCreatorMarketplaceEnabled));
    }

    if (creatorCommissionRate !== undefined) {
      const normalizedRate = normalizeCommissionRate(creatorCommissionRate);
      updates.push(`creator_commission_rate = $${paramIndex++}`);
      values.push(normalizedRate);
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = NOW()`);

    const { rows } = await pool.query(
      `UPDATE sellers
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING id, shop_name, is_creator_marketplace_enabled, creator_commission_rate`,
      values
    );

    return {
      isCreatorMarketplaceEnabled: Boolean(rows[0].is_creator_marketplace_enabled),
      creatorCommissionRate: Number(rows[0].creator_commission_rate)
    };
  }

  static async respondToCreatorCollaborationRequest(sellerId, requestId, action) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (!['accept', 'deny'].includes(normalizedAction)) {
      throw new AppError('Choose accept or deny.', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT csr.*, s.shop_name, s.slug, s.creator_commission_rate, c.user_id AS creator_user_id, c.first_name, c.last_name
         FROM creator_shop_requests csr
         JOIN sellers s ON s.id = csr.seller_id
         JOIN creators c ON c.id = csr.creator_id
         WHERE csr.id = $1 AND csr.seller_id = $2
         FOR UPDATE`,
        [requestId, sellerId]
      );
      const request = rows[0];
      if (!request) throw new AppError('Collaboration request not found.', 404);

      if (normalizedAction === 'deny') {
        await client.query(
          `UPDATE creator_shop_requests
           SET status = 'denied', updated_at = NOW()
           WHERE id = $1`,
          [requestId]
        );
        await client.query('COMMIT');
        return { status: 'denied', requestId };
      }

      // Action is 'accept'
      const activeCount = await countActivePromotions(client, request.creator_id, sellerId);
      if (activeCount >= MAX_ACTIVE_PROMOTIONS) {
        throw new AppError(`This creator is already promoting the maximum of ${MAX_ACTIVE_PROMOTIONS} shops. They must leave one before you can accept.`, 400);
      }

      const existingLink = await client.query(
        `SELECT id, code FROM seller_creator_links
         WHERE seller_id = $1 AND creator_id = $2
         LIMIT 1`,
        [sellerId, request.creator_id]
      );

      const code = existingLink.rows[0]?.code || await this.generateLinkCode(client);
      const commissionRate = normalizeCommissionRate(request.creator_commission_rate);

      await client.query(
        `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (seller_id, creator_id)
         DO UPDATE SET commission_rate = EXCLUDED.commission_rate,
                       status = 'active',
                       updated_at = NOW()
         RETURNING *`,
        [sellerId, request.creator_id, code, commissionRate]
      );

      await client.query(
        `UPDATE creator_shop_requests
         SET status = 'accepted', updated_at = NOW()
         WHERE id = $1`,
        [requestId]
      );

      await client.query('COMMIT');

      // Notify creator
      if (request.creator_user_id) {
        notificationService.send({
          recipientUserId: request.creator_user_id,
          recipientRole: 'creator',
          type: 'creator_request_accepted',
          title: 'Collaboration Approved!',
          body: `${request.shop_name} accepted your collaboration request. Your tracking link is ready in "Your links"!`,
          data: { path: '/creator/dashboard', code },
          channels: ['in_app', 'push']
        }).catch((err) => logger.warn('[Feed] Creator collaboration acceptance notification failed', { error: err.message }));
      }

      const baseUrl = process.env.FRONTEND_URL || '';
      const slug = request.slug || request.shop_name;

      return {
        status: 'accepted',
        requestId,
        code,
        shopUrl: `${baseUrl}/${slug}?creator=${code}`
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateProfile(creatorId, updates = {}) {
    const fields = [];
    const values = [creatorId];
    let idx = 2;

    if (updates.instagramLink !== undefined) {
      fields.push(`instagram_link = $${idx++}`);
      values.push(updates.instagramLink ? String(updates.instagramLink).trim() : null);
    }
    if (updates.tiktokLink !== undefined) {
      fields.push(`tiktok_link = $${idx++}`);
      values.push(updates.tiktokLink ? String(updates.tiktokLink).trim() : null);
    }
    if (updates.whatsappNumber !== undefined) {
      const raw = updates.whatsappNumber ? String(updates.whatsappNumber).trim() : '';
      if (raw && !normalizeKenyanPhone(raw)) {
        throw new AppError('Enter a valid WhatsApp number (e.g. 0712345678).', 400);
      }
      fields.push(`whatsapp_number = $${idx++}`);
      values.push(raw ? normalizeKenyanPhone(raw) : null);
    }
    if (updates.mpesaNumber !== undefined) {
      const raw = updates.mpesaNumber ? String(updates.mpesaNumber).trim() : '';
      // The M-Pesa number receives real payouts, so require a valid KE mobile.
      // Clearing it (null) is disallowed — a creator always needs a payout number.
      const normalized = normalizeKenyanPhone(raw);
      if (!normalized) {
        throw new AppError('Enter a valid M-Pesa number (e.g. 0712345678).', 400);
      }
      fields.push(`mpesa_number = $${idx++}`);
      values.push(normalized);
    }

    if (fields.length === 0) {
      const { rows } = await pool.query('SELECT * FROM creators WHERE id = $1', [creatorId]);
      return rows[0];
    }

    fields.push(`updated_at = NOW()`);
    const { rows } = await pool.query(
      `UPDATE creators SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return rows[0];
  }
}

export { CreatorService };
export default CreatorService;
