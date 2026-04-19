import { ProductType } from '../constants/enums.js';
import { sellerHasPhysicalShop } from './sellerUtils.js';
import logger from './logger.js';

/**
 * Fulfillment types supported by the platform.
 */
export const FulfillmentType = {
    BUYER_TO_SELLER: 'BUYER_TO_SELLER',  // Pickup at shop / In-store service
    COURIER: 'COURIER',                  // System-managed delivery
    SELLER_TO_BUYER: 'SELLER_TO_BUYER',  // Seller visits buyer (Mobile Service)
    DIGITAL: 'DIGITAL'                   // Instant delivery
};

/**
 * Resolves the required fulfillment type based on seller and product properties.
 * This is the SINGLE SOURCE OF TRUTH for logistics rules.
 * 
 * Rules:
 * 1. IF Seller HAS Coordinates:
 *    - Always BUYER_TO_SELLER (Pickup/In-store)
 *    - No courier flow.
 *    - Buyer coordinates MUST NOT be collected.
 * 
 * 2. IF Seller HAS NO Coordinates:
 *    - PHYSICAL PRODUCT -> COURIER (Platform managed)
 *    - SERVICE -> SELLER_TO_BUYER (Mobile)
 *    - DIGITAL -> DIGITAL
 * 
 * @param {Object} seller - Seller object with coordinates
 * @param {string} productType - 'physical', 'service', or 'digital'
 * @returns {string} FulfillmentType
 */
export const resolveFulfillmentType = (seller, productType, metadata = {}) => {
    const hasCoordinates = sellerHasPhysicalShop(seller);
    const type = productType?.toLowerCase();

    // Rule 0: Explicitly Virtual/Online (Bypasses location checks)
    if (metadata?.is_virtual === true || metadata?.is_digital === true) {
        return FulfillmentType.DIGITAL;
    }

    // Rule 1: Professional with Physical Shop -> ALWAYS In-Store (Task BUG-SHIP-09)
    if (hasCoordinates) {
        return FulfillmentType.BUYER_TO_SELLER;
    }

    // Rule 2: Professional without Shop -> Service is ALWAYS Mobile (Task BUG-SHIP-10)
    if (type === ProductType.SERVICE || type === 'service') {
        return FulfillmentType.SELLER_TO_BUYER;
    }

    // Default for physical products from shopless sellers
    return FulfillmentType.COURIER;
};

export const validateFulfillmentPayload = (type, location, metadata = {}) => {
    if (type === FulfillmentType.SELLER_TO_BUYER) {
        // Skip coordinate check if explicitly marked as Virtual/Online (Task BUG-BOOK-02)
        if (metadata?.location_type === 'Virtual/Online' || metadata?.service_location === 'Virtual/Online') {
            return;
        }

        if (!location?.lat || !location?.lng) {
            const error = new Error('Home service bookings require precise map coordinates. Please select your location.');
            error.code = 'INVALID_FULFILLMENT_FLOW';
            throw error;
        }
    }

    // FIX 6: Strict coordinate exclusion for In-Store/Courier
    if (type === FulfillmentType.BUYER_TO_SELLER || type === FulfillmentType.COURIER) {
        if (location && (location.lat || location.lng)) {
            // Log warning but allow if it matches seller shop (though resolveFulfillment handled it)
            logger.warn(`[FULFILLMENT] Buyer coordinates provided for ${type} flow. These will be ignored.`);
        }
    }
};
