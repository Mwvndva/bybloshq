import { format, isValid, parseISO } from 'date-fns';
import type { ApiOrder } from '@/types/api/order';

export const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'MMM d, yyyy') : 'Date not available';
};

export const formatCurrency = (value: number | undefined, currency: string = 'KSH') => {
    if (value === undefined || isNaN(value)) return `${currency} 0.00`;
    return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const HUB_DROPOFF_LOCATION = 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32';

export const hasBuyerPaidDoorDelivery = (order?: ApiOrder | null) => {
    if (!order) return false;
    const delivery = (order.metadata?.delivery || {}) as Record<string, unknown>;
    return delivery.doorDelivery === true
        || delivery.door_delivery === true
        || delivery.deliveryMode === 'DOOR_DELIVERY'
        || delivery.delivery_mode === 'DOOR_DELIVERY'
        || Boolean(order.logistics?.deliveryLeg);
};

export const getEffectiveFulfillmentType = (order?: ApiOrder | null) => (
    hasBuyerPaidDoorDelivery(order) ? 'COURIER' : order?.fulfillment_type
);
