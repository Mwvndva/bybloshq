import logger from './logger.js';
import Buyer from '../models/buyer.model.js';

/**
 * RULE 1 — JSONB SAFETY
 * Ensures all values bound to JSONB columns are null or a valid JSON string.
 *
 * Contract:
 *   null / undefined          → null
 *   valid JSON string         → passes through unchanged
 *   plain scalar string       → wrapped with JSON.stringify → '"value"' (valid JSONB string)
 *   object / array            → JSON.stringify()
 *   unsupported type (number) → throws
 *
 * NOTE: Plain strings (e.g. M-Pesa receipt codes "NLJ7RT61SV") are valid JSONB
 * scalars when stored as '"NLJ7RT61SV"'. JSON.stringify wraps them correctly.
 * We warn (not throw) if the string looks like a misencoded object.
 */
export const toJsonb = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
        // Already a valid JSON value — pass through unchanged
        try {
            JSON.parse(val);
            return val;
        } catch {
            // Detect misencoded objects — surface loudly but don't crash
            if (
                val.includes('[object Object]') ||
                val.startsWith('OBJECT:') ||
                val.startsWith('[object ')
            ) {
                logger.warn(`[toJsonb] Suspicious string looks like a misencoded object — storing as JSON string. Value: ${val.slice(0, 120)}`);
            }
            // Wrap plain strings as valid JSONB string scalars: "NLJ7RT61SV" → '"NLJ7RT61SV"'
            return JSON.stringify(val);
        }
    }
    if (typeof val === 'object') return JSON.stringify(val);
    throw new Error(`toJsonb: Unsupported type "${typeof val}" for JSONB column`);
};


/**
 * PIN-05: NO-NULL JSONB / STRING-SAFE
 * Ensures all JSON inputs return a plain object ({}), never null or undefined.
 * Logs a warning (instead of silently swallowing) when a parse fails.
 */
export const safeJson = (val) => {
    if (val === null || val === undefined) return {};
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch (e) {
            logger.warn('[safeJson] Failed to parse JSON string — returning {}. Value:', val.slice(0, 80));
            return {};
        }
    }
    return {};
};

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
        metadata: rawMetadata = {},
        overrideContact = false
    } = body;

    const metadata = safeJson(rawMetadata);

    // Identity Resolution
    const phone = req.user?.phone || rawPhone;
    let existingBuyer = null;

    if (phone) {
        existingBuyer = await Buyer.findByPhone(phone);
    }

    const email =
        req.user?.email ||
        req.body.email ||
        req.body.customerEmail ||
        existingBuyer?.email ||
        null;

    if (!email) {
        throw new Error("Guest orders require a valid contact email address.");
    }

    let buyerId = existingBuyer?.id ?? null;
    if (user && !buyerId) {
        const loggedInBuyer = await Buyer.findByUserId(user.id);
        buyerId = loggedInBuyer?.id ?? null;
    }

    let finalName = existingBuyer?.fullName ?? customerName ?? null;
    if (customerName && customerName !== 'Guest' && !existingBuyer?.fullName) {
        finalName = customerName;
    }
    let finalPhone = phone ?? null;

    if (user && !overrideContact) {
        finalName = user.name ?? user.full_name ?? null;
        finalPhone = user.mobile_payment ?? user.phone ?? null;
    }

    const buyer = {
        id: buyerId,
        name: finalName ?? null,  // null reaches DB — never inject fake 'Customer' string
        phone: finalPhone ?? null, // null reaches DB — never inject fake 'N/A' string
        email,
    };

    const service = {
        id: productId || body.serviceId,
        title: productName || body.serviceTitle || 'Product',
        quantity: Math.max(1, Number.parseInt(quantity) || 1),
    };

    // Product Type Detection
    const isDigital =
        body.isDigital === true ||
        body.product_type === 'digital' ||
        metadata.product_type === 'digital' ||
        body.metadata?.product_type === 'digital';

    const isService =
        body.isService === true ||
        body.product_type === 'service' ||
        metadata.product_type === 'service' ||
        body.metadata?.product_type === 'service';

    /**
     * UNIFIED LOCATION RESOLVER
     * Scans various body and metadata paths for coordinates and address.
     */
    const resolveLocation = () => {
        const candidates = [
            body.buyerLocation,
            body.buyer_location,
            body.bookingDetails?.buyerLocation,
            body.metadata?.buyer_location,
            body.metadata?.buyerLocation,
            metadata.buyer_location,
            metadata.buyerLocation,
            body.locationData,
            body.customFields?.location
        ];

        const result = { lat: null, lng: null, address: null };

        for (const candidate of candidates) {
            if (!candidate) continue;

            let data = candidate;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch { continue; }
            }
            if (typeof data !== 'object') continue;

            const rawLat = data.lat ?? data.latitude ?? data.location_lat ?? data.latitude_coordinate;
            const rawLng = data.lng ?? data.longitude ?? data.location_lng ?? data.longitude_coordinate;
            const addr = data.address || data.fullAddress || data.full_address || data.location_address || data.displayName;

            const parsedLat = Number.parseFloat(rawLat);
            const parsedLng = Number.parseFloat(rawLng);

            if (!isNaN(parsedLat) && parsedLat !== 0) result.lat = parsedLat;
            if (!isNaN(parsedLng) && parsedLng !== 0) result.lng = parsedLng;
            if (addr) result.address = addr;

            if (result.lat && result.lng) break;
        }

        // Profile Fallback
        if ((result.lat === null || result.lat === 0) && (user || existingBuyer)) {
            result.lat = user?.latitude || existingBuyer?.latitude || null;
            result.lng = user?.longitude || existingBuyer?.longitude || null;
            result.address = result.address ?? (user?.location || existingBuyer?.location || null);
        }

        return result;
    }

    const location = resolveLocation();

    if (!isDigital && isService && (!location.address || location.address === 'Not specified')) {
        throw new Error("Valid delivery address and coordinates are required for service bookings.");
    }

    return {
        buyer,
        service,
        location: {
            address: location.address || null,
            lat: location.lat ?? null,
            lng: location.lng ?? null
        },
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
            items: Array.isArray(metadata.items) ? metadata.items : []
        }
    };
}

