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
        physicalAddress: s.physicalAddress || s.physical_address || null,
        latitude: s.latitude ? Number.parseFloat(s.latitude) : null,
        longitude: s.longitude ? Number.parseFloat(s.longitude) : null,
        bannerImage: s.bannerImage || s.banner_image,
        theme: s.theme,
        instagramLink: s.instagramLink || s.instagram_link,
        tiktokLink: s.tiktokLink || s.tiktok_link,
        facebookLink: s.facebookLink || s.facebook_link,
        hasPhysicalShop: !!(s.physicalAddress || s.physical_address),
        is_verified: !!(s.is_verified || s.isVerified),
        clientCount: Number.parseInt(s.clientCount || s.client_count || 0),
        totalSales: Number.parseFloat(s.totalSales || s.total_sales || 0),
    };
};

/**
 * Sanitize a product object for the seller dashboard response.
 * Server file paths (digital_file_path) must never leave the server.
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
        digital_file_name: p.digital_file_name || p.digitalFileName || null,
        product_type: p.product_type || p.productType || 'physical',
        service_options: p.service_options || p.serviceOptions || null,
        track_inventory: !!(p.track_inventory),
        quantity: p.track_inventory ? (p.quantity ?? null) : null,
        low_stock_threshold: p.track_inventory ? (p.low_stock_threshold ?? 5) : null,
        is_sold: !!(p.is_sold || p.isSold),
        sold_at: p.sold_at || p.soldAt || null,
        created_at: p.created_at || p.createdAt,
        updated_at: p.updated_at || p.updatedAt,
    };
};

/**
 * STRONGER PUBLIC SANITIZATION
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
    };
};

// For public seller profile (viewed by buyers)
export const sanitizePublicSeller = (seller) => {
    if (!seller) return null;
    const s = seller.toJSON ? seller.toJSON() : seller;

    return {
        id: s.id || s.seller_id,
        shopName: s.shopName || s.shop_name || '',
        bannerImage: s.bannerImage || s.banner_image,
        avatarUrl: s.avatarUrl || s.avatar_url,
        bio: s.bio,
        theme: s.theme || 'black',
        physicalAddress: s.physicalAddress || s.physical_address || null,
        latitude: s.latitude ? Number.parseFloat(s.latitude) : null,
        longitude: s.longitude ? Number.parseFloat(s.longitude) : null,
        hasPhysicalShop: !!(s.physicalAddress || s.physical_address),
        clientCount: Number.parseInt(s.clientCount || s.client_count || 0)
    };
};

export const sanitizeOrder = (order, userType = 'buyer') => {
    if (!order) return null;
    const o = order.toObject ? order.toObject() : order;

    const safeItems = (o.items || []).map(item => ({
        id: item.id,
        productId: item.productId || item.product_id,
        name: item.name || item.product_name,
        price: Number.parseFloat(item.price || item.product_price || 0),
        quantity: Number.parseInt(item.quantity || 1),
        subtotal: Number.parseFloat(item.subtotal || 0),
        imageUrl: item.imageUrl || item.image_url || null,
        productType: item.productType || item.product_type || 'physical',
        isDigital: !!(item.isDigital || item.is_digital),
    }));

    const baseOrder = {
        id: o.id,
        orderNumber: o.orderNumber || o.order_number,
        status: o.status,
        paymentStatus: o.paymentStatus || o.payment_status,
        totalAmount: Number.parseFloat(o.totalAmount || o.total_amount || 0),
        paymentMethod: o.paymentMethod || o.payment_method,
        notes: o.notes || '',
        createdAt: o.createdAt || o.created_at,
        updatedAt: o.updatedAt || o.updated_at,
        paidAt: o.paidAt || o.paid_at || null,
        completedAt: o.completedAt || o.completed_at || null,
        cancelledAt: o.cancelledAt || o.cancelled_at || null,
        items: safeItems,
        isDigital: (o.items || []).some(i => i.isDigital || i.is_digital),
        metadata: {
            product_type: o.metadata?.product_type || null,
        },
        fulfillment_type: o.fulfillment_type || o.fulfillmentType || null,
        location_address: o.location_address || o.locationAddress || null,
        location_lat: o.location_lat || o.locationLat || null,
        location_lng: o.location_lng || o.locationLng || null,
        seller: o.seller ? {
            id: o.seller.id,
            shopName: o.seller.shopName,
            theme: o.seller.theme,
            isClient: o.seller.isClient || false,
        } : null,
    };

    if (userType === 'seller' || userType === 'admin') {
        return {
            ...baseOrder,
            platformFeeAmount: Number.parseFloat(o.platformFeeAmount || o.platform_fee_amount || 0),
            sellerPayoutAmount: Number.parseFloat(o.sellerPayoutAmount || o.seller_payout_amount || 0),
            buyerName: o.buyerName || o.buyer_name || '',
            buyerWhatsAppNumber: o.buyerWhatsAppNumber || o.buyer_whatsapp_number || '',
            buyerMobilePayment: o.buyerMobilePayment || o.buyer_mobile_payment || '',
            isSellerInitiated: o.isSellerInitiated || o.is_seller_initiated || false,
        };
    }

    return baseOrder;
};

export const sanitizeWithdrawalRequest = (request) => {
    if (!request) return null;
    const r = request.toObject ? request.toObject() : request;

    return {
        id: r.id,
        amount: Number.parseFloat(r.amount),
        status: r.status,
        mpesaNumber: r.mpesaNumber || r.mpesa_number,
        mpesaName: r.mpesaName || r.mpesa_name,
        createdAt: r.createdAt || r.created_at,
        failureReason: r.failureReason || r.failure_reason,
        message: r.message
    };
};

