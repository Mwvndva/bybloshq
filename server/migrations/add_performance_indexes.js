// @ts-check

/** @typedef {import('node-pg-migrate').MigrationBuilder} MigrationBuilder */

/** @type {undefined} */
export const shorthands = undefined;

/**
 * @param {MigrationBuilder} pgm
 */
export const up = (pgm) => {
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction block
    pgm.noTransaction();

    pgm.createIndex('payments', 'provider_reference', {
        name: 'idx_payments_provider_ref',
        ifNotExists: true,
        concurrently: true,
    });

    pgm.createIndex('payments', "(metadata->>'order_id')", {
        name: 'idx_payments_order_id',
        ifNotExists: true,
        concurrently: true,
    });

    pgm.createIndex('product_orders', ['seller_id', 'status'], {
        name: 'idx_orders_seller_id_status',
        ifNotExists: true,
        concurrently: true,
    });

    pgm.createIndex('order_items', 'order_id', {
        name: 'idx_order_items_order_id',
        ifNotExists: true,
        concurrently: true,
    });

    pgm.createIndex('withdrawal_requests', ['seller_id', 'status'], {
        name: 'idx_withdrawal_seller_status',
        ifNotExists: true,
        concurrently: true,
    });
};

/**
 * @param {MigrationBuilder} pgm
 */
export const down = (pgm) => {
    pgm.noTransaction();

    pgm.dropIndex('payments', 'provider_reference', { name: 'idx_payments_provider_ref', concurrently: true, ifExists: true });
    pgm.dropIndex('payments', "(metadata->>'order_id')", { name: 'idx_payments_order_id', concurrently: true, ifExists: true });
    pgm.dropIndex('product_orders', ['seller_id', 'status'], { name: 'idx_orders_seller_id_status', concurrently: true, ifExists: true });
    pgm.dropIndex('order_items', 'order_id', { name: 'idx_order_items_order_id', concurrently: true, ifExists: true });
    pgm.dropIndex('withdrawal_requests', ['seller_id', 'status'], { name: 'idx_withdrawal_seller_status', concurrently: true, ifExists: true });
};
