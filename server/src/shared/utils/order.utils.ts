import logger from './logger.js';
// @ts-ignore
import Buyer from '../../models/buyer.model.js';

/**
 * Ensures all JSON inputs are valid objects ({}), never null or undefined.
 */
export const safeJson = (val: any) => {
    if (!val) return {};
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch (e) {
            return {};
        }
    }
    return {};
};

/**
 * Normalizes incoming order request data into a Unified Order Object.
 */
export async function normalizeOrderInput(req: any) {
    const { body, user } = req;
    const {
        customerName,
        phone: rawPhone,
        quantity = 1,
        productId,
        productName,
        metadata: rawMetadata = {},
    } = body;

    const metadata = safeJson(rawMetadata);

    const phone = req.user?.phone || rawPhone;
    const email = req.user?.email || req.body.email || req.body.customerEmail || null;

    if (!email && !user) {
        throw new Error("Guest orders require a valid contact email address.");
    }

    let buyerId = null;
    if (user) {
        const loggedInBuyer = await Buyer.findByUserId(user.id) as any;
        buyerId = loggedInBuyer?.id || null;
    }

    let finalName = customerName || 'Customer';
    let finalPhone = phone || 'N/A';

    if (user) {
        finalName = user.name || user.full_name || finalName;
        finalPhone = user.mobile_payment || user.phone || finalPhone;
    }

    const buyer = {
        id: buyerId,
        name: finalName || 'Customer',
        phone: finalPhone || 'N/A',
        email,
    };

    const service = {
        id: productId || body.serviceId,
        title: productName || body.serviceTitle || 'Product',
        quantity: Math.max(1, Number.parseInt(quantity) || 1),
        total: (body.price || 0) * (Number.parseInt(quantity) || 1) // Temporary calculation
    };

    return {
        buyer,
        service,
        location: body.location || {},
        payment: {
            status: 'pending',
            method: body.paymentMethod || 'payd',
            reference: null,
        },
        metadata: {
            ...metadata,
            product_id: service.id,
            product_name: service.title,
            customer_name: buyer.name,
            items: metadata.items || []
        }
    };
}
