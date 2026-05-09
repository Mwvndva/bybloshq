import logger from '../shared/utils/logger.js';

function itemProductType(item) {
    return String(item.productType ?? item.product_type ?? '').trim().toLowerCase();
}

function itemProductId(item) {
    return Number.parseInt(item.productId ?? item.product_id, 10);
}

function itemQuantity(item) {
    return Number.parseInt(item.quantity, 10) || 1;
}

function isTrackableInventoryItem(item) {
    return item.trackInventory === true
        || item.track_inventory === true
        || item.trackInventory === 'true'
        || item.track_inventory === 'true';
}

function isDigitalItem(item) {
    return itemProductType(item) === 'digital';
}

function trackableItems(items) {
    return items
        .filter(item => isTrackableInventoryItem(item) && !isDigitalItem(item))
        .map(item => ({
            ...item,
            productId: itemProductId(item),
            quantity: itemQuantity(item)
        }))
        .filter(item => Number.isInteger(item.productId) && item.productId > 0 && item.quantity > 0);
}

class InventoryReservationService {
    static async enrichItemsWithProductData(client, items) {
        const productIds = items.map(item => Number.parseInt(item.productId, 10));
        const productsResult = await client.query(
            `SELECT id, price, product_type::text AS product_type, is_digital, service_options,
                    track_inventory, quantity, reserved_quantity
             FROM products
             WHERE id = ANY($1)`,
            [productIds]
        );
        const productsMap = new Map(productsResult.rows.map(product => [product.id, product]));

        items.forEach(item => {
            const product = productsMap.get(Number.parseInt(item.productId, 10));
            if (!product) return;

            item.dbPrice = product.price;
            item.productType = product.product_type;
            item.isDigital = product.is_digital;
            item.trackInventory = product.track_inventory;
            item.availableQuantity = product.quantity;

            if (!item.productType && product.service_options) {
                item.productType = 'service';
            }
        });
    }

    static checkInventory(items) {
        for (const item of trackableItems(items)) {
            const requestedQty = item.quantity;

            if (item.availableQuantity === null || item.availableQuantity === undefined) {
                throw new Error(`Product "${item.name || item.productId}" has inventory tracking enabled but no quantity set`);
            }

            if (item.availableQuantity < requestedQty) {
                throw new Error(`Insufficient stock for "${item.name || item.productId}". Available: ${item.availableQuantity}, Requested: ${requestedQty}`);
            }

            if (item.availableQuantity === 0) {
                throw new Error(`Product "${item.name || item.productId}" is out of stock`);
            }
        }
    }

    static async reserveInventory(client, items) {
        const trackable = trackableItems(items);
        if (trackable.length === 0) return 0;

        const ids = trackable.map(item => item.productId);
        const qtys = trackable.map(item => item.quantity);

        const { rows } = await client.query(
            `UPDATE products AS p
             SET quantity = p.quantity - v.qty,
                 reserved_quantity = p.reserved_quantity + v.qty,
                 updated_at = NOW()
             FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS qty) AS v
             WHERE p.id = v.id
               AND p.track_inventory = true
               AND COALESCE(LOWER(p.product_type::text), '') <> 'digital'
               AND p.quantity >= v.qty
             RETURNING p.id, p.quantity, p.reserved_quantity`,
            [ids, qtys]
        );

        const reservedIds = new Set(rows.map(row => row.id));
        const failed = trackable.filter(item => !reservedIds.has(item.productId));
        if (failed.length > 0) {
            const failedIds = failed.map(item => item.productId).join(', ');
            throw new Error(`Inventory reservation failed for product(s) ${failedIds}. Items may have just sold out.`);
        }

        logger.info(`[RESERVATION] Bulk reserved inventory for ${rows.length} product(s)`);
        return rows.length;
    }

    static async releaseInventory(client, items) {
        const trackable = trackableItems(items);
        if (trackable.length === 0) return 0;

        const ids = trackable.map(item => item.productId);
        const qtys = trackable.map(item => item.quantity);

        const { rows } = await client.query(
            `UPDATE products AS p
             SET quantity = p.quantity + v.qty,
                 reserved_quantity = p.reserved_quantity - v.qty,
                 updated_at = NOW()
             FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS qty) AS v
             WHERE p.id = v.id
               AND p.track_inventory = true
               AND COALESCE(LOWER(p.product_type::text), '') <> 'digital'
               AND p.reserved_quantity >= v.qty
             RETURNING p.id, p.quantity, p.reserved_quantity`,
            [ids, qtys]
        );

        if (rows.length !== trackable.length) {
            logger.error('[RESERVATION-RELEASE] Reserved inventory invariant failed during release', {
                expected: trackable.length,
                released: rows.length,
                ids
            });
            throw new Error('Reserved inventory invariant failed during release');
        }

        logger.info(`[RESERVATION-RELEASE] Bulk released inventory for ${rows.length} product(s)`);
        return rows.length;
    }

    static async commitReservedInventory(client, items) {
        const trackable = trackableItems(items);
        if (trackable.length === 0) return 0;

        const ids = trackable.map(item => item.productId);
        const qtys = trackable.map(item => item.quantity);

        const { rows } = await client.query(
            `UPDATE products AS p
             SET reserved_quantity = p.reserved_quantity - v.qty,
                 updated_at = NOW()
             FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS qty) AS v
             WHERE p.id = v.id
               AND p.track_inventory = true
               AND COALESCE(LOWER(p.product_type::text), '') <> 'digital'
               AND p.reserved_quantity >= v.qty
             RETURNING p.id, p.reserved_quantity`,
            [ids, qtys]
        );

        if (rows.length !== trackable.length) {
            logger.error('[RESERVATION-FINALIZE-ERROR] Reserved inventory invariant failed during finalization', {
                expected: trackable.length,
                finalized: rows.length,
                ids
            });
            throw new Error('Reserved inventory invariant failed');
        }

        logger.info(`[RESERVATION-FINALIZED] Finalized reserved inventory for ${rows.length} product(s)`);
        return rows.length;
    }

    static async releaseOrderInventory(client, orderId) {
        const { rows: items } = await client.query(
            `SELECT oi.product_id, oi.quantity, p.product_type::text AS product_type, p.track_inventory
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = $1`,
            [orderId]
        );

        return this.releaseInventory(client, items);
    }
}

export default InventoryReservationService;
