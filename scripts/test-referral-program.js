// @ts-nocheck
'use strict';

import './env-loader.js';
import { pool } from '../server/src/config/database.js';
import ReferralService from '../server/src/services/referral.service.js';
import Fees from '../server/src/config/fees.js';
import { OrderStatus, PaymentStatus } from '../server/src/constants/enums.js';

const TEST_MARKER = '__byblos_ref_test';
let passed = 0;
let failed = 0;

async function runTests() {
    // Wait a tiny bit for env-loader to restore console if we are in production
    await new Promise(resolve => setTimeout(resolve, 10));
    console.log('🚀 Starting Referral Program Test Suite...');

    try {
        // --- TEST 1: Database Schema Validation ---
        console.log('\n--- TEST 1: Database Schema Validation ---');
        try {
            const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sellers' 
        AND column_name IN ('referral_code', 'referred_by_seller_id', 'referral_active_until', 'total_referral_earnings')
      `);

            // @ts-ignore
            const foundColumns = columnsResult.rows.map((r) => r.column_name);
            const expectedColumns = ['referral_code', 'referred_by_seller_id', 'referral_active_until', 'total_referral_earnings'];
            const missingColumns = expectedColumns.filter(c => !foundColumns.includes(c));

            const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'referral_earnings_log'
      `);

            if (missingColumns.length > 0) {
                throw new Error(`Missing columns in sellers table: ${missingColumns.join(', ')}`);
            }
            if (tablesResult.rows.length === 0) {
                throw new Error('Table referral_earnings_log is missing');
            }

            const logColumnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'referral_earnings_log'
      `);
            // @ts-ignore
            const foundLogCols = logColumnsResult.rows.map((r) => r.column_name);
            const expectedLogCols = ['referrer_seller_id', 'referred_seller_id', 'period_month', 'period_year', 'reward_amount', 'referred_gmv', 'credited_at'];
            const missingLogCols = expectedLogCols.filter(c => !foundLogCols.includes(c));

            if (missingLogCols.length > 0) {
                throw new Error(`Missing columns in referral_earnings_log: ${missingLogCols.join(', ')}`);
            }

            if (Fees.REFERRAL_REWARD_RATE !== 0.002) {
                throw new Error(`Fees.REFERRAL_REWARD_RATE is ${Fees.REFERRAL_REWARD_RATE}, expected 0.002`);
            }

            console.log(`✅ PASS: Database Schema Validation — Schema is correct.`);
            console.log(`📊 REFERRAL_REWARD_RATE = ${Fees.REFERRAL_REWARD_RATE}`);
            passed++;
        } catch (err) {
            console.log(`❌ FAIL: Database Schema Validation — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
            return; // Stop if schema is wrong
        }

        // --- TEST 2: Referral Code Generation ---
        console.log('\n--- TEST 2: Referral Code Generation ---');
        let referrer;
        try {
            // Create referrer
            const userRes = await pool.query(
                "INSERT INTO users (email, role, password_hash) VALUES ($1, 'seller', 'test_hash') RETURNING id",
                [`referrer${TEST_MARKER}@test.com`]
            );
            const sellerRes = await pool.query(
                "INSERT INTO sellers (user_id, shop_name, email, full_name, total_sales) VALUES ($1, $2, $3, $4, 0) RETURNING id",
                [userRes.rows[0].id, `TestRefShop${TEST_MARKER}`, `referrer${TEST_MARKER}@test.com`, 'Test Referrer']
            );
            referrer = sellerRes.rows[0];

            // Step 1: Locked state
            try {
                await ReferralService.generateReferralCode(referrer.id);
                console.log(`❌ FAIL: Referral Code Generation — Should have blocked generation for zero sales`);
                failed++;
            } catch (err) {
                console.log(`✅ PASS: Referral Code Generation — Correctly blocked for zero sales: ${(err instanceof Error ? err.message : String(err))}`);
                passed++;
            }

            // Step 2: Unlocked state
            await pool.query("UPDATE sellers SET total_sales = 5000 WHERE id = $1", [referrer.id]);
            const code = await ReferralService.generateReferralCode(referrer.id);

            if (!/^BY[A-Z0-9]{6}$/.test(code)) {
                throw new Error(`Invalid code format: ${code}`);
            }

            const verifyRes = await pool.query("SELECT referral_code FROM sellers WHERE id = $1", [referrer.id]);
            if (verifyRes.rows[0].referral_code !== code) {
                throw new Error('Code not saved in database correctly');
            }

            console.log(`✅ PASS: Referral Code Generation — Valid code generated and saved.`);
            console.log(`📊 Generated code: ${code}`);
            passed++;
            referrer.referral_code = code;
        } catch (err) {
            console.log(`❌ FAIL: Referral Code Generation — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
        }

        // --- TEST 3: Referral Link Format ---
        console.log('\n--- TEST 3: Referral Link Format ---');
        try {
            const link = ReferralService.getReferralLink(referrer.referral_code);
            const frontendUrl = process.env.FRONTEND_URL || '';

            if (!link.startsWith(frontendUrl)) {
                throw new Error(`Link does not start with FRONTEND_URL: ${link}`);
            }
            if (!link.includes(`?ref=${referrer.referral_code}`)) {
                throw new Error(`Link does not contain ?ref=${referrer.referral_code}`);
            }

            console.log(`✅ PASS: Referral Link Format — Correct format.`);
            console.log(`📊 Referral link: ${link}`);
            passed++;
        } catch (err) {
            console.log(`❌ FAIL: Referral Link Format — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
        }

        // --- TEST 4: New Seller Registration with Referral Code ---
        console.log('\n--- TEST 4: New Seller Registration with Referral Code ---');
        let referred;
        try {
            const uRes = await pool.query(
                "INSERT INTO users (email, role, password_hash) VALUES ($1, 'seller', 'test_hash') RETURNING id",
                [`referred${TEST_MARKER}@test.com`]
            );
            const sRes = await pool.query(
                "INSERT INTO sellers (user_id, shop_name, email, full_name, total_sales) VALUES ($1, $2, $3, $4, 0) RETURNING id",
                [uRes.rows[0].id, `TestReferredShop${TEST_MARKER}`, `referred${TEST_MARKER}@test.com`, 'Test Referred']
            );
            referred = sRes.rows[0];

            await ReferralService.applyReferral(referred.id, referrer.referral_code);

            const checkRes = await pool.query("SELECT referred_by_seller_id, referral_active_until FROM sellers WHERE id = $1", [referred.id]);
            if (parseInt(checkRes.rows[0].referred_by_seller_id) !== parseInt(referrer.id)) {
                throw new Error(`Expected referrer ID ${referrer.id}, got ${checkRes.rows[0].referred_by_seller_id}`);
            }
            if (checkRes.rows[0].referral_active_until !== null) {
                throw new Error('referral_active_until should be NULL before activation');
            }

            // Fake/Invalid code
            await ReferralService.applyReferral(referred.id, 'BYXXXXXX');
            const checkRes2 = await pool.query("SELECT referred_by_seller_id FROM sellers WHERE id = $1", [referred.id]);
            if (parseInt(checkRes2.rows[0].referred_by_seller_id) !== parseInt(referrer.id)) {
                throw new Error('referred_by_seller_id was incorrectly cleared or changed on invalid code application');
            }

            console.log(`✅ PASS: New Seller Registration — Correctly linked to referrer.`);
            passed++;
        } catch (err) {
            console.log(`❌ FAIL: New Seller Registration — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
        }

        // --- TEST 5: Referral Activation on First Sale ---
        console.log('\n--- TEST 5: Referral Activation on First Sale ---');
        try {
            // Note: ReferralService.activateReferral(orderId)
            // Let's create a dummy order for this seller.
            const orderRes = await pool.query(`
        INSERT INTO product_orders 
        (seller_id, order_number, total_amount, status, payment_status, platform_fee_amount, seller_payout_amount, buyer_name, buyer_email, buyer_mobile_payment, buyer_whatsapp_number)
        VALUES ($1, $2, 0, $3, $4, 0, 0, $5, $6, '0700000000', '0700000000') RETURNING id
      `, [referred.id, `ACTIVATE${TEST_MARKER}`, OrderStatus.COMPLETED, PaymentStatus.COMPLETED, 'Test Buyer Ref', `testbuyer${TEST_MARKER}@test.com`]);

            await ReferralService.activateReferral(orderRes.rows[0].id);

            const checkRes = await pool.query("SELECT referral_active_until FROM sellers WHERE id = $1", [referred.id]);
            const date = new Date(checkRes.rows[0].referral_active_until);
            const expected = new Date();
            expected.setMonth(expected.getMonth() + 6);

            // Diff in seconds
            const diff = Math.abs(date.getTime() - expected.getTime()) / 1000;
            if (diff > 60) {
                throw new Error(`Stored date ${date} too far from expected ${expected} (diff: ${diff}s)`);
            }

            console.log(`✅ PASS: Referral Activation — Activated for 6 months.`);
            console.log(`📊 Referral active until: ${date.toISOString()}`);
            passed++;

            // Idempotency check
            const originalDate = checkRes.rows[0].referral_active_until;
            await ReferralService.activateReferral(orderRes.rows[0].id);
            const checkRes2 = await pool.query("SELECT referral_active_until FROM sellers WHERE id = $1", [referred.id]);
            if (new Date(checkRes2.rows[0].referral_active_until).getTime() !== new Date(originalDate).getTime()) {
                throw new Error('referral_active_until was reset on second activation call');
            }
            console.log(`✅ PASS: Activation Idempotency — Date remained unchanged.`);
            passed++;
        } catch (err) {
            console.log(`❌ FAIL: Referral Activation — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
        }

        // --- TEST 6: Monthly Reward Calculation ---
        console.log('\n--- TEST 6: Monthly Reward Calculation ---');
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

            // Insert fake orders
            const orderAmounts = [10000, 15000, 25000];
            for (let i = 0; i < orderAmounts.length; i++) {
                await pool.query(`
          INSERT INTO product_orders 
          (seller_id, order_number, total_amount, status, payment_status, paid_at, buyer_name, buyer_email, platform_fee_amount, seller_payout_amount, buyer_mobile_payment, buyer_whatsapp_number)
          VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, 0, 0, '0700000000', '0700000000')
        `, [referred.id, `ORDER-00${i + 1}${TEST_MARKER}`, orderAmounts[i], OrderStatus.COMPLETED, PaymentStatus.COMPLETED, 'Test Buyer Ref', `testbuyer${TEST_MARKER}@test.com`]);
            }

            await ReferralService.processMonthlyReferralRewards(year, month);

            const logRes = await pool.query(`
        SELECT * FROM referral_earnings_log 
        WHERE referrer_seller_id = $1 AND referred_seller_id = $2 AND period_month = $3 AND period_year = $4
      `, [referrer.id, referred.id, month, year]);

            if (logRes.rows.length !== 1) {
                throw new Error(`Expected 1 log entry, found ${logRes.rows.length}`);
            }

            const log = logRes.rows[0];
            if (parseFloat(log.referred_gmv) !== 50000) {
                throw new Error(`Expected GMV 50000, got ${log.referred_gmv}`);
            }

            const expectedReward = 50000 * Fees.REFERRAL_REWARD_RATE;
            if (parseFloat(log.reward_amount) !== expectedReward) {
                throw new Error(`Expected reward ${expectedReward}, got ${log.reward_amount}`);
            }

            const refCheck = await pool.query("SELECT balance, total_referral_earnings FROM sellers WHERE id = $1", [referrer.id]);
            if (parseFloat(refCheck.rows[0].total_referral_earnings) !== expectedReward) {
                throw new Error(`Expected total_referral_earnings ${expectedReward}, got ${refCheck.rows[0].total_referral_earnings}`);
            }

            console.log(`✅ PASS: Monthly Reward Calculation — Reward processed correctly.`);
            console.log(`📊 Referrer balance after reward: ${refCheck.rows[0].balance} KES`);
            console.log(`📊 Total referral earnings: ${refCheck.rows[0].total_referral_earnings} KES`);
            passed++;
        } catch (err) {
            console.log(`❌ FAIL: Monthly Reward Calculation — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
        }

        // --- TEST 7: Idempotency (No Double Credit) ---
        console.log('\n--- TEST 7: Idempotency (No Double Credit) ---');
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

            const preCheck = await pool.query("SELECT balance FROM sellers WHERE id = $1", [referrer.id]);
            const initialBalance = parseFloat(preCheck.rows[0].balance);

            await ReferralService.processMonthlyReferralRewards(year, month);

            const countRes = await pool.query(`
        SELECT COUNT(*) FROM referral_earnings_log 
        WHERE referrer_seller_id = $1 AND referred_seller_id = $2 AND period_month = $3 AND period_year = $4
      `, [referrer.id, referred.id, month, year]);

            if (parseInt(countRes.rows[0].count) !== 1) {
                throw new Error(`Expected 1 log entry on re-run, found ${countRes.rows[0].count}`);
            }

            const postCheck = await pool.query("SELECT balance FROM sellers WHERE id = $1", [referrer.id]);
            if (parseFloat(postCheck.rows[0].balance) !== initialBalance) {
                throw new Error('Balance increased on second reward processing call for same month');
            }

            console.log(`✅ PASS: Idempotency confirmed — no double credit on re-run.`);
            passed++;
        } catch (err) {
            console.log(`❌ FAIL: Idempotency — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
        }

        // --- TEST 8: Expired Referral Not Rewarded ---
        console.log('\n--- TEST 8: Expired Referral Not Rewarded ---');
        try {
            await pool.query("UPDATE sellers SET referral_active_until = NOW() - INTERVAL '1 day' WHERE id = $1", [referred.id]);

            // Insert order for "next" period
            const nextDate = new Date();
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextMonth = nextDate.getMonth() + 1;
            const nextYear = nextDate.getFullYear();

            await pool.query(`
        INSERT INTO product_orders 
        (seller_id, order_number, total_amount, status, payment_status, paid_at, buyer_name, buyer_email, platform_fee_amount, seller_payout_amount, buyer_mobile_payment, buyer_whatsapp_number)
        VALUES ($1, $2, 20000, $3, $4, NOW(), $5, $6, 0, 0, '0700000000', '0700000000')
      `, [referred.id, `EXPIRED-ORDER${TEST_MARKER}`, OrderStatus.COMPLETED, PaymentStatus.COMPLETED, 'Test Buyer Ref', `testbuyer${TEST_MARKER}@test.com`]);

            const preCheck = await pool.query("SELECT balance FROM sellers WHERE id = $1", [referrer.id]);
            const initialBalance = parseFloat(preCheck.rows[0].balance);

            await ReferralService.processMonthlyReferralRewards(nextYear, nextMonth);

            const logRes = await pool.query(`
        SELECT * FROM referral_earnings_log 
        WHERE referrer_seller_id = $1 AND referred_seller_id = $2 AND period_month = $3 AND period_year = $4
      `, [referrer.id, referred.id, nextMonth, nextYear]);

            if (logRes.rows.length > 0) {
                throw new Error('Row was created for an expired referral');
            }

            const postCheck = await pool.query("SELECT balance FROM sellers WHERE id = $1", [referrer.id]);
            if (parseFloat(postCheck.rows[0].balance) !== initialBalance) {
                throw new Error('Balance increased for an expired referral');
            }

            console.log(`✅ PASS: Expired referral correctly excluded from rewards.`);
            passed++;
        } catch (err) {
            console.log(`❌ FAIL: Expired Referral — ${(err instanceof Error ? err.message : String(err))}`);
            failed++;
        }

    } finally {
        console.log('\n🧹 Cleaning up test data...');
        try {
            await pool.query("DELETE FROM referral_earnings_log WHERE referrer_seller_id IN (SELECT id FROM sellers WHERE email LIKE $1)", [`%${TEST_MARKER}%`]);
            await pool.query("DELETE FROM product_orders WHERE order_number LIKE $1 OR seller_id IN (SELECT id FROM sellers WHERE email LIKE $1)", [`%${TEST_MARKER}%`]);
            await pool.query("DELETE FROM sellers WHERE email LIKE $1", [`%${TEST_MARKER}%`]);
            await pool.query("DELETE FROM users WHERE email LIKE $1", [`%${TEST_MARKER}%`]);
            console.log('🧹 Cleanup complete.');
        } catch (e) {
            console.error('❌ Error during cleanup:', (e instanceof Error ? e.message : String(e)));
        }

        console.log('\n--- FINAL SUMMARY ---');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`🚀 Total: ${passed + failed}`);

        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
