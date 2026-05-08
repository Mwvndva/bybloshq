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


export const sanitizeBuyer = (buyer) => {
    if (!buyer) return null;
    const b = buyer.toJSON ? buyer.toJSON() : buyer;

    return {
        id: b.id,
        fullName: b.fullName || b.full_name || b.name || '',
        email: b.email,
        whatsappNumber: b.whatsappNumber || b.whatsapp_number || null,
        mobilePayment: b.mobilePayment || b.mobile_payment || b.payment_phone || null,
        city: b.city,
        location: b.location,
        fullAddress: b.fullAddress || b.full_address,
        latitude: b.latitude,
        longitude: b.longitude,
        refunds: b.refunds || 0,
        hasLocation: !!(b.latitude && b.longitude),
        is_verified: !!(b.is_verified || b.isVerified),
        role: 'buyer',
        createdAt: b.createdAt || b.created_at || null,
    };
};

export const sanitizeSeller = (seller) => {
    if (!seller) return null;
    const s = seller.toJSON ? seller.toJSON() : seller;

    return {
        id: s.id,
        fullName: s.fullName || s.full_name || '',
        shopName: s.shopName || s.shop_name || '',
        email: s.email,
        whatsappNumber: s.whatsappNumber || s.whatsapp_number || s.phone || '',
        city: s.city,
        location: s.location,
        physicalAddress: s.physicalAddress || s.physical_address || null,
        latitude: s.latitude ? Number.parseFloat(s.latitude) : null,
        longitude: s.longitude ? Number.parseFloat(s.longitude) : null,
        bannerImage: s.bannerImage || s.banner_image,
        avatarUrl: s.avatarUrl || s.avatar_url || null,
        bio: s.bio || '',
        theme: s.theme,
        instagramLink: s.instagramLink || s.instagram_link,
        tiktokLink: s.tiktokLink || s.tiktok_link,
        facebookLink: s.facebookLink || s.facebook_link,
        hasPhysicalShop: !!(s.physicalAddress || s.physical_address),
        is_verified: !!(s.is_verified || s.isVerified),
        clientCount: Number.parseInt(s.clientCount || s.client_count || 0),
        totalSales: Number.parseFloat(s.totalSales || s.total_sales || 0),
        balance: Number.parseFloat(s.balance || 0),
    };
};

/**
 * Sanitize a product object for the seller dashboard response.
 * The seller owns these products — they can see management fields.
 * BUT server file paths (digital_file_path) must never leave the server.
 */
export const sanitizeProduct = (product) => {
    if (!product) return null;
    const p = product.toObject ? product.toObject() : product;

    return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number.parseFloat(p.price),
        image_url: p.image_url,
        images: (() => {
            try { return typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []); }
            catch { return []; }
        })(),
        aesthetic: p.aesthetic,
        status: p.status || 'available',
        is_digital: !!(p.is_digital || p.isDigital),
        // digital_file_path: NEVER returned — server-side path only
        digital_file_name: p.digital_file_name || p.digitalFileName || null, // filename ok, path not ok
        product_type: p.product_type || p.productType || 'physical',
        service_options: p.service_options || p.serviceOptions || null,
        track_inventory: !!(p.track_inventory),          // boolean, not the quantity
        quantity: p.track_inventory ? (p.quantity ?? null) : null, // only show if tracking
        low_stock_threshold: p.track_inventory ? (p.low_stock_threshold ?? 5) : null,
        is_sold: !!(p.is_sold || p.isSold),
        sold_at: p.sold_at || p.soldAt || null,
        created_at: p.created_at || p.createdAt,
        updated_at: p.updated_at || p.updatedAt,
    };
};

/**
 * STRONGER PUBLIC SANITIZATION
 * Used for public storefront and product listings
 */
export const sanitizePublicProduct = (product) => {
    if (!product) return null;
    const p = product.toJSON ? product.toJSON() : product;

    return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number.parseFloat(p.price),
        image_url: p.image_url || p.imageUrl,
        images: (() => {
            try { return typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []); }
            catch { return []; }
        })(),
        aesthetic: p.aesthetic,
        status: p.status || 'available',
        is_digital: !!(p.is_digital || p.isDigital),
        product_type: p.product_type || p.productType || 'physical',
        service_options: p.service_options || p.serviceOptions || null,
        is_sold: !!(p.is_sold || p.isSold || p.status === 'sold'),
        created_at: p.created_at || p.createdAt,
        // NEVER: digital_file_path, quantity, low_stock_threshold, track_inventory, seller_id (if nested)
    };
};

