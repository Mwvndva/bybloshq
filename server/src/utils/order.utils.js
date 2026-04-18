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
    // We ignore client-provided amounts to prevent manipulation.
    // The backend will perform a secure lookup using productId later in the flow.
    if (body.amount !== undefined || body.price !== undefined) {
        logger.warn('Client provided price fields in order request. These will be ignored for security.', {
            order_number: body.order_number,
            provided_amount: body.amount,
            provided_price: body.price
        });
        delete body.amount;
        delete body.price;
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

    // Strict Validation: Throw for invalid physical/service locations
    const isDigital = body.isDigital || metadata.product_type === 'digital';
    const isService = body.isService || metadata.product_type === 'service';

    if (!isDigital) {
        // All non-digital orders MUST have an address
        if (!location.address || location.address === 'Not specified') {
            throw new Error("Valid delivery address is required for physical and service orders.");
        }

        // SERVICES MUST have precise coordinates for fulfillment
        // PHYSICAL orders can rely on address + phone for courier, but we log warning if missing coords
        if (location.lat === 0 || location.lng === 0 || isNaN(location.lat) || isNaN(location.lng)) {
            if (isService) {
                throw new Error("Precise map coordinates are required for service bookings. Please select your location on the map.");
            } else {
                logger.warn('Physical order received without coordinates. Relying on address string.', {
                    order_number: body.order_number,
                    address: location.address
                });
            }
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
