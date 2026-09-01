// Product domain security (integration): a seller can only mutate their OWN products
// (no BOLA), and product create/update cannot be retargeted via mass-assignment.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import ProductService from '../src/domains/commerce/products/product.service.js';

const uniq = `pd-${Date.now()}`;

describe('product domain — ownership + mass-assignment (integration)', () => {
  let sellerA, sellerB, productA;

  before(async () => {
    sellerA = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('A','a-${uniq}@byblos.test','07','ShopA-${uniq}','active') RETURNING id`)).rows[0].id;
    sellerB = (await pool.query(`INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status) VALUES ('B','b-${uniq}@byblos.test','07','ShopB-${uniq}','active') RETURNING id`)).rows[0].id;
    productA = (await pool.query(`INSERT INTO products (seller_id,name,price,product_type,is_digital,status,description) VALUES ($1,'A-Product',999,'physical',false,'available','d') RETURNING id`, [sellerA])).rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM products WHERE seller_id IN ($1,$2)', [sellerA, sellerB]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id IN ($1,$2)', [sellerA, sellerB]).catch(() => {});
  });

  it('a seller CANNOT update another seller\'s product (no BOLA)', async () => {
    await assert.rejects(
      () => ProductService.updateProduct(sellerB, productA, { name: 'hacked' }),
      /unauthorized/i
    );
    const p = (await pool.query('SELECT name FROM products WHERE id=$1', [productA])).rows[0];
    assert.equal(p.name, 'A-Product', 'product name unchanged by the unauthorized seller');
  });

  it('a seller CANNOT delete another seller\'s product (no BOLA)', async () => {
    await assert.rejects(
      () => ProductService.deleteProduct(sellerB, productA),
      /unauthorized/i
    );
    const exists = (await pool.query('SELECT status FROM products WHERE id=$1', [productA])).rows[0];
    assert.ok(exists, 'product still exists');
    assert.notEqual(exists.status, 'deleted', 'not soft-deleted by the unauthorized seller');
  });

  it('the owner CAN update their own product', async () => {
    await ProductService.updateProduct(sellerA, productA, { name: `Renamed-${uniq}` });
    const p = (await pool.query('SELECT name FROM products WHERE id=$1', [productA])).rows[0];
    assert.equal(p.name, `Renamed-${uniq}`);
  });

  it('createProduct ignores an injected seller_id (mass-assignment) — product belongs to the caller', async () => {
    const created = await ProductService.createProduct(sellerA, {
      name: `Injected-${uniq}`, price: 500, description: 'x', product_type: 'physical',
      seller_id: sellerB,   // injection attempt — must be ignored
      id: 999999,           // injection attempt — must be ignored
      status: 'featured',
    });
    const row = (await pool.query('SELECT seller_id FROM products WHERE id=$1', [created.id])).rows[0];
    assert.equal(String(row.seller_id), String(sellerA), 'product owned by the caller, not the injected seller_id');
    assert.notEqual(String(created.id), '999999', 'injected id ignored');
  });
});
