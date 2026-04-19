/**
 * Unit tests for order.validator.js
 * Run: node --test src/validators/__tests__/order.validator.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderInput, sanitizeForDb } from '../order.validator.js';

// ---------------------------------------------------------------------------
// validateOrderInput
// ---------------------------------------------------------------------------
test('validateOrderInput: valid input passes', () => {
    const validOrder = {
        buyer: { email: 'test@example.com', phone: '0712345678' },
        sellerId: 1,
        metadata: { items: [{ productId: 1, price: 100, quantity: 1 }] }
    };
    assert.doesNotThrow(() => validateOrderInput(validOrder));
});

test('validateOrderInput: throws when buyer.email is missing', () => {
    const order = {
        buyer: { phone: '0712345678' },
        sellerId: 1,
        metadata: { items: [{ productId: 1, price: 100, quantity: 1 }] }
    };
    assert.throws(() => validateOrderInput(order), /buyer\.email is required/);
});

test('validateOrderInput: throws when buyer is null', () => {
    const order = {
        buyer: null,
        sellerId: 1,
        metadata: { items: [{ productId: 1, price: 100, quantity: 1 }] }
    };
    assert.throws(() => validateOrderInput(order), /buyer\.email is required/);
});

test('validateOrderInput: throws when sellerId is missing', () => {
    const order = {
        buyer: { email: 'test@example.com' },
        metadata: { items: [{ productId: 1, price: 100, quantity: 1 }] }
    };
    assert.throws(() => validateOrderInput(order), /seller_id is required/);
});

test('validateOrderInput: throws when items array is empty', () => {
    const order = {
        buyer: { email: 'test@example.com' },
        sellerId: 1,
        metadata: { items: [] }
    };
    assert.throws(() => validateOrderInput(order), /at least one item/);
});

test('validateOrderInput: throws when items is not an array', () => {
    const order = {
        buyer: { email: 'test@example.com' },
        sellerId: 1,
        metadata: { items: 'not-an-array' }
    };
    assert.throws(() => validateOrderInput(order), /at least one item/);
});

test('validateOrderInput: throws when metadata.items is missing', () => {
    const order = {
        buyer: { email: 'test@example.com' },
        sellerId: 1,
        metadata: {}
    };
    assert.throws(() => validateOrderInput(order), /at least one item/);
});

// ---------------------------------------------------------------------------
// sanitizeForDb
// ---------------------------------------------------------------------------
test('sanitizeForDb: replaces undefined with null', () => {
    const input = { a: 1, b: undefined, c: 'hello', d: undefined, e: null };
    const result = sanitizeForDb(input);
    assert.deepEqual(result, { a: 1, b: null, c: 'hello', d: null, e: null });
});

test('sanitizeForDb: does not modify existing null values', () => {
    const input = { a: null };
    const result = sanitizeForDb(input);
    assert.equal(result.a, null);
});

test('sanitizeForDb: preserves falsy but defined values', () => {
    const input = { a: 0, b: '', c: false };
    const result = sanitizeForDb(input);
    assert.deepEqual(result, { a: 0, b: '', c: false });
});