// For public seller profile (viewed by buyers)
export const sanitizePublicSeller = (seller) => {
    if (!seller) return null;
    const sellerObj = seller.toJSON ? seller.toJSON() : seller;

    return {
        id: sellerObj.id || sellerObj.seller_id,
        shopName: sellerObj.shopName || sellerObj.shop_name || '',
        bannerImage: sellerObj.bannerImage || sellerObj.banner_image,
        avatarUrl: sellerObj.avatarUrl || sellerObj.avatar_url,
        bio: sellerObj.bio,
        theme: sellerObj.theme || 'black',
        physicalAddress: sellerObj.physicalAddress || sellerObj.physical_address || null,
        latitude: sellerObj.latitude ? Number.parseFloat(sellerObj.latitude) : null,
        longitude: sellerObj.longitude ? Number.parseFloat(sellerObj.longitude) : null,
        hasPhysicalShop: !!(sellerObj.physicalAddress || sellerObj.physical_address),
        clientCount: Number.parseInt(sellerObj.clientCount || sellerObj.client_count || 0),
        totalWishlistCount: Number.parseInt(sellerObj.totalWishlistCount || sellerObj.total_wishlist_count || 0),
        wishlistCount: Number.parseInt(sellerObj.wishlistCount || sellerObj.wishlist_count || sellerObj.totalWishlistCount || sellerObj.total_wishlist_count || 0),
        knockCount: Number.parseInt(sellerObj.knockCount || sellerObj.knock_count || 0)
        // STRICTLY REMOVED: email, phone, whatsappNumber, fullName, balance, revenue, internal IDs, coordinates
    };
};

export const sanitizeOrder = (order, userType = 'buyer') => {
    if (!order) return null;
    const orderObj = order.toObject ? order.toObject() : order;

    // Safe items — strip internal inventory and tracking fields
    const safeItems = (orderObj.items || []).map(item => ({
        id: item.id,
        productId: item.productId || item.product_id,
        name: item.name || item.product_name,
        price: Number.parseFloat(item.price || item.product_price || 0),
        quantity: Number.parseInt(item.quantity || 1),
        subtotal: Number.parseFloat(item.subtotal || 0),
        imageUrl: item.imageUrl || item.image_url || null,
        productType: item.productType || item.product_type || 'physical',
        isDigital: !!(item.isDigital || item.is_digital),
        // NEVER: trackInventory, availableQuantity, serviceLocations internals, metadata raw
    }));

    const baseOrder = {
        id: orderObj.id,
        orderNumber: orderObj.orderNumber || orderObj.order_number,
        status: orderObj.status,
        paymentStatus: orderObj.paymentStatus || orderObj.payment_status,
        totalAmount: Number.parseFloat(orderObj.totalAmount || orderObj.total_amount || 0),
        paymentMethod: orderObj.paymentMethod || orderObj.payment_method,
        notes: orderObj.notes || '',
        createdAt: orderObj.createdAt || orderObj.created_at,
        updatedAt: orderObj.updatedAt || orderObj.updated_at,
        paidAt: orderObj.paidAt || orderObj.paid_at || null,
        completedAt: orderObj.completedAt || orderObj.completed_at || null,
        cancelledAt: orderObj.cancelledAt || orderObj.cancelled_at || null,
        items: safeItems,
        isDigital: (orderObj.items || []).some(i => i.isDigital || i.is_digital),
        metadata: {
            product_type: orderObj.metadata?.product_type || null,
        },
        fulfillment_type: orderObj.fulfillment_type || orderObj.fulfillmentType || null,
        location_address: orderObj.location_address || orderObj.locationAddress || null,
        location_lat: orderObj.location_lat || orderObj.locationLat || null,
        location_lng: orderObj.location_lng || orderObj.locationLng || null,
        seller: orderObj.seller ? {
            id: orderObj.seller.id,
            shopName: orderObj.seller.shopName,
            theme: orderObj.seller.theme,
            isClient: orderObj.seller.isClient || false,
        } : null,
    };

    if (userType === 'seller' || userType === 'admin') {
        return {
            ...baseOrder,
            platformFeeAmount: Number.parseFloat(orderObj.platformFeeAmount || orderObj.platform_fee_amount || 0),
            sellerPayoutAmount: Number.parseFloat(orderObj.sellerPayoutAmount || orderObj.seller_payout_amount || 0),
            buyerName: orderObj.buyerName || orderObj.buyer_name || '',
            buyerWhatsAppNumber: orderObj.buyerWhatsAppNumber || orderObj.buyer_whatsapp_number || '',
            buyerMobilePayment: orderObj.buyerMobilePayment || orderObj.buyer_mobile_payment || '',
            isSellerInitiated: orderObj.isSellerInitiated || orderObj.is_seller_initiated || false,
        };
    }

    return baseOrder;
};

export const sanitizeWithdrawalRequest = (request) => {
    if (!request) return null;
    const reqObj = request.toObject ? request.toObject() : request;

    return {
        id: reqObj.id,
        amount: Number.parseFloat(reqObj.amount),
        status: reqObj.status,
        mpesaNumber: reqObj.mpesaNumber || reqObj.mpesa_number, // User's own number
        mpesaName: reqObj.mpesaName || reqObj.mpesa_name,       // User's own name
        createdAt: reqObj.createdAt || reqObj.created_at,
        failureReason: reqObj.failureReason || reqObj.failure_reason, // Helpful for user
        message: reqObj.message // Helper message if we added one
        // Removed: updatedAt, provider_reference, raw_response, internal IDs
    };
};
