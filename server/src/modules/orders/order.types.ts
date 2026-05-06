export type OrderStatus =
    | 'PENDING'
    | 'RESERVED'
    | 'PAID'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'EXPIRED'
    | 'COLLECTION_PENDING'
    | 'DELIVERY_PENDING'
    | 'SERVICE_PENDING';

export type OrderType = 'PHYSICAL' | 'SERVICE' | 'DIGITAL';

export type FulfillmentType =
    | 'BUYER_TO_SELLER'
    | 'COURIER'
    | 'SELLER_TO_BUYER'
    | 'DIGITAL';

export interface OrderLocation {
    address: string;
    lat: number;
    lng: number;
}

export interface OrderMetadata {
    product_type: OrderType;
    booking_date?: string;
    booking_time?: string;
    service_location?: string;
    service_requirements?: string;
    buyer_location?: OrderLocation;
    [key: string]: any;
}

export interface Order {
    id: number;
    orderNumber: string;
    buyerId: number;
    sellerId: number;
    totalAmount: number;
    platformFeeAmount: number;
    sellerPayoutAmount: number;
    paymentMethod: string;
    buyerName: string;
    buyerEmail: string;
    buyerMobilePayment: string;
    buyerWhatsappNumber: string;
    status: OrderStatus;
    paymentStatus: string;
    orderType: OrderType;
    fulfillmentType: FulfillmentType;
    locationAddress?: string;
    locationLat?: number;
    locationLng?: number;
    metadata: OrderMetadata;
    createdAt: Date;
    updatedAt: Date;
}
