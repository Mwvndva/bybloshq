import { pool } from '../config/database.js';

class ReferralEarningsLog {
    static async insert(client, data) {
        const query = `
            INSERT INTO referral_earnings_log (
                referrer_seller_id, referred_seller_id, period_month, period_year, 
                referred_gmv, reward_amount, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (referrer_seller_id, referred_seller_id, period_month, period_year) DO NOTHING
            RETURNING *
        `;
        const values = [
            data.referrer_seller_id,
            data.referred_seller_id,
            data.period_month,
            data.period_year,
            data.referred_gmv,
            data.reward_amount
        ];
        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    static async findByReferrerId(referrerId) {
        const query = `
            SELECT
                s.id,
                s.shop_name,
                s.referral_active_until,
                COALESCE(SUM(rel.reward_amount), 0) AS total_earned
            FROM sellers s
            LEFT JOIN referral_earnings_log rel
                ON rel.referred_seller_id = s.id AND rel.referrer_seller_id = $1
            WHERE s.referred_by_seller_id = $1
            GROUP BY s.id, s.shop_name, s.referral_active_until
            ORDER BY total_earned DESC
        `;
        const { rows } = await pool.query(query, [referrerId]);
        return rows;
    }
}

export default ReferralEarningsLog;
