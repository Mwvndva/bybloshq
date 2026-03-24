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
    const b = buyer.toObject ? buyer.toObject() : buyer;

    return {
        id: b.id,
        name: b.fullName || b.full_name || b.name || '',
        email: b.email,
        // Phone numbers shown masked — full numbers only needed in order flow, not profile display
        whatsappNumber: b.whatsappNumber || b.whatsapp_number || null,
        mobilePayment: b.mobilePayment || b.mobile_payment || b.payment_phone || null,
        city: b.city || null,
        location: b.location || b.physical_address || null,
        // Coordinates: boolean presence only — full coords not needed by the frontend profile UI
        hasLocation: !!(b.latitude && b.longitude),
        role: 'buyer',
        createdAt: b.createdAt || b.created_at || null,
        // NEVER return: user_id, password, password_hash, refunds, full_address,
        // latitude, longitude, userId, reset tokens, internal flags
    };
};

export const sanitizeSeller = (seller) => {
    if (!seller) return null;
    const sellerObj = seller.toObject ? seller.toObject() : seller;

    // Owner-facing DTO: only what the dashboard UI needs to render
    // NO coordinates, NO phone numbers, NO contact links
    return {
        id: sellerObj.id,
        fullName: sellerObj.fullName || sellerObj.full_name,
        shopName: sellerObj.shopName || sellerObj.shop_name,
        email: sellerObj.email,           // Needed: displayed in seller settings page
        city: sellerObj.city,
        location: sellerObj.location,
        bannerImage: sellerObj.bannerImage || sellerObj.banner_image,
        theme: sellerObj.theme,
        hasPhysicalShop: !!(sellerObj.physicalAddress || sellerObj.physical_address), // boolean only — not the address string
        clientCount: parseInt(sellerObj.clientCount || sellerObj.client_count || 0),
        totalSales: parseFloat(sellerObj.totalSales || sellerObj.total_sales || 0),
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
        price: parseFloat(p.price),
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
        service_locations: p.service_locations || p.serviceLocations || null,
        service_options: p.service_options || p.serviceOptions || null,
        track_inventory: !!(p.track_inventory),          // boolean, not the quantity
        quantity: p.track_inventory ? (p.quantity ?? null) : null, // only show if tracking
        low_stock_threshold: p.track_inventory ? (p.low_stock_threshold ?? 5) : null,
        is_sold: !!(p.is_sold || p.isSold),
        sold_at: p.sold_at || p.soldAt || null,
        created_at: p.created_at || p.createdAt,
        updated_at: p.updated_at || p.updatedAt,
        // seller_id: NEVER returned — client already knows their own ID
    };
};

/**
 * Sanitize a product for public display (shop page / buyer view).
 * Strips all internal management fields.
 */
export const sanitizePublicProduct = (product) => {
    if (!product) return null;
    const p = product.toObject ? product.toObject() : product;

    return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: parseFloat(p.price),
        image_url: p.image_url,
        images: (() => {
            try { return typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []); }
            catch { return []; }
        })(),
        aesthetic: p.aesthetic,
        status: p.status || 'available',
        is_digital: !!(p.is_digital || p.isDigital),
        product_type: p.product_type || p.productType || 'physical',
        service_locations: p.service_locations || p.serviceLocations || null,
        service_options: p.service_options || p.serviceOptions || null,
        is_sold: !!(p.is_sold || p.isSold),
        // NO: seller_id, digital_file_path, digital_file_name, track_inventory, quantity, low_stock_threshold
    };
};

// For public seller profile (viewed by buyers)
export const sanitizePublicSeller = (seller) => {
    if (!seller) return null;
    const sellerObj = seller.toObject ? seller.toObject() : seller;

    return {
        id: sellerObj.id,
        shopName: sellerObj.shopName || sellerObj.shop_name,
        fullName: sellerObj.fullName || sellerObj.full_name, // Needed for shop page "By {name}" display
        city: sellerObj.city,
        location: sellerObj.location,
        bannerImage: sellerObj.bannerImage || sellerObj.banner_image,
        theme: sellerObj.theme,
        physicalAddress: sellerObj.physicalAddress || sellerObj.physical_address,
        latitude: sellerObj.latitude,
        longitude: sellerObj.longitude,
        instagramLink: sellerObj.instagramLink || sellerObj.instagram_link,
        tiktokLink: sellerObj.tiktokLink || sellerObj.tiktok_link,
        facebookLink: sellerObj.facebookLink || sellerObj.facebook_link,
        clientCount: parseInt(sellerObj.clientCount || sellerObj.client_count || 0)
        // NO email, phone, balance, revenue, internal IDs
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
        price: parseFloat(item.price || item.product_price || 0),
        quantity: parseInt(item.quantity || 1),
        subtotal: parseFloat(item.subtotal || 0),
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
        totalAmount: parseFloat(orderObj.totalAmount || orderObj.total_amount || 0),
        paymentMethod: orderObj.paymentMethod || orderObj.payment_method,
        shippingAddress: orderObj.shippingAddress || orderObj.shipping_address || {},
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
        seller: orderObj.seller ? {
            id: orderObj.seller.id,
            shopName: orderObj.seller.shopName,
            theme: orderObj.seller.theme,
            city: orderObj.seller.city,
            isClient: orderObj.seller.isClient || false,
        } : null,
    };

    if (userType === 'seller' || userType === 'admin') {
        return {
            ...baseOrder,
            platformFeeAmount: parseFloat(orderObj.platformFeeAmount || orderObj.platform_fee_amount || 0),
            sellerPayoutAmount: parseFloat(orderObj.sellerPayoutAmount || orderObj.seller_payout_amount || 0),
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
