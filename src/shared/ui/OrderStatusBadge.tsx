import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/utils/formatting';
import { CheckCircle, Clock, Package, Truck, XCircle } from 'lucide-react';

interface OrderStatusBadgeProps {
  status?: string | null;
  viewerRole?: 'buyer' | 'seller';
  className?: string;
}

export function OrderStatusBadge({ status, viewerRole = 'seller', className }: OrderStatusBadgeProps) {
  const statusValue = (status || '').toUpperCase();

  let content: { icon: React.ReactNode; label: string; style: string };

  switch (statusValue) {
    case 'COMPLETED':
      content = {
        icon: <CheckCircle className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Completed',
        style: 'bg-emerald-600 dark:bg-emerald-600',
      };
      break;
    case 'AWAITING_SELLER_ACTION':
      content = {
        icon: <Clock className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: viewerRole === 'buyer' ? 'Awaiting Seller' : 'Seller Action',
        style: 'bg-yellow-600 dark:bg-yellow-600',
      };
      break;
    case 'FULFILLING':
      content = {
        icon: <Truck className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Fulfilling',
        style: 'bg-amber-600 dark:bg-amber-600',
      };
      break;
    case 'READY_FOR_BUYER':
      content = {
        icon: <Package className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: viewerRole === 'buyer' ? 'Ready for Pickup' : 'Ready for Buyer',
        style: 'bg-blue-600 dark:bg-blue-600',
      };
      break;
    case 'DELIVERY_COMPLETE':
      content = {
        icon: <Package className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Delivery Complete',
        style: 'bg-purple-600 dark:bg-purple-600',
      };
      break;
    case 'DELIVERY_PENDING':
      content = {
        icon: <Truck className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Delivery Pending',
        style: 'bg-blue-600 dark:bg-blue-600',
      };
      break;
    case 'SERVICE_PENDING':
      content = {
        icon: <Clock className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Service Pending',
        style: 'bg-purple-600 dark:bg-purple-600',
      };
      break;
    case 'COLLECTION_PENDING':
      content = {
        icon: <Package className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Ready for Collection',
        style: 'bg-blue-600 dark:bg-blue-600',
      };
      break;
    case 'CONFIRMED':
      content = {
        icon: <CheckCircle className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Confirmed',
        style: 'bg-blue-600 dark:bg-blue-600',
      };
      break;
    case 'FAILED':
      content = {
        icon: <XCircle className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Failed',
        style: 'bg-red-600 dark:bg-red-600',
      };
      break;
    case 'CANCELLED':
      content = {
        icon: <XCircle className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: 'Cancelled',
        style: 'bg-red-600 dark:bg-red-600',
      };
      break;
    case 'PENDING':
    default:
      content = {
        icon: <Clock className="h-3.5 w-3.5 mr-1 shrink-0" />,
        label: statusValue ? statusValue.replace(/_/g, ' ') : 'Pending',
        style: 'bg-yellow-600 dark:bg-yellow-600',
      };
      break;
  }

  return (
    <span
      className={cn(
        'text-xs sm:text-sm font-bold px-3 py-1 rounded-full shadow-sm inline-flex items-center w-fit border-0 !text-white tracking-wide',
        content.style,
        className
      )}
    >
      {content.icon}
      {content.label}
    </span>
  );
}
