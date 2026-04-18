import logger from './logger.js';
import Buyer from '../models/buyer.model.js';

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
export async function normalizeOrderInput(req) {
    const { body, user } = req;
    const {
        customerName,
        phone: rawPhone,
        quantity = 1,
        productId,
        productName,
        buyerLocation: rawBuyerLocation,
        metadata: rawMetadata = {},
        overrideContact = false
    } = body;

    const metadata = safeJson(rawMetadata);

    // 1. Resolve Identity via Phone (PIN-10: IDENTITY RESOLUTION)
    const phone = req.user?.phone || rawPhone;
    let existingBuyer = null;

    if (phone) {
        existingBuyer = await Buyer.findByPhone(phone);
        if (existingBuyer) {
            logger.info('Buyer identity resolved from phone lookup', { buyer_id: existingBuyer.id });
        }
    }

    // 2. Identity Protection & Resolve Buyer Info
    const email =
        req.user?.email ||
        req.body.email ||
        req.body.customerEmail ||
        existingBuyer?.email ||
        null;

    const buyerCity = body.buyerCity || body.city || (user && !overrideContact ? user.city : existingBuyer?.city) || null;
    const buyerArea = body.buyerArea || body.location || (user && !overrideContact ? user.location : existingBuyer?.location) || null;

    if (!email) {
        throw new Error("Guest orders require a valid contact email address.");
    }

    // CRITICAL: Resolve actual buyers.id if user is logged in (Task BUG-PERSIST-01)
    let buyerId = existingBuyer?.id || null;
    if (user && !buyerId) {
        const loggedInBuyer = await Buyer.findByUserId(user.id);
        buyerId = loggedInBuyer?.id || null;
    }

    let finalName = customerName || existingBuyer?.fullName;
    let finalPhone = phone;

    if (user && !overrideContact) {
        finalName = user.name || user.full_name;
        finalPhone = user.mobile_payment || user.phone;
    }

    const buyer = {
        id: buyerId, // Correctly point to buyers.id
        name: finalName || 'Customer',
        phone: finalPhone || 'N/A',
        email,
        city: buyerCity,
        location: buyerArea
    };

    // 3. Resolve Service/Product Info
    const service = {
        id: productId || body.serviceId,
        title: productName || body.serviceTitle || 'Product',
        quantity: Math.max(1, Number.parseInt(quantity) || 1),
    };

    // 4. Resolve & Strictly Validate Location (COORD-RESOLVE-V2)
    const rawLocation = rawBuyerLocation || metadata.buyer_location || {};

    // Helper to resolve with nullish priority (PIN-COORD-FIX)
    const resolveProp = (obj, props, fallback) => {
        for (const prop of props) {
            if (obj[prop] !== undefined && obj[prop] !== null) return obj[prop];
        }
        return fallback;
    };

    const rawLat = resolveProp(rawLocation, ['lat', 'latitude'], (user && !overrideContact ? user.latitude : existingBuyer?.latitude));
    const rawLng = resolveProp(rawLocation, ['lng', 'longitude'], (user && !overrideContact ? user.longitude : existingBuyer?.longitude));

    const location = {
        address: rawLocation.address || rawLocation.fullAddress || (user && !overrideContact ? user.location : existingBuyer?.fullAddress || existingBuyer?.location) || null,
        lat: (rawLat === undefined || rawLat === null) ? null : Number.parseFloat(rawLat),
        lng: (rawLng === undefined || rawLng === null) ? null : Number.parseFloat(rawLng),
    };

    const logPayload = {
        order_number: body.order_number || 'NEW',
        is_service: isService,
        source: rawBuyerLocation ? 'request_body' : (metadata.buyer_location ? 'metadata' : 'profile_fallback'),
        resolved_lat: location.lat,
        resolved_lng: location.lng,
        resolved_address: location.address,
        raw_received: {
            body_lat: rawBuyerLocation?.lat ?? rawBuyerLocation?.latitude,
            body_lng: rawBuyerLocation?.lng ?? rawBuyerLocation?.longitude,
            meta_lat: metadata.buyer_location?.lat,
            profile_lat: user?.latitude || existingBuyer?.latitude
        }
    };

    if (isService && (location.lat === null || location.lat === 0)) {
        logger.warn('[COORD-DEBUG] ⚠️ SERVICE WITHOUT COORDINATES:', logPayload);
    } else {
        logger.info('[COORD-DEBUG] Resolution Trace:', logPayload);
    }

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
