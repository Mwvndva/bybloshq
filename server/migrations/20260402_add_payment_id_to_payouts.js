/**
 * Add missing payment_id to payouts table
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
    pgm.addColumn('payouts', {
        payment_id: {
            type: 'integer',
            references: '"payments"',
            onDelete: 'SET NULL',
        },
    });

    pgm.createIndex('payouts', 'payment_id', {
        name: 'idx_payouts_payment_id',
        ifNotExists: true,
    });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
    pgm.dropIndex('payouts', 'payment_id', { name: 'idx_payouts_payment_id', ifExists: true });
    pgm.dropColumn('payouts', 'payment_id');
};
