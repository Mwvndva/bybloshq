// Regression coverage for 20260911130000_add_payments_provider_reference_unique_constraint.
//
// payments.provider_reference only ever had a plain, non-unique index --
// unlike withdrawal_requests and payout_provider_attempts, which both got a
// real DB-level unique constraint for the same purpose in
// 20260508020000_provider_callback_hardening.sql. The gap already worried
// whoever wrote CorePaymentService.findPaymentByProviderReference: it looks
// up `WHERE provider_reference = $1 OR api_ref = $1 OR invoice_id = $1`, then
// explicitly checks `rows.length > 1` and throws "Ambiguous provider payment
// reference" -- a reactive, application-level guard for exactly the state
// this constraint now makes impossible to reach in the first place.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';

async function cleanupInvoice(invoiceId) {
  await pool.query('DELETE FROM payments WHERE invoice_id = $1', [invoiceId]);
}

describe('payments.provider_reference — DB-level unique constraint', () => {
  test('two payments cannot share the same non-null provider_reference', async (t) => {
    const ref = `it-dup-ref-${Date.now()}`;
    const invA = `it-dup-a-${Date.now()}`;
    const invB = `it-dup-b-${Date.now()}`;
    t.after(async () => {
      await cleanupInvoice(invA);
      await cleanupInvoice(invB);
    });

    await pool.query(
      'INSERT INTO payments (invoice_id, amount, provider_reference) VALUES ($1, 100, $2)',
      [invA, ref]
    );

    await assert.rejects(
      () => pool.query(
        'INSERT INTO payments (invoice_id, amount, provider_reference) VALUES ($1, 200, $2)',
        [invB, ref]
      ),
      (err) => {
        assert.equal(err.code, '23505', 'a real unique-violation, not some other failure');
        assert.match(err.constraint || '', /payments_provider_reference_unique/);
        return true;
      }
    );
  });

  test('multiple payments with a NULL provider_reference are still allowed (not yet assigned by the provider)', async (t) => {
    const invA = `it-null-a-${Date.now()}`;
    const invB = `it-null-b-${Date.now()}`;
    t.after(async () => {
      await cleanupInvoice(invA);
      await cleanupInvoice(invB);
    });

    await pool.query('INSERT INTO payments (invoice_id, amount, provider_reference) VALUES ($1, 100, NULL)', [invA]);
    await pool.query('INSERT INTO payments (invoice_id, amount, provider_reference) VALUES ($1, 200, NULL)', [invB]);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM payments WHERE invoice_id IN ($1, $2) AND provider_reference IS NULL',
      [invA, invB]
    );
    assert.equal(rows[0].n, 2, 'both NULL-reference rows were accepted');
  });
});
