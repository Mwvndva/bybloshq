import InventoryReservationService from '../../services/inventoryReservation.service.js';

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

    const releasedInventory = await InventoryReservationService.releaseOrderInventory(client, orderId);

    return { releasedInventory, releasedSlots };
}
