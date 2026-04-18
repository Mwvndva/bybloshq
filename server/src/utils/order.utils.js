import logger from './logger.js';

/**
 * PIN-05: NO-NULL JSONB
 * Ensures all JSON inputs are valid objects ({}), never null or undefined.
 * This prevents PostgreSQL from rejecting 'NOT NULL' JSONB columns.
 */
export const safeJson = (val) => (val && typeof val === 'object') ? val : {};

/**
 * Normalizes incoming order request data into a Unified Order Object.
 * This ensures consistency between authenticated and guest buyers.
 * 
 * @param {Object} req - The Express request object
 * @returns {Object} Normalized order object
 */
export function normalizeOrderInput(req) {
    const { body, user } = req;
    const {
        customerName,
        phone,
        email,
        quantity = 1,
        productId,
        productName,
        buyerLocation,
        metadata: rawMetadata = {},
        overrideContact = false
    } = body;

    const metadata = safeJson(rawMetadata);

    // 1. Security: Zero-Trust Pricing
    // We ignore client-provided amounts to prevent manipulation.
    if (body.amount !== undefined || body.price !== undefined) {
        logger.warn('Client provided price fields in order request. These will be ignored for security.', {
            order_number: body.order_number
        });
        delete body.amount;
        delete body.price;
    }

    // 2. Identity Protection & Resolve Buyer Info
    let finalName = customerName;
    let finalPhone = phone;
    let finalEmail = email;

    if (user && !overrideContact) {
        finalName = user.name || user.full_name;
        finalPhone = user.mobile_payment || user.phone;
        finalEmail = user.email;
    }

    const buyer = {
        id: user?.id || null,
        name: finalName || 'Customer',
        phone: finalPhone || 'N/A',
        email: finalEmail || null,
    };

    // 3. Resolve Service/Product Info
    const service = {
        id: productId || body.serviceId,
        title: productName || body.serviceTitle || 'Product',
        quantity: Math.max(1, Number.parseInt(quantity) || 1),
    };

    // 4. Resolve & Strictly Validate Location
    const rawLocation = buyerLocation || metadata.buyer_location || {};

    const lat = Number.parseFloat(rawLocation.lat || rawLocation.latitude || (user && !overrideContact ? user.latitude : null));
    const lng = Number.parseFloat(rawLocation.lng || rawLocation.longitude || (user && !overrideContact ? user.longitude : null));

    const location = {
        address: rawLocation.address || rawLocation.fullAddress || (user && !overrideContact ? user.location : null) || null,
        lat: isNaN(lat) ? null : lat,
        lng: isNaN(lng) ? null : lng,
    };

    // Strict Validation: Throw for invalid physical/service locations
    const isDigital = body.isDigital || metadata.product_type === 'digital';
    const isService = body.isService || metadata.product_type === 'service';

    if (!isDigital) {
        if (isService && (!location.address || location.address === 'Not specified')) {
            throw new Error("Valid delivery address and coordinates are required for service bookings.");
        }
    }

    if (isService && (location.lat === 0 || location.lng === 0 || isNaN(location.lat) || isNaN(location.lng))) {
        throw new Error("Precise map coordinates are required for service bookings. Please select your location on the map.");
    }

    // 5. Final Assembly (PIN-02: UNIFIED ORDER CONTEXT)
    return {
        buyer,
        service,
        location,
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
            items: metadata.items || [] // Ensure items array exists for downstream logic
        }
    };
}
