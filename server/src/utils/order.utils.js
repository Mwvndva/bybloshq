import logger from './logger.js';

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
        metadata = {},
        overrideContact = false
    } = body;

    // 1. Security: Zero-Trust Pricing
    // Reject requests with client-provided amounts to prevent manipulation
    if (body.amount !== undefined || body.price !== undefined) {
        throw new Error("Price must not be provided by client. Secure price lookup is mandatory.");
    }

    // 2. Identity Protection & Resolve Buyer Info
    // Authenticated users' details are locked unless explicit override is requested
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
    const lat = Number.parseFloat(rawLocation.lat || rawLocation.latitude || (user && !overrideContact ? user.latitude : 0) || 0);
    const lng = Number.parseFloat(rawLocation.lng || rawLocation.longitude || (user && !overrideContact ? user.longitude : 0) || 0);

    const location = {
        address: rawLocation.address || rawLocation.fullAddress || (user && !overrideContact ? user.location : null) || 'Not specified',
        lat,
        lng,
    };

    // Strict Validation: Throw for invalid physical locations
    const isDigital = body.isDigital || metadata.product_type === 'digital';
    if (!isDigital) {
        if (!location.address || location.address === 'Not specified') {
            throw new Error("Valid delivery address is required for physical orders.");
        }
        if (location.lat === 0 || location.lng === 0 || isNaN(location.lat) || isNaN(location.lng)) {
            throw new Error("Valid coordinates are required for physical orders. Please use the map to select your location.");
        }
    }

    // 5. Final Assembly
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
            customer_name: buyer.name
        }
    };
}
