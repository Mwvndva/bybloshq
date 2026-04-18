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

    logger.info('[RAW-LOCATION-DEBUG] Extracted Data: ' + JSON.stringify({ rawBuyerLocation, metadata: rawMetadata }));

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
    const isDigital = body.isDigital || metadata.product_type === 'digital';
    const isService = body.isService || metadata.product_type === 'service';

    /**
     * TRIPLE-SHIELD LOCATION CRAWLER (PIN-COORD-ROBUST)
     * Scans body.buyerLocation, metadata.buyer_location, and metadata.buyerLocation
     * Defensively handles stringified JSON and diverse naming conventions (lat/latitude).
     */
    const crawlLocation = () => {
        const candidates = [
            body.buyerLocation,
            body.buyer_location,
            metadata.buyer_location,
            metadata.buyerLocation
        ];

        const result = { lat: null, lng: null, address: null, source: 'none' };

        for (let i = 0; i < candidates.length; i++) {
            let candidate = candidates[i];
            if (!candidate) continue;

            // Defensive: Parse stringified JSON if it arrived as a string
            if (typeof candidate === 'string') {
                try {
                    candidate = JSON.parse(candidate);
                } catch (e) {
                    continue; // Not JSON string, skip
                }
            }

            if (typeof candidate !== 'object') continue;

            // Property Scanning (lat/latitude/lng/longitude)
            const lat = candidate.lat ?? candidate.latitude ?? candidate.location_lat;
            const lng = candidate.lng ?? candidate.longitude ?? candidate.location_lng;
            const addr = candidate.address || candidate.fullAddress || candidate.full_address || candidate.location_address;

            if (lat !== undefined && lat !== null) result.lat = Number.parseFloat(lat);
            if (lng !== undefined && lng !== null) result.lng = Number.parseFloat(lng);
            if (addr) result.address = addr;

            if (result.lat !== null && result.lng !== null) {
                result.source = ['body.buyerLocation', 'body.buyer_location', 'metadata.buyer_location', 'metadata.buyerLocation'][i];
                break; // Found complete coordinates
            }
        }

        // Profile Fallback (PIN-15: PROFILE-COORDS)
        if (result.lat === null || result.lng === null) {
            if (user && !overrideContact) {
                result.lat = result.lat ?? user.latitude;
                result.lng = result.lng ?? user.longitude;
                result.address = result.address ?? user.location;
                result.source = 'user_profile';
            } else if (existingBuyer) {
                result.lat = result.lat ?? existingBuyer.latitude;
                result.lng = result.lng ?? existingBuyer.longitude;
                result.address = result.address ?? (existingBuyer.fullAddress || existingBuyer.location);
                result.source = 'buyer_profile';
            }
        }

        return result;
    };

    const resolved = crawlLocation();
    const location = {
        address: resolved.address || null,
        lat: resolved.lat,
        lng: resolved.lng
    };

    const logPayload = {
        order_number: body.order_number || 'NEW',
        is_service: isService,
        source: resolved.source,
        resolved_lat: location.lat,
        resolved_lng: location.lng,
        resolved_address: location.address,
        raw_received: {
            body_type: typeof body.buyerLocation,
            meta_type: typeof metadata.buyer_location,
            body_preview: typeof body.buyerLocation === 'string' ? body.buyerLocation.substring(0, 50) : 'object'
        }
    };

    if (isService && (location.lat === null || location.lat === 0)) {
        logger.warn('[COORD-DEBUG] ⚠️ SERVICE WITHOUT COORDINATES: ' + JSON.stringify(logPayload));
    } else {
        logger.info('[COORD-DEBUG] Resolution Trace: ' + JSON.stringify(logPayload));
    }

    // Strict Validation: Throw for invalid physical/service locations

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
