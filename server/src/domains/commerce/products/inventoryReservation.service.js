import logger from '../../../shared/utils/logger.js';

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
    return itemProductType(item) === 'digital' || item.isDigital === true || item.is_digital === true;
}

function isServiceItem(item) {
    return itemProductType(item) === 'service';
}

function isPhysicalItem(item) {
    return !isDigitalItem(item) && !isServiceItem(item);
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

function singlePurchasePhysicalItems(items) {
    return items
        .filter(item => !isTrackableInventoryItem(item) && isPhysicalItem(item))
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
                    track_inventory, quantity, reserved_quantity, status
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
            item.productStatus = product.status;

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

        for (const item of singlePurchasePhysicalItems(items)) {
            if (item.quantity > 1) {
                throw new Error(`Product "${item.name || item.productId}" does not have inventory enabled and can only be purchased once per order`);
            }

            if (item.productStatus && String(item.productStatus).toLowerCase() !== 'available') {
                throw new Error(`Product "${item.name || item.productId}" is no longer available`);
            }
        }
    }

    static async reserveInventory(client, items) {
        const trackable = trackableItems(items);
        const singlePurchase = singlePurchasePhysicalItems(items);
        let reservedCount = 0;

        if (trackable.length > 0) {
            const ids = trackable.map(item => item.productId);
            const qtys = trackable.map(item => item.quantity);

            const { rows } = await client.query(
                `UPDATE products AS p
                 SET quantity = GREATEST(0, p.quantity - v.qty),
                     reserved_quantity = p.reserved_quantity + v.qty,
                     status = CASE WHEN (p.quantity - v.qty) <= 0 THEN 'sold' ELSE p.status END,
                     is_sold = CASE WHEN (p.quantity - v.qty) <= 0 THEN true ELSE p.is_sold END,
                     sold_at = CASE WHEN (p.quantity - v.qty) <= 0 THEN COALESCE(p.sold_at, NOW()) ELSE p.sold_at END,
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

            reservedCount += rows.length;
            logger.info(`[RESERVATION] Bulk reserved inventory for ${rows.length} product(s)`);
        }

        // Untracked inventory products (track_inventory = false) are never auto-marked as sold upon purchase.
        if (singlePurchase.length > 0) {
            reservedCount += singlePurchase.length;
            logger.info(`[RESERVATION] Bypassed status auto-sold update for ${singlePurchase.length} untracked inventory product(s)`);
        }

        return reservedCount;
    }

    static async releaseInventory(client, items) {
        const trackable = trackableItems(items);
        const singlePurchase = singlePurchasePhysicalItems(items);
        let releasedCount = 0;

        if (trackable.length > 0) {
            const ids = trackable.map(item => item.productId);
            const qtys = trackable.map(item => item.quantity);

            const { rows } = await client.query(
                `UPDATE products AS p
                 SET quantity = p.quantity + LEAST(COALESCE(p.reserved_quantity, 0), v.qty),
                     reserved_quantity = GREATEST(0, COALESCE(p.reserved_quantity, 0) - v.qty),
                     status = CASE WHEN (p.quantity + LEAST(COALESCE(p.reserved_quantity, 0), v.qty)) > 0 THEN 'available' ELSE p.status END,
                     is_sold = CASE WHEN (p.quantity + LEAST(COALESCE(p.reserved_quantity, 0), v.qty)) > 0 THEN false ELSE p.is_sold END,
                     sold_at = CASE WHEN (p.quantity + LEAST(COALESCE(p.reserved_quantity, 0), v.qty)) > 0 THEN NULL ELSE p.sold_at END,
                     updated_at = NOW()
                 FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS qty) AS v
                 WHERE p.id = v.id
                   AND p.track_inventory = true
                   AND COALESCE(LOWER(p.product_type::text), '') <> 'digital'
                 RETURNING p.id, p.quantity, p.reserved_quantity`,
                [ids, qtys]
            );

            if (rows.length !== trackable.length) {
                logger.warn('[RESERVATION-RELEASE] Some trackable product(s) were not updated (may be already released or modified)', {
                    expected: trackable.length,
                    released: rows.length,
                    ids
                });
            }

            releasedCount += rows.length;
            logger.info(`[RESERVATION-RELEASE] Bulk released inventory for ${rows.length} product(s)`);
        }

        if (singlePurchase.length > 0) {
            releasedCount += singlePurchase.length;
            logger.info(`[RESERVATION-RELEASE] Bypassed status release for ${singlePurchase.length} untracked inventory product(s)`);
        }

        return releasedCount;
    }

    static async commitReservedInventory(client, items) {
        const trackable = trackableItems(items);
        const singlePurchase = singlePurchasePhysicalItems(items);
        let committedCount = 0;

        if (trackable.length > 0) {
            const ids = trackable.map(item => item.productId);
            const qtys = trackable.map(item => item.quantity);

            const { rows } = await client.query(
                `UPDATE products AS p
                 SET reserved_quantity = GREATEST(0, p.reserved_quantity - v.qty),
                     status = CASE WHEN p.quantity <= 0 THEN 'sold' ELSE p.status END,
                     is_sold = CASE WHEN p.quantity <= 0 THEN true ELSE p.is_sold END,
                     sold_at = CASE WHEN p.quantity <= 0 THEN COALESCE(p.sold_at, NOW()) ELSE p.sold_at END,
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

            committedCount += rows.length;
            logger.info(`[RESERVATION-FINALIZED] Finalized reserved inventory for ${rows.length} product(s)`);
        }

        if (singlePurchase.length > 0) {
            committedCount += singlePurchase.length;
            logger.info(`[RESERVATION-FINALIZED] Confirmed ${singlePurchase.length} untracked inventory product(s) without altering status`);
        }

        return committedCount;
    }

    static async releaseOrderInventory(client, orderId) {
        const { rows: items } = await client.query(
            `SELECT oi.product_id, oi.quantity, p.product_type::text AS product_type,
                    p.track_inventory, p.is_digital, p.status
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = $1`,
            [orderId]
        );

        return this.releaseInventory(client, items);
    }

    static async reserveInventoryWithTTL(client, items, reservationId) {
        const reservedCount = await this.reserveInventory(client, items);

        // Store 15-minute TTL reservation key in Redis (900 seconds)
        const reservationKey = `inventory:reservation:${reservationId}`;
        try {
            const { getRedisClient } = await import('../../../shared/config/redis.js');
            const redisClient = getRedisClient();
            if (redisClient) {
                await redisClient.setex(reservationKey, 900, JSON.stringify({ items, status: 'RESERVED' }));
            }
        } catch (err) {
            logger.warn('[INVENTORY_TTL] Failed to store Redis reservation TTL:', err.message);
        }

        logger.info(`[INVENTORY_TTL] Created 15-min reservation TTL for ID ${reservationId}`);
        return reservedCount;
    }
}

export default InventoryReservationService;
