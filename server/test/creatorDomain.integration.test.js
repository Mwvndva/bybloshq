// Creator domain security (integration): a creator can only respond to a shop
// invite that was addressed to THEM (no BOLA via inviteId), and the invited
// creator can. Click tracking is a vanity metric (asserted elsewhere: no money).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import CreatorService from '../src/domains/growth/creators/creator.service.js';

const uniq = `cd-${Date.now()}`;

describe('creator domain — shop-invite response ownership (integration)', () => {
  let creatorA, creatorB, sellerId, inviteId;

  before(async () => {
    sellerId = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('S','s-${uniq}@byblos.test','07','Shop-${uniq}','active') RETURNING id`)).rows[0].id;
    creatorA = (await pool.query(`INSERT INTO creators (first_name,last_name,email,mpesa_number) VALUES ('A','A','a-${uniq}@byblos.test','0712345678') RETURNING id`)).rows[0].id;
    creatorB = (await pool.query(`INSERT INTO creators (first_name,last_name,email,mpesa_number) VALUES ('B','B','b-${uniq}@byblos.test','0712345679') RETURNING id`)).rows[0].id;
    inviteId = (await pool.query(
      `INSERT INTO seller_creator_invites (seller_id, email, invite_token, expires_at, accepted_creator_id, status)
       VALUES ($1,$2,$3, NOW()+INTERVAL '7 days', $4, 'pending') RETURNING id`,
      [sellerId, `a-${uniq}@byblos.test`, `tok-${uniq}`, creatorA]
    )).rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM seller_creator_invites WHERE id=$1', [inviteId]).catch(() => {});
    await pool.query('DELETE FROM creators WHERE id IN ($1,$2)', [creatorA, creatorB]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]).catch(() => {});
  });

  it('a creator CANNOT accept an invite addressed to a different creator (no BOLA)', async () => {
    await assert.rejects(
      () => CreatorService.respondToShopRequest({ creatorId: creatorB, inviteId, action: 'accept' }),
      /not found or already handled/i
    );
    const inv = (await pool.query('SELECT status FROM seller_creator_invites WHERE id=$1', [inviteId])).rows[0];
    assert.equal(inv.status, 'pending', 'invite still pending after the unauthorized attempt');
  });

  it('the invited creator CAN respond to their own invite', async () => {
    await CreatorService.respondToShopRequest({ creatorId: creatorA, inviteId, action: 'deny' });
    const inv = (await pool.query('SELECT status FROM seller_creator_invites WHERE id=$1', [inviteId])).rows[0];
    assert.equal(inv.status, 'declined', 'invited creator handled their own invite');
  });

  it('rejects an invalid action', async () => {
    await assert.rejects(
      () => CreatorService.respondToShopRequest({ creatorId: creatorA, inviteId, action: 'sideways' }),
      /choose accept or deny/i
    );
  });
});
