import { format, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Package, Truck, XCircle } from 'lucide-react';
import type { PaymentStatus } from '@/types';
import type { ApiOrderItem } from '@/types/api/order';
import type { ApiOrder } from '@/types/api/order';

type DateLike = string | Date | { createdAt?: string | Date; created_at?: string | Date };

const badgeGlow = 'shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_10px_20px_rgba(0,0,0,0.35)]';

export const detailPillClass = 'rounded-xl border border-white/15 bg-white/8 px-3 py-2';

/**
 * Uniform order-detail pills shared by the buyer and seller order cards, so both
 * roles get the same clean 3-up layout. Only customer-facing facts belong here —
 * never raw database IDs or other backend internals.
 */
export function OrderMetaPills({ pills }: { pills: Array<{ label: string; value: string }> }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {pills.map((pill) => (
        <div key={pill.label} className={detailPillClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{pill.label}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">{pill.value}</p>
        </div>
      ))}
    </div>
  );
}

export const formatOrderDate = (dateInput: DateLike | null | undefined): string => {
  if (!dateInput) return 'Date not available';

  try {
    let dateValue: string | Date;

    if (dateInput instanceof Date) {
      dateValue = dateInput;
    } else if (typeof dateInput === 'string') {
      dateValue = dateInput;
    } else {
      dateValue = dateInput.createdAt || dateInput.created_at || '';
    }

    if (!dateValue) return 'Date not available';

    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (!isValid(date)) return 'Date not available';

    return format(date, 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', dateInput);
    return 'Date not available';
  }
};

export const formatOrderCurrency = (value: number | undefined, currency = 'KSH') => {
  if (value === undefined || isNaN(value)) return `${currency} 0`;
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getBuyerServiceCharge = (order?: ApiOrder | null): number => {
  if (!order) return 0;
  const metadata = (order.metadata as Record<string, unknown>) || {};
  const pricing = (metadata.pricing || (metadata.delivery as Record<string, unknown>)?.pricing || {}) as Record<string, unknown>;
  const rawAmount = (order as unknown as Record<string, unknown>).buyerServiceChargeAmount
    ?? (order as unknown as Record<string, unknown>).buyer_service_charge_amount
    ?? pricing.buyer_service_charge
    ?? pricing.product_service_charge
    ?? 0;
  const amount = Number(rawAmount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

export const isPaidOrder = (order: ApiOrder): boolean => {
  const paymentStatus = String(order.paymentStatus || (order as unknown as Record<string, unknown>).payment_status || '').toLowerCase();
  return ['completed', 'success', 'paid'].includes(paymentStatus);
};

export const isDigitalOrderItem = (item: ApiOrderItem): boolean => {
  const productType = String(item?.productType || item?.product_type || '').toLowerCase();
  return Boolean(item?.isDigital || item?.is_digital || productType === 'digital');
};

export const isDigitalOrder = (order: ApiOrder): boolean => {
  return !!(
    order.isDigital ||
    (order as unknown as Record<string, unknown>).is_digital ||
    (order.metadata as Record<string, unknown>)?.product_type === 'digital' ||
    (order.metadata as Record<string, unknown>)?.productType === 'digital' ||
    order.items?.some(isDigitalOrderItem)
  );
};

export const isServiceOrder = (order?: ApiOrder | null): boolean => {
  if (!order) return false;
  const metadata = (order.metadata as Record<string, unknown>) || {};
  const orderType = String((order as unknown as Record<string, unknown>).order_type || (order as unknown as Record<string, unknown>).type || metadata.product_type || metadata.order_type || '').toLowerCase();
  return orderType === 'service' || order.items.some((item: ApiOrderItem) => item.productType === 'service' || (item as unknown as Record<string, unknown>).isService);
};

export const canConfirmOrderReceipt = (order?: ApiOrder | null): boolean => {
  if (!order) return false;

  const terminalStatuses = ['COMPLETED', 'CANCELLED', 'FAILED', 'REFUND_PENDING', 'REFUNDED', 'MANUAL_REVIEW', 'COMPENSATION_REQUIRED'];
  const deliveryStatus = order.logistics?.deliveryLeg?.status?.toLowerCase();
  if (!terminalStatuses.includes(order.status) && (deliveryStatus === 'delivered' || deliveryStatus === 'completed')) {
    return true;
  }

  if (isServiceOrder(order)) {
    return ['CONFIRMED', 'FULFILLING', 'READY_FOR_BUYER', 'DELIVERY_COMPLETE', 'COLLECTION_PENDING'].includes(order.status);
  }

  if (['DELIVERY_COMPLETE', 'READY_FOR_BUYER', 'COLLECTION_PENDING'].includes(order.status)) {
    return true;
  }

  if (order.status !== 'FULFILLING') {
    return false;
  }

  return deliveryStatus === 'delivered' || deliveryStatus === 'completed';
};

export const getConfirmReceiptLabel = (order?: ApiOrder | null): string => {
  return isServiceOrder(order) ? 'Mark Service Completed' : 'Confirm Receipt';
};

export const getStatusBadge = (status: string) => {
  const statusValue = status?.toUpperCase() || 'PENDING';
  switch (statusValue) {
    case 'PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-yellow-500/90 to-yellow-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'DELIVERY_PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Truck className="h-3 w-3 mr-1" />
          Delivery Pending
        </Badge>
      );
    case 'DELIVERY_COMPLETE':
      return (
        <Badge className={`bg-gradient-to-r from-purple-500/90 to-purple-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Package className="h-3 w-3 mr-1" />
          Delivery Complete
        </Badge>
      );
    case 'READY_FOR_BUYER':
      return (
        <Badge className={`bg-gradient-to-r from-emerald-500/90 to-green-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Package className="h-3 w-3 mr-1" />
          Ready for Buyer
        </Badge>
      );
    case 'FULFILLING':
      return (
        <Badge className={`bg-gradient-to-r from-amber-500/90 to-orange-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Truck className="h-3 w-3 mr-1" />
          Fulfilling
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge className={`bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'CANCELLED':
    case 'FAILED':
      return (
        <Badge className={`bg-gradient-to-r from-red-500/90 to-red-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <XCircle className="h-3 w-3 mr-1" />
          {statusValue === 'FAILED' ? 'Failed' : 'Cancelled'}
        </Badge>
      );
    case 'SERVICE_PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-purple-500/90 to-purple-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Clock className="h-3 w-3 mr-1" />
          Service Pending
        </Badge>
      );
    case 'COLLECTION_PENDING':
      return (
        <Badge className={`bg-gradient-to-r from-indigo-500/90 to-blue-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Package className="h-3 w-3 mr-1" />
          Ready for Collection
        </Badge>
      );
    case 'CONFIRMED':
      return (
        <Badge className={`bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Confirmed
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-gradient-to-r from-gray-500/90 to-gray-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Package className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
};

export const getPaymentStatusBadge = (status?: string) => {
  const statusValue = (status?.toLowerCase() || 'pending') as PaymentStatus;
  switch (statusValue) {
    case 'pending':
      return (
        <Badge className={`bg-gradient-to-r from-amber-500/90 to-amber-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'success':
    case 'completed':
    case 'paid':
      return (
        <Badge className={`bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case 'failed':
      return (
        <Badge className={`bg-gradient-to-r from-red-500/90 to-red-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'reversed':
      return (
        <Badge className={`bg-gradient-to-r from-gray-500/90 to-gray-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Reversed
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-gradient-to-r from-gray-500/90 to-gray-600/90 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${badgeGlow}`}>
          {status}
        </Badge>
      );
  }
};


