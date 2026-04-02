export async function up(pgm) {
    pgm.addColumns('product_orders', {
        seller_dropoff_deadline: { type: 'timestamptz' },
        buyer_pickup_deadline: { type: 'timestamptz' },
        ready_for_pickup_at: { type: 'timestamptz' },
        auto_cancelled_reason: { type: 'text' },
    });
}

export async function down(pgm) {
    pgm.dropColumns('product_orders', [
        'seller_dropoff_deadline',
        'buyer_pickup_deadline',
        'ready_for_pickup_at',
        'auto_cancelled_reason',
    ]);
}
