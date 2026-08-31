// Seller domain security regression (integration): the profile update path must
// NOT allow a seller to escalate privileged/financial columns via mass-assignment,
// and must target only the seller identified by the id argument (not a body-supplied id).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import { updateSeller } from '../src/domains/commerce/sellers/seller.model.js';

const uniq = `sd-${Date.now()}`;
// Read raw columns directly to avoid any model camelCase mapping ambiguity.
const raw = async (id) => (await pool.query(
  'SELECT shop_name, email, balance::float AS balance, status, is_active FROM sellers WHERE id=$1', [id]
)).rows[0];

describe('seller profile update — mass-assignment protection (integration)', () => {
  let sellerId, otherId;

  before(async () => {
    sellerId = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status,balance,is_active)
       VALUES ('S','s-${uniq}@byblos.test','0712345678','Shop-${uniq}','active',5000,true) RETURNING id`
    )).rows[0].id;
    otherId = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status,balance)
       VALUES ('O','o-${uniq}@byblos.test','0700000000','Other-${uniq}','active',10) RETURNING id`
    )).rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM sellers WHERE id IN ($1,$2)', [sellerId, otherId]).catch(() => {});
  });

  it('updates whitelisted fields but ignores privileged/financial columns', async () => {
    await updateSeller(sellerId, {
      shopName: `Renamed-${uniq}`,      // whitelisted — should apply
      // Everything below is an injection attempt and must be ignored:
      balance: 999999,
      status: 'suspended',
      is_active: false,
      email: 'hacked@evil.com',        // email is auth-owned — must not change here
      pending_settlement_balance: 999999,
      withdrawal_reserved_balance: 999999,
    });

    const s = await raw(sellerId);
    assert.equal(s.shop_name, `Renamed-${uniq}`, 'whitelisted shopName applied');
    assert.equal(s.balance, 5000, 'balance NOT changed by injection');
    assert.equal(s.status, 'active', 'status NOT changed by injection');
    assert.equal(s.is_active, true, 'is_active NOT changed by injection');
    assert.equal(s.email, `s-${uniq}@byblos.test`, 'email NOT changed via profile update (auth-owned)');
  });

  it('targets the id argument, not a body-supplied id (no cross-seller write)', async () => {
    await updateSeller(sellerId, { shopName: `Self-${uniq}`, id: otherId });

    const other = await raw(otherId);
    assert.equal(other.shop_name, `Other-${uniq}`, 'other seller untouched by body.id');
    const self = await raw(sellerId);
    assert.equal(self.shop_name, `Self-${uniq}`, 'only the id-argument seller was updated');
  });
});
