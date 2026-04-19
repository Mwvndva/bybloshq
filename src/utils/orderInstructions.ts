export const getOrderInstruction = (status: string, userRole: 'buyer' | 'seller', orderType: string, sellerHasShop: boolean) => {
    const isBuyer = userRole === 'buyer';
    const isPhysical = orderType === 'PHYSICAL';
    const isService = orderType === 'SERVICE';
    const isDigital = orderType === 'DIGITAL';
    const isSystemDelivery = isPhysical && !sellerHasShop;
    const isShopPickup = isPhysical && sellerHasShop;

    const instructions: any = {
        buyer: {
            PENDING: isDigital
                ? "⬇️ Your digital product will be available for download once payment is confirmed."
                : isSystemDelivery
                    ? "⏳ Payment confirmed! The seller will drop off your item at our hub. You'll be notified when it arrives."
                    : isShopPickup
                        ? "⏳ Payment confirmed! The seller is preparing your item. We'll notify you when it's ready for collection."
                        : isService
                            ? "✅ Booking confirmed! Be at your location at the scheduled time."
                            : "⏳ Your order is being processed.",

            RESERVED: "⏳ Your order slot is reserved. Awaiting payment confirmation.",

            PROCESSING: isService
                ? "⏳ The seller is preparing for your appointment."
                : "📦 The seller is packing your items.",

            SERVICE_PENDING: "📅 Booking confirmed! The professional will arrive at your location at the scheduled time. Please be ready.",

            DELIVERY_PENDING: isSystemDelivery
                ? "🚚 Your order is on its way to our hub. You'll be notified when it arrives for collection."
                : "🚚 Your order is on its way to you!",

            COLLECTION_PENDING: isShopPickup
                ? "📍 YOUR ORDER IS READY! Please visit the shop to collect your items."
                : `📍 YOUR ORDER HAS ARRIVED AT THE HUB! Visit our collection point to pick up your package.`,

            DELIVERY_COMPLETE: `📍 Your order has arrived! Please visit the collection point to pick it up.`,

            COMPLETED: "✅ Order complete! Thank you for shopping with Byblos.",

            CANCELLED: "❌ This order has been cancelled. If you were charged, your refund has been added to your account balance.",

            FAILED: "❌ Payment was not completed for this order.",
        },

        seller: {
            PENDING: isSystemDelivery
                ? `📦 New order! Please drop off the items at the hub within 48 hours to avoid cancellation.`
                : isShopPickup
                    ? "🛍️ New order! Prepare the items for buyer collection. Update status when ready."
                    : isService
                        ? "📅 New booking! Confirm the appointment and prepare for the service."
                        : "🔔 New order received! Begin processing.",

            RESERVED: "⏳ Order slot reserved. Waiting for payment confirmation.",

            PROCESSING: "⚙️ Order in progress. Update status when ready for delivery/collection.",

            SERVICE_PENDING: "🔔 NEW SERVICE BOOKING! Confirm via your dashboard to begin the appointment.",

            DELIVERY_PENDING: isSystemDelivery
                ? "📦 Items dispatched to hub. Logistics tracking initiated."
                : "🚚 Order dispatched. Update when delivered.",

            COLLECTION_PENDING: "✅ Items ready for collection. Hand over to buyer and mark as complete.",

            DELIVERY_COMPLETE: "✅ Delivery complete. Waiting for buyer confirmation.",

            COMPLETED: "🎉 Order completed! Funds have been released to your wallet.",

            CANCELLED: "❌ Order cancelled. Inventory has been restored.",

            FAILED: "❌ Payment failed for this order.",
        }
    };

    return instructions[userRole]?.[status] || null;
};

export const getInstructionColorClass = (status: string) => {
    switch (status.toUpperCase()) {
        case 'PENDING':
        case 'RESERVED':
        case 'PROCESSING':
            return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
        case 'SERVICE_PENDING':
        case 'DELIVERY_PENDING':
        case 'COLLECTION_PENDING':
        case 'DELIVERY_COMPLETE':
            return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
        case 'COMPLETED':
            return 'bg-green-500/10 border-green-500/20 text-green-400';
        case 'CANCELLED':
        case 'FAILED':
            return 'bg-red-500/10 border-red-500/20 text-red-400';
        default:
            return 'bg-white/5 border-white/10 text-white/60';
    }
};
