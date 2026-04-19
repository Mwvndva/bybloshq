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
 * 
 * Logic Flow:
 * 1. Virtual/Digital metadata -> DIGITAL
 * 2. Seller has physical shop -> BUYER_TO_SELLER (Always pickup)
 * 3. Service product (no shop) -> SELLER_TO_BUYER (Mobile service)
 * 4. Physical product (no shop) -> COURIER (Platform managed delivery)
 * 
 * @param {Object} seller - Seller object with shop data
 * @param {string} productType - 'physical', 'service', or 'digital'
 * @param {Object} metadata - Optional product metadata
 * @returns {string} FulfillmentType
 */
export const resolveFulfillmentType = (seller, productType, metadata = {}) => {
    const hasCoordinates = sellerHasPhysicalShop(seller);
    const type = productType?.toLowerCase();

    // Rule 1: High-priority Virtual/Digital override
    if (metadata?.is_virtual === true || metadata?.is_digital === true || type === 'digital') {
        return FulfillmentType.DIGITAL;
    }

    // Rule 2: Physical shop presence mandates in-store fulfillment
    if (hasCoordinates) {
        return FulfillmentType.BUYER_TO_SELLER;
    }

    // Rule 3: Services from non-shop sellers are mobile/home services
    if (type === ProductType.SERVICE || type === 'service') {
        return FulfillmentType.SELLER_TO_BUYER;
    }

    // Rule 4: Default for physical items without a shop is courier delivery
    return FulfillmentType.COURIER;
};

/**
 * Validates that the order payload contains the necessary location data for the fulfillment type.
 * 
 * @param {string} type - FulfillmentType
 * @param {Object} location - Location object { lat, lng, address }
 * @param {Object} metadata - Optional order metadata
 */
export const validateFulfillmentPayload = (type, location, metadata = {}) => {
    if (type === FulfillmentType.SELLER_TO_BUYER) {
        // Skip check for virtual services
        if (metadata?.location_type === 'Virtual/Online' || metadata?.service_location === 'Virtual/Online') {
            return;
        }

        if (!location?.lat || !location?.lng || !location?.address) {
            const error = new Error('Mobile/Home services require a valid delivery address and map coordinates. Please update your location.');
            error.code = 'INVALID_FULFILLMENT_DATA';
            throw error;
        }
    }

    // Coordinates are redundant for in-store or courier flows initiated by buyer info
    if (type === FulfillmentType.BUYER_TO_SELLER || type === FulfillmentType.COURIER) {
        if (location && (location.lat || location.lng)) {
            logger.debug(`[FULFILLMENT] Buyer coordinates provided for ${type} flow; ignoring as redundant.`);
        }
    }
};

