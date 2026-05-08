// src/utils/orderInstructions.ts

const COURIER_LOCATION = 'Dynamic Mall, Tom Mboya St — Shop SL 32';

export interface OrderInstructionConfig {
    status: string;
    userRole: 'buyer' | 'seller';
    orderType?: string;
    fulfillmentType?: string;
}

export interface OrderInstructionResult {
    text: string;
    color: 'blue' | 'amber' | 'green' | 'red';
}

export const getOrderInstruction = ({
    status,
    userRole,
    orderType = 'PHYSICAL',
    fulfillmentType,
}: OrderInstructionConfig): OrderInstructionResult | null => {

    const isPhysical = orderType === 'PHYSICAL';
    const isService = orderType === 'SERVICE';
    const isDigital = orderType === 'DIGITAL';
    const isShopPickup = fulfillmentType === 'BUYER_TO_SELLER';
    const isCourier = isPhysical && !isShopPickup;

    const instructions: Record<string, Record<string, OrderInstructionResult>> = {
        buyer: {
            PENDING: { text: isDigital ? 'Your download will be available once payment confirms.' : isCourier ? 'Waiting for seller to drop off your item.' : isShopPickup ? 'Seller is preparing your item for shop pickup.' : 'Waiting for seller to confirm your booking.', color: 'blue' },
            RESERVED: { text: 'Slot reserved. Complete payment to confirm.', color: 'blue' },
            PROCESSING: { text: isService ? 'Seller is preparing for your appointment.' : 'Seller is packing your order.', color: 'blue' },
            SERVICE_PENDING: { text: 'Booking confirmed. Be at your location at the scheduled time.', color: 'amber' },
            DELIVERY_PENDING: { text: isCourier ? 'Your item is on its way to the collection hub.' : 'Your order is being delivered.', color: 'amber' },
            COLLECTION_PENDING: { text: isShopPickup ? '✅ Ready! Visit the shop to collect your order.' : `✅ Arrived at hub! Collect at ${COURIER_LOCATION}.`, color: 'amber' },
            DELIVERY_COMPLETE: { text: `Your order is at the hub. Collect at ${COURIER_LOCATION}.`, color: 'amber' },
            COMPLETED: { text: 'Order complete. Thank you for shopping with Byblos!', color: 'green' },
            CANCELLED: { text: 'Order cancelled. Any refund has been added to your balance.', color: 'red' },
            FAILED: { text: 'Payment was not completed. No charges made.', color: 'red' },
        },
        seller: {
            PENDING: { text: isCourier ? `Drop off item at ${COURIER_LOCATION} within 48 hours.` : isShopPickup ? 'Prepare item for buyer collection.' : isService ? 'New booking! Confirm the appointment.' : 'New order received.', color: 'blue' },
            RESERVED: { text: 'Awaiting payment confirmation from buyer.', color: 'blue' },
            PROCESSING: { text: 'Update status when item is ready for delivery/collection.', color: 'blue' },
            SERVICE_PENDING: { text: 'Confirm this booking in your dashboard to proceed.', color: 'amber' },
            DELIVERY_PENDING: { text: isCourier ? `Items dispatched to hub. Logistics tracking initiated.` : 'Order is being delivered to buyer.', color: 'amber' },
            COLLECTION_PENDING: { text: isShopPickup ? 'Item is ready. Hand over to buyer when they arrive.' : 'Item is at the hub. Buyer has been notified.', color: 'amber' },
            DELIVERY_COMPLETE: { text: 'Waiting for buyer to collect from hub.', color: 'amber' },
            COMPLETED: { text: '✅ Order complete. Funds released to your wallet.', color: 'green' },
            CANCELLED: { text: 'Order cancelled. Inventory has been restored.', color: 'red' },
            FAILED: { text: 'Payment failed. No funds were collected.', color: 'red' },
        },
    };

    return instructions[userRole]?.[status] ?? null;
};
