/**
 * sellerUtils.js
 * Centralized logic for seller-related business rules.
 */

/**
 * Determines if a seller has a physical shop address.
 * Standardizes detection across OrderService, WhatsAppService, and Controllers.
 * 
 * A seller HAS a physical shop IF:
 * 1. A physical address is present
 * 2. Latitude and Longitude are both present (not null/undefined/0)
 * 3. Coordinates are NOT the Nairobi sentinel placeholder (-1.2921, 36.8219)
 * 
 * @param {Object} seller - Seller object from database
 * @returns {boolean}
 */
export const sellerHasPhysicalShop = (seller) => {
    if (!seller) return false;

    const physicalAddress = String(seller.physical_address || seller.physicalAddress || '').trim();
    if (!physicalAddress) return false;

    const lat = parseFloat(seller.latitude);
    const lng = parseFloat(seller.longitude);

    // Check for presence and valid non-zero values
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return false;

    // Check against Nairobi sentinel placeholder (-1.2921, 36.8219)
    // We use a small epsilon for floating point comparison
    const NAIROBI_SENTINEL = { lat: -1.2921, lng: 36.8219 };
    const isSentinel = Math.abs(lat - NAIROBI_SENTINEL.lat) < 0.0001 &&
        Math.abs(lng - NAIROBI_SENTINEL.lng) < 0.0001;

    return !isSentinel;
};
