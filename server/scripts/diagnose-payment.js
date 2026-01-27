import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function diagnosePayment(paymentId) {
    try {
        console.log(`\n=== Diagnosing Payment ${paymentId} ===\n`);

        const query = `
      SELECT 
        id, 
        invoice_id, 
        status, 
        amount,
        payment_method,
        provider_reference,
        api_ref,
        mobile_payment,
        email,
        created_at,
        updated_at,
        ticket_type_id, 
        event_id, 
        organizer_id, 
        metadata 
      FROM payments 
      WHERE id = $1
    `;

        const result = await pool.query(query, [paymentId]);

        if (result.rows.length === 0) {
            console.log(`❌ No payment found with ID: ${paymentId}`);
            return;
        }

        const payment = result.rows[0];

        console.log('📋 Payment Details:');
        console.log('─'.repeat(60));
        console.log(`ID:                 ${payment.id}`);
        console.log(`Invoice ID:         ${payment.invoice_id}`);
        console.log(`Status:             ${payment.status}`);
        console.log(`Amount:             ${payment.amount} KES`);
        console.log(`Payment Method:     ${payment.payment_method}`);
        console.log(`Provider Reference: ${payment.provider_reference || '❌ MISSING'}`);
        console.log(`API Reference:      ${payment.api_ref || '❌ MISSING'}`);
        console.log(`Mobile Payment:     ${payment.mobile_payment}`);
        console.log(`Email:              ${payment.email}`);
        console.log(`Created At:         ${payment.created_at}`);
        console.log(`Updated At:         ${payment.updated_at}`);
        console.log('─'.repeat(60));

        // Check for issues
        console.log('\n🔍 Diagnostic Results:');
        console.log('─'.repeat(60));

        if (!payment.provider_reference && !payment.api_ref) {
            console.log('⚠️  CRITICAL: No provider reference found!');
            console.log('   This payment was likely never successfully initiated with Payd.');
            console.log('   Recommendation: Mark as failed or retry initiation.');
        } else if (!payment.provider_reference) {
            console.log('⚠️  WARNING: provider_reference is missing but api_ref exists.');
            console.log(`   API Ref: ${payment.api_ref}`);
            console.log('   This might be a temporary reference before Payd confirmation.');
        } else {
            console.log(`✅ Provider reference exists: ${payment.provider_reference}`);
            console.log('   The 404 error suggests this reference is not found in Payd\'s system.');
            console.log('   Possible reasons:');
            console.log('   1. Payment initiation failed silently');
            console.log('   2. Payd uses a different endpoint for status checks');
            console.log('   3. The transaction expired or was deleted from Payd');
        }

        if (payment.status === 'pending') {
            const ageMinutes = Math.floor((new Date() - new Date(payment.created_at)) / 60000);
            console.log(`\n⏱️  Payment has been pending for ${ageMinutes} minutes`);
            if (ageMinutes > 30) {
                console.log('   ⚠️  This is unusually long. Consider marking as failed.');
            }
        }

        // Check metadata
        if (payment.metadata) {
            console.log('\n📦 Metadata:');
            console.log(JSON.stringify(payment.metadata, null, 2));
        }

        console.log('─'.repeat(60));

    } catch (error) {
        console.error('❌ Error diagnosing payment:', error);
    } finally {
        await pool.end();
    }
}

// Get payment ID from command line argument
const paymentId = process.argv[2];

if (!paymentId) {
    console.log('Usage: node diagnose-payment.js <payment_id>');
    console.log('Example: node diagnose-payment.js 144');
    process.exit(1);
}

diagnosePayment(paymentId);
