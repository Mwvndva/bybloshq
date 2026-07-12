import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Package, Truck, XCircle } from 'lucide-react';

export function OrderStatusBadge({ status }: { status?: string }) {
  return (
status === 'COMPLETED' ? (
                                                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <CheckCircle className="h-3 w-3 mr-1" /> Completed
                                                            </Badge>
                                                        ) : status === 'AWAITING_SELLER_ACTION' ? (
                                                            <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Clock className="h-3 w-3 mr-1" /> Seller Action
                                                            </Badge>
                                                        ) : status === 'FULFILLING' ? (
                                                            <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Truck className="h-3 w-3 mr-1" /> Fulfilling
                                                            </Badge>
                                                        ) : status === 'READY_FOR_BUYER' ? (
                                                            <Badge className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Package className="h-3 w-3 mr-1" /> Ready for Buyer
                                                            </Badge>
                                                        ) : status === 'DELIVERY_COMPLETE' ? (
                                                            <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Package className="h-3 w-3 mr-1" /> Delivery Complete
                                                            </Badge>
                                                        ) : status === 'DELIVERY_PENDING' ? (
                                                            <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Truck className="h-3 w-3 mr-1" /> Delivery Pending
                                                            </Badge>
                                                        ) : status === 'FAILED' ? (
                                                            <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <XCircle className="h-3 w-3 mr-1" /> Failed
                                                            </Badge>
                                                        ) : status === 'CANCELLED' ? (
                                                            <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <XCircle className="h-3 w-3 mr-1" /> Cancelled
                                                            </Badge>
                                                        ) : status === 'SERVICE_PENDING' ? (
                                                            <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <CheckCircle className="h-3 w-3 mr-1" /> Service Pending
                                                            </Badge>
                                                        ) : status === 'COLLECTION_PENDING' ? (
                                                            <Badge className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Package className="h-3 w-3 mr-1" /> Ready for Collection
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Clock className="h-3 w-3 mr-1" /> Pending
                                                            </Badge>
                                                        )
  );
}
