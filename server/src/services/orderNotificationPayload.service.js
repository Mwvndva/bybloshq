class OrderNotificationPayloadService {
  static buildBuyerNotificationData(fullOrder) {
    return {
      name: fullOrder.buyer_name || 'Customer',
      phone: fullOrder.buyer_mobile_payment || 'N/A',
      whatsapp_number: fullOrder.buyer_whatsapp_number || fullOrder.buyer_whatsapp || fullOrder.buyer_mobile_payment,
      email: fullOrder.buyer_email || null,
      location: fullOrder.location_address || 'Not specified',
      latitude: fullOrder.location_lat,
      longitude: fullOrder.location_lng
    };
  }

  static prepareNormalizedNotificationPayload(fullOrder, items = []) {
    const metadata = typeof fullOrder.metadata === 'string' ? JSON.parse(fullOrder.metadata) : (fullOrder.metadata || {});

    return {
      id: fullOrder.id,
      orderNumber: fullOrder.order_number,
      totalAmount: Number.parseFloat(fullOrder.total_amount || 0),
      status: fullOrder.status,
      type: fullOrder.order_type,
      fulfillmentType: fullOrder.fulfillment_type,
      downloadUrl: metadata.download_url || metadata.downloadUrl || null,
      downloadUrls: metadata.download_urls || metadata.downloadUrls || [],
      buyer: {
        userId: fullOrder.buyer_user_id || null,
        name: fullOrder.buyer_name || 'Customer',
        phone: fullOrder.buyer_mobile_payment || 'N/A',
        email: fullOrder.buyer_email || null,
      },
      seller: {
        userId: fullOrder.seller_user_id || null,
        name: fullOrder.seller_name || 'Seller',
        shopName: fullOrder.shop_name || 'Shop',
        phone: fullOrder.seller_phone || 'N/A',
        whatsapp_number: fullOrder.seller_phone || null,
        email: fullOrder.seller_email || null,
        address: fullOrder.seller_address || fullOrder.physical_address || null,
        physicalAddress: fullOrder.seller_address || fullOrder.physical_address || null,
        latitude: fullOrder.seller_latitude || null,
        longitude: fullOrder.seller_longitude || null,
        social: {
          instagram: fullOrder.instagram_link,
          tiktok: fullOrder.tiktok_link,
          facebook: fullOrder.facebook_link
        }
      },
      service: {
        id: fullOrder.metadata?.product_id || (items?.[0]?.product_id || items?.[0]?.id),
        title: fullOrder.service_title || 'Service',
        price: Number.parseFloat(fullOrder.total_amount || 0) / Number.parseInt(fullOrder.total_quantity || 1),
        quantity: Number.parseInt(fullOrder.total_quantity || 1),
        total: Number.parseFloat(fullOrder.total_amount || 0)
      },
      location: {
        address: fullOrder.location_address || fullOrder.shipping_address || 'Not specified',
        lat: Number.parseFloat(fullOrder.location_lat || 0),
        lng: Number.parseFloat(fullOrder.location_lng || 0),
      },
      booking: {
        date: metadata.booking_date || metadata.bookingDate || null,
        time: metadata.booking_time || metadata.bookingTime || null,
        requirements: fullOrder.service_requirements || metadata.service_requirements || metadata.requirements || null,
      },
      payment: {
        status: fullOrder.payment_status || 'pending',
        method: fullOrder.payment_method || 'paystack',
        reference: fullOrder.payment_reference || null
      },
      items: items.map(i => ({
        title: i.product_name || i.name || 'Item',
        price: Number.parseFloat(i.product_price || i.price || 0),
        quantity: Number.parseInt(i.quantity || 1, 10),
        metadata: typeof i.metadata === 'string' ? JSON.parse(i.metadata) : (i.metadata || {})
      })),
      metadata,
      preHandoffSla: metadata.pre_handoff_sla || null,
      customProduct: metadata.custom_product || null,
      customProductionDeadlineAt: fullOrder.custom_production_deadline_at || metadata.pre_handoff_sla?.ready_deadline_at || metadata.custom_product?.production_deadline_at || null,
      customProductionGraceDeadlineAt: fullOrder.custom_production_grace_deadline_at || metadata.pre_handoff_sla?.ready_grace_deadline_at || metadata.custom_product?.production_grace_deadline_at || null
    };
  }

  static extractFromLegacy(order) {
    if (order.location_address) return order;

    const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : (order.metadata || {});
    const buyerLocation = metadata.buyer_location || {};

    return {
      ...order,
      location_address: order.buyer_full_address || buyerLocation.fullAddress || order.buyer_location_text || 'Not specified',
      location_lat: order.buyer_latitude || buyerLocation.latitude || buyerLocation.lat || 0,
      location_lng: order.buyer_longitude || buyerLocation.longitude || buyerLocation.lng || 0,
      service_title: order.service_title || metadata.product_name || (order.items?.[0]?.product_name) || 'Service'
    };
  }
}

export default OrderNotificationPayloadService;
