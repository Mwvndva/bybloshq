/**
 * Sanitization and DTO helper functions
 * Used to whitelist only allowed fields for frontend responses using whitelisting approach
 */

// Helper to strictly pick keys
const pick = (obj, keys) => {
    if (!obj) return null;
    return keys.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            acc[key] = obj[key];
        }
        return acc;
    }, {});
};

export const sanitizeOrganizer = (organizer) => {
    if (!organizer) return null;
    const orgObj = organizer.toObject ? organizer.toObject() : organizer;

    return pick(orgObj, [
        'id',
        'full_name',
        'email',
        'whatsapp_number',
        'whatsappNumber'
    ]);
};

export const sanitizeBuyer = (buyer) => {
    if (!buyer) return null;
    const buyerObj = buyer.toObject ? buyer.toObject() : buyer;

    // Extract first name from full name
    const fullName = buyerObj.fullName || buyerObj.full_name || '';
    const firstName = fullName.split(' ')[0]; // Get first word as first name

    // Return minimal profile data
    return {
        id: buyerObj.id,
        firstName: firstName, // Only first name, not full name
        city: buyerObj.city,
        location: buyerObj.location,
        mobilePayment: buyerObj.mobilePayment || buyerObj.mobile_payment,
        whatsappNumber: buyerObj.whatsappNumber || buyerObj.whatsapp_number,
        email: buyerObj.email
    };
};

export const sanitizeSeller = (seller) => {
    if (!seller) return null;
    const sellerObj = seller.toObject ? seller.toObject() : seller;

    return {
        id: sellerObj.id,
        fullName: sellerObj.fullName || sellerObj.full_name,
        shopName: sellerObj.shopName || sellerObj.shop_name,
        email: sellerObj.email, // Needed for owner
        whatsappNumber: sellerObj.whatsappNumber || sellerObj.whatsapp_number || sellerObj.phone,
        city: sellerObj.city,
        location: sellerObj.location,
        bannerImage: sellerObj.bannerImage || sellerObj.banner_image,
        theme: sellerObj.theme,
        physicalAddress: sellerObj.physicalAddress || sellerObj.physical_address,
        latitude: sellerObj.latitude,
        longitude: sellerObj.longitude,
        instagramLink: sellerObj.instagramLink || sellerObj.instagram_link
        // Removed: createdAt, updatedAt, userId, totalSales, netRevenue, balance
        // Balance and revenue should come from analytics endpoint, not profile
    };
};

// For public seller profile (viewed by buyers)
export const sanitizePublicSeller = (seller) => {
    if (!seller) return null;
    const sellerObj = seller.toObject ? seller.toObject() : seller;

    return {
        id: sellerObj.id,
        shopName: sellerObj.shopName || sellerObj.shop_name,
        city: sellerObj.city,
        location: sellerObj.location,
        bannerImage: sellerObj.bannerImage || sellerObj.banner_image,
        theme: sellerObj.theme,
        physicalAddress: sellerObj.physicalAddress || sellerObj.physical_address,
        latitude: sellerObj.latitude,
        longitude: sellerObj.longitude,
        instagramLink: sellerObj.instagramLink || sellerObj.instagram_link
        // Removed: createdAt - no need to expose when shop was created
        // NO email, phone, balance, revenue, internal IDs
    };
};

export const sanitizeOrder = (order, userType = 'buyer') => {
    if (!order) return null;
    const orderObj = order.toObject ? order.toObject() : order;

    // Debug logging
    if (orderObj.id === 63) {
        console.log('=== SANITIZING ORDER 63 ===');
        console.log('Raw order object keys:', Object.keys(orderObj));
        console.log('payment_status:', orderObj.payment_status);
        console.log('paymentStatus:', orderObj.paymentStatus);
        console.log('status:', orderObj.status);
    }

    const baseOrder = {
        id: orderObj.id,
        orderNumber: orderObj.orderNumber || orderObj.order_number,
        status: orderObj.status,
        paymentStatus: orderObj.paymentStatus || orderObj.payment_status,
        totalAmount: parseFloat(orderObj.totalAmount || orderObj.total_amount || 0),
        shippingAddress: orderObj.shippingAddress || orderObj.shipping_address || {},
        paymentMethod: orderObj.paymentMethod || orderObj.payment_method,
        // paymentReference: orderObj.paymentReference || orderObj.payment_reference, // Maybe sensitive? Keep for now as it's useful for support
        notes: orderObj.notes || '',
        createdAt: orderObj.createdAt || orderObj.created_at,
        updatedAt: orderObj.updatedAt || orderObj.updated_at,
        paidAt: orderObj.paidAt || orderObj.paid_at,
        completedAt: orderObj.completedAt || orderObj.completed_at,
        cancelledAt: orderObj.cancelledAt || orderObj.cancelled_at,
        items: (orderObj.items || []).map(item => ({
            id: item.id,
            productId: item.productId || item.product_id,
            name: item.name || item.product_name,
            price: parseFloat(item.price || item.product_price),
            quantity: parseInt(item.quantity),
            imageUrl: item.imageUrl,
            productType: item.productType || item.product_type,
            subtotal: parseFloat(item.subtotal),
            metadata: item.metadata || {}
        })),
        metadata: orderObj.metadata || {}, // Be careful what goes here
    };

    if (userType === 'seller') {
        // Seller gets to see fee breakdown
        return {
            ...baseOrder,
            platformFeeAmount: parseFloat(orderObj.platformFeeAmount || orderObj.platform_fee_amount || 0),
            sellerPayoutAmount: parseFloat(orderObj.sellerPayoutAmount || orderObj.seller_payout_amount || 0),
            buyerName: orderObj.buyerName || orderObj.buyer_name,
            buyerEmail: orderObj.buyerEmail || orderObj.buyer_email,
            buyerMobilePayment: orderObj.buyerMobilePayment || orderObj.buyer_mobile_payment,
            buyerWhatsAppNumber: orderObj.buyerWhatsAppNumber || orderObj.buyer_whatsapp_number || orderObj.buyerPhone || orderObj.buyer_phone,
            customer: orderObj.customer // Full customer details if available
        };
    } else {
        // Buyer views minimal info
        return {
            ...baseOrder,
            // Explicitly REMOVE financial breakdown that concerns the platform/seller agreement
        };
    }
};

export const sanitizeWithdrawalRequest = (request) => {
    if (!request) return null;
    const reqObj = request.toObject ? request.toObject() : request;

    return {
        id: reqObj.id,
        amount: parseFloat(reqObj.amount),
        status: reqObj.status,
        mpesaNumber: reqObj.mpesaNumber || reqObj.mpesa_number, // User's own number
        mpesaName: reqObj.mpesaName || reqObj.mpesa_name,       // User's own name
        createdAt: reqObj.createdAt || reqObj.created_at,
        failureReason: reqObj.failureReason || reqObj.failure_reason, // Helpful for user
        message: reqObj.message // Helper message if we added one
        // Removed: updatedAt, provider_reference, raw_response, internal IDs
    };
};
