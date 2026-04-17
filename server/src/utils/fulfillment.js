import { ProductType } from '../constants/enums.js';
import { sellerHasPhysicalShop } from './sellerUtils.js';

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
export const resolveFulfillmentType = (seller, productType) => {
    const hasCoordinates = sellerHasPhysicalShop(seller);
    const type = productType?.toLowerCase();

    // Rule 1: Seller with shop coordinates
    if (hasCoordinates) {
        return FulfillmentType.BUYER_TO_SELLER;
    }

    // Rule 2: Seller without coordinates
    if (type === 'digital') return FulfillmentType.DIGITAL;

    if (type === 'service') {
        return FulfillmentType.SELLER_TO_BUYER;
    }

    // Default for physical products from shopless sellers
    return FulfillmentType.COURIER;
};

/**
 * Validates if the provided payload matches the fulfillment requirements.
 * 
 * @param {string} type - Resolved FulfillmentType
 * @param {Object} location - Provided location {lat, lng, address}
 * @throws {Error} if validation fails
 */
export const validateFulfillmentPayload = (type, location) => {
    if (type === FulfillmentType.SELLER_TO_BUYER) {
        if (!location?.lat || !location?.lng) {
            const error = new Error('Booking must fail if coordinates are missing');
            error.code = 'INVALID_FULFILLMENT_FLOW';
            throw error;
        }
    }

    if (type === FulfillmentType.BUYER_TO_SELLER || type === FulfillmentType.COURIER) {
        if (location && (location.lat || location.lng)) {
            // Rule 1 & 2 (Physical): Reject buyer coordinates
            const error = new Error('Buyer coordinates MUST NOT be collected for this fulfillment type');
            error.code = 'INVALID_FULFILLMENT_FLOW';
            throw error;
        }
    }
};
