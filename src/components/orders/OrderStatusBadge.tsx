import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
        label: 'Completed',
        style: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white',
      };
      break;
    case 'AWAITING_SELLER_ACTION':
      content = {
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: viewerRole === 'buyer' ? 'Awaiting Seller' : 'Seller Action',
        style: 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white',
      };
      break;
    case 'FULFILLING':
      content = {
        icon: <Truck className="h-3 w-3 mr-1" />,
        label: 'Fulfilling',
        style: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
      };
      break;
    case 'READY_FOR_BUYER':
      content = {
        icon: <Package className="h-3 w-3 mr-1" />,
        label: viewerRole === 'buyer' ? 'Ready for Pickup' : 'Ready for Buyer',
        style: 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white',
      };
      break;
    case 'DELIVERY_COMPLETE':
      content = {
        icon: <Package className="h-3 w-3 mr-1" />,
        label: 'Delivery Complete',
        style: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
      };
      break;
    case 'DELIVERY_PENDING':
      content = {
        icon: <Truck className="h-3 w-3 mr-1" />,
        label: 'Delivery Pending',
        style: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
      };
      break;
    case 'SERVICE_PENDING':
      content = {
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: 'Service Pending',
        style: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
      };
      break;
    case 'COLLECTION_PENDING':
      content = {
        icon: <Package className="h-3 w-3 mr-1" />,
        label: 'Ready for Collection',
        style: 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white',
      };
      break;
    case 'CONFIRMED':
      content = {
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
        label: 'Confirmed',
        style: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
      };
      break;
    case 'FAILED':
      content = {
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: 'Failed',
        style: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
      };
      break;
    case 'CANCELLED':
      content = {
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: 'Cancelled',
        style: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
      };
      break;
    case 'PENDING':
    default:
      content = {
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: statusValue ? statusValue.replace(/_/g, ' ') : 'Pending',
        style: 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white',
      };
      break;
  }

  return (
    <Badge
      className={cn(
        'text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm flex items-center w-fit',
        content.style,
        className
      )}
    >
      {content.icon}
      {content.label}
    </Badge>
  );
}
