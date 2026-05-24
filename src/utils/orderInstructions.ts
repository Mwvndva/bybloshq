// src/utils/orderInstructions.ts

const COURIER_LOCATION = 'Dynamic Mall, Tom Mboya St - Shop SL 32';

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
            PENDING: { text: isDigital ? 'Your download will be available once payment confirms.' : isCourier ? 'Waiting for the seller to choose Mzigo Ego drop-off or pickup.' : isShopPickup ? 'Seller is preparing your item for shop pickup.' : 'Waiting for seller to confirm your booking.', color: 'blue' },
            RESERVED: { text: 'Slot reserved. Complete payment to confirm.', color: 'blue' },
            PAYMENT_PENDING: { text: 'Waiting for payment confirmation.', color: 'blue' },
            PAID: { text: 'Payment confirmed. Waiting for seller action.', color: 'blue' },
            AWAITING_SELLER_ACTION: { text: isService ? 'Waiting for seller to confirm your booking.' : isCourier ? 'Seller will choose Mzigo Ego drop-off or request Mzigo pickup.' : 'Seller is preparing your order.', color: 'amber' },
            FULFILLING: { text: isService ? 'Booking confirmed. After the service is complete, mark it completed to release funds.' : isCourier ? 'Mzigo Ego is handling the package securely and checking it against the order.' : 'Seller is preparing your pickup.', color: 'amber' },
            READY_FOR_BUYER: { text: isService ? 'Service delivered. Mark it completed to release funds.' : isShopPickup ? 'Ready! Visit the shop to collect your order, then confirm receipt.' : `Ready at Mzigo Ego. Collect at ${COURIER_LOCATION}, then confirm receipt.`, color: 'amber' },
            PROCESSING: { text: isService ? 'Seller is preparing for your appointment.' : 'Seller is packing your order.', color: 'blue' },
            SERVICE_PENDING: { text: 'Booking confirmed. Be at your location at the scheduled time.', color: 'amber' },
            DELIVERY_PENDING: { text: isCourier ? 'Mzigo Ego is handling your package securely and checking it before delivery.' : 'Your order is being delivered.', color: 'amber' },
            COLLECTION_PENDING: { text: isShopPickup ? 'Ready! Visit the shop to collect your order.' : `Arrived at Mzigo Ego. Collect at ${COURIER_LOCATION}.`, color: 'amber' },
            DELIVERY_COMPLETE: { text: `Your order is at Mzigo Ego. Collect at ${COURIER_LOCATION}.`, color: 'amber' },
            COMPLETED: { text: 'Order complete. Thank you for shopping with Byblos!', color: 'green' },
            CANCELLED: { text: 'Order cancelled. Any refund has been added to your balance.', color: 'red' },
            FAILED: { text: 'Payment was not completed. No charges made.', color: 'red' },
        },
        seller: {
            PENDING: { text: isCourier ? 'Choose Mzigo Ego drop-off or request Mzigo pickup for this package.' : isShopPickup ? 'Prepare item for buyer collection.' : isService ? 'New booking! Confirm the appointment.' : 'New order received.', color: 'blue' },
            RESERVED: { text: 'Awaiting payment confirmation from buyer.', color: 'blue' },
            PAYMENT_PENDING: { text: 'Awaiting payment confirmation from buyer.', color: 'blue' },
            PAID: { text: 'Payment confirmed. Choose the next action.', color: 'blue' },
            AWAITING_SELLER_ACTION: { text: isService ? 'Confirm this booking to proceed.' : isCourier ? 'Choose Mzigo Ego drop-off or request Mzigo pickup.' : 'Prepare item for buyer collection.', color: 'amber' },
            FULFILLING: { text: isService ? 'Deliver the service as scheduled. The buyer will mark it completed to release funds.' : isCourier ? 'Complete your selected Mzigo handoff. Mzigo Ego will secure and check the package against the order.' : 'Prepare item for buyer collection.', color: 'amber' },
            READY_FOR_BUYER: { text: isService ? 'Buyer has been asked to mark the service completed.' : 'Buyer has been notified. Complete handover when they arrive.', color: 'amber' },
            PROCESSING: { text: 'Update status when item is ready for delivery/collection.', color: 'blue' },
            SERVICE_PENDING: { text: 'Confirm this booking in your dashboard to proceed.', color: 'amber' },
            DELIVERY_PENDING: { text: isCourier ? 'Mzigo Ego has received the package and started logistics tracking.' : 'Order is being delivered to buyer.', color: 'amber' },
            COLLECTION_PENDING: { text: isShopPickup ? 'Item is ready. Hand over to buyer when they arrive.' : 'Item is at Mzigo Ego. Buyer has been notified.', color: 'amber' },
            DELIVERY_COMPLETE: { text: 'Waiting for buyer to collect from Mzigo Ego.', color: 'amber' },
            COMPLETED: { text: 'Order complete. Funds released to your wallet.', color: 'green' },
            CANCELLED: { text: 'Order cancelled. Inventory has been restored.', color: 'red' },
            FAILED: { text: 'Payment failed. No funds were collected.', color: 'red' },
        },
    };

    return instructions[userRole]?.[status] ?? null;
};
