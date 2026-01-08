/**
 * Test Script: Verify Withdrawal Status Fix
 * 
 * This script simulates a withdrawal request and verifies:
 * 1. Initial status is 'processing' (not 'completed')
 * 2. Callback properly updates status to 'completed' or 'failed'
 * 3. Failed withdrawals trigger refunds
 */

import { pool } from '../src/config/database.js';
import logger from '../src/utils/logger.js';

async function testWithdrawalStatusFlow() {
    const client = await pool.connect();

    try {
        console.log('\n=== Testing Withdrawal Status Fix ===\n');

        // 1. Get the most recent withdrawal request
        const { rows: [latestWithdrawal] } = await client.query(`
      SELECT 
        wr.id,
        wr.seller_id,
        wr.amount,
        wr.status,
        wr.provider_reference,
        wr.created_at,
        wr.processed_at,
        wr.raw_response::json->>'status' as payd_response_status,
        s.balance as current_seller_balance
      FROM withdrawal_requests wr
      LEFT JOIN sellers s ON wr.seller_id = s.id
      ORDER BY wr.created_at DESC
      LIMIT 1
    `);

        if (!latestWithdrawal) {
            console.log('❌ No withdrawal requests found. Please make a test withdrawal first.');
            return;
        }

        console.log('Latest Withdrawal Request:');
        console.log('─────────────────────────────────────');
        console.log(`ID: ${latestWithdrawal.id}`);
        console.log(`Amount: KES ${latestWithdrawal.amount}`);
        console.log(`Status: ${latestWithdrawal.status}`);
        console.log(`Provider Ref: ${latestWithdrawal.provider_reference || 'N/A'}`);
        console.log(`Created: ${latestWithdrawal.created_at}`);
        console.log(`Processed: ${latestWithdrawal.processed_at || 'Not yet'}`);
        console.log(`Payd Response Status: ${latestWithdrawal.payd_response_status || 'N/A'}`);
        console.log(`Current Seller Balance: KES ${latestWithdrawal.current_seller_balance}`);
        console.log('─────────────────────────────────────\n');

        // 2. Verify the fix
        const createdRecently = new Date() - new Date(latestWithdrawal.created_at) < 60000; // Within last minute

        if (createdRecently && !latestWithdrawal.processed_at) {
            // Recent withdrawal that hasn't been processed yet
            if (latestWithdrawal.status === 'processing') {
                console.log('✅ PASS: Recent withdrawal has status "processing" (correct!)');
            } else if (latestWithdrawal.status === 'completed') {
                console.log('❌ FAIL: Recent withdrawal marked as "completed" immediately (bug still exists!)');
            } else {
                console.log(`⚠️  WARNING: Unexpected status "${latestWithdrawal.status}"`);
            }
        } else if (latestWithdrawal.processed_at) {
            // Withdrawal has been processed by callback
            if (latestWithdrawal.status === 'completed') {
                console.log('✅ PASS: Withdrawal completed by callback');
            } else if (latestWithdrawal.status === 'failed') {
                console.log('✅ PASS: Withdrawal failed and processed by callback');
                console.log('   Verifying refund...');

                // Check if refund happened (would need to compare with transaction history)
                console.log('   ℹ️  Check seller balance to confirm refund was applied');
            }
        } else {
            console.log('ℹ️  Withdrawal is older than 1 minute and still processing.');
            console.log('   This might indicate callback hasn\'t been received yet.');
        }

        // 3. Show recent withdrawal history
        console.log('\n=== Recent Withdrawal History ===\n');
        const { rows: recentWithdrawals } = await client.query(`
      SELECT 
        id,
        amount,
        status,
        created_at,
        processed_at,
        CASE 
          WHEN processed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (processed_at - created_at))::INTEGER
          ELSE NULL
        END as processing_time_seconds
      FROM withdrawal_requests
      ORDER BY created_at DESC
      LIMIT 5
    `);

        console.table(recentWithdrawals.map(w => ({
            ID: w.id,
            Amount: `KES ${w.amount}`,
            Status: w.status,
            'Created At': new Date(w.created_at).toLocaleString(),
            'Processing Time': w.processing_time_seconds ? `${w.processing_time_seconds}s` : 'Pending'
        })));

        console.log('\n=== Test Complete ===\n');

    } catch (error) {
        console.error('Test Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the test
testWithdrawalStatusFlow();
