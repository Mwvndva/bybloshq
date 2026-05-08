import logger from './logger.js';

export async function releaseOrderReservations(client, orderId) {
    const { rows: orderRows } = await client.query(
        `SELECT * FROM product_orders WHERE id = $1 FOR UPDATE`,
        [orderId]
    );
    const order = orderRows[0];
    if (!order) return { releasedInventory: 0, releasedSlots: 0 };

    let releasedSlots = 0;
    if (String(order.order_type || '').toUpperCase() === 'SERVICE') {
        const slotResult = await client.query(
            `UPDATE service_slots
             SET status = 'AVAILABLE',
                 reserved_by_order_id = NULL,
                 expires_at = NULL,
                 updated_at = NOW()
             WHERE reserved_by_order_id = $1
               AND status IN ('RESERVED', 'HELD')
             RETURNING id`,
            [orderId]
        );
        releasedSlots = slotResult.rowCount;
    }

    const { rows: items } = await client.query(
        `SELECT oi.product_id, oi.quantity, p.product_type, p.track_inventory
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1`,
        [orderId]
    );

    let releasedInventory = 0;
    for (const item of items) {
        const productType = String(item.product_type || '').toUpperCase();
        const qty = Number.parseInt(item.quantity || 0, 10);
        if (!qty || productType === 'DIGITAL' || item.track_inventory === false) continue;

        const release = await client.query(
            `UPDATE products
             SET quantity = quantity + $1,
                 reserved_quantity = reserved_quantity - $1,
                 updated_at = NOW()
             WHERE id = $2
               AND reserved_quantity >= $1
             RETURNING id`,
            [qty, item.product_id]
        );

        if (release.rowCount !== 1) {
            logger.error('[ReservationRelease] Reservation release invariant failed', {
                orderId,
                productId: item.product_id,
                quantity: qty
            });
            throw new Error(`Reserved inventory invariant failed for product ${item.product_id}`);
        }
        releasedInventory += 1;
    }

    return { releasedInventory, releasedSlots };
}
