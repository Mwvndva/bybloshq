import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, Package, XCircle, CheckCircle, Clock } from 'lucide-react';
import type { ApiOrder } from '@/types/api/order';
import { formatCurrency, HUB_DROPOFF_LOCATION } from './sellerOrders.utils';

interface SellerOrderActionsProps {
  order: ApiOrder;
  isUpdating: boolean;
  isRequestingPickup: boolean;
  canSelectHubDropoff: boolean;
  canRequestPickup: boolean;
  canMarkDroppedAtHub: boolean;
  canConfirmBooking: boolean;
  canCompleteService: boolean;
  canMarkShopReady: boolean;
  isPaid: boolean;
  isPhysicalOnline: boolean;
  pickupTracking: { status?: string } | null | undefined;
  onSelectHubDropoff: (orderId: string) => void;
  onRequestPickup: (order: ApiOrder) => void;
  onReadyForPickup: (orderId: string, action?: 'hub_dropoff' | 'shop_ready') => void;
  onCancel: (orderId: string) => void;
  onConfirmBooking: (orderId: string) => void;
  onMarkServiceReady: (orderId: string) => void;
}

export function SellerOrderActions({
  order,
  isUpdating,
  isRequestingPickup,
  canSelectHubDropoff,
  canRequestPickup,
  canMarkDroppedAtHub,
  canConfirmBooking,
  canCompleteService,
  canMarkShopReady,
  isPaid,
  isPhysicalOnline,
  pickupTracking,
  onSelectHubDropoff,
  onRequestPickup,
  onReadyForPickup,
  onCancel,
  onConfirmBooking,
  onMarkServiceReady,
}: SellerOrderActionsProps) {
  return (
                                            <div className="flex flex-col items-stretch gap-3 xl:min-w-[220px]">
                                                {/* Total Amount */}
                                                <div className="rounded-xl border border-white/15 bg-white/8 px-4 py-3 w-full">
                                                    <p className="font-bold text-lg sm:text-xl text-white">
                                                        {formatCurrency(order.totalAmount, order.currency)}
                                                    </p>
                                                    <p className="text-xs text-white/70">Total Amount</p>
                                                    <p className="mt-1 text-xs text-white/70">Payment: {order.paymentStatus || 'Pending'}</p>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="w-full">
                                                    {canSelectHubDropoff && (
                                                        <div className="mb-2 space-y-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full min-h-10 justify-center border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-semibold transition-all duration-200"
                                                                onClick={() => onSelectHubDropoff(order.id)}
                                                                disabled={isUpdating}
                                                            >
                                                                <MapPin className="h-3 w-3 mr-1.5" />
                                                                Drop off at Mzigo Ego
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {canRequestPickup && (
                                                        <div className="mb-2 space-y-1.5">
                                                            <Button
                                                                size="sm"
                                                                className="w-full min-h-10 justify-center bg-yellow-400 text-black hover:bg-yellow-300 text-xs font-semibold transition-all duration-200"
                                                                onClick={() => onRequestPickup(order)}
                                                                disabled={isUpdating || isRequestingPickup}
                                                            >
                                                                <Truck className="h-3 w-3 mr-1.5" />
                                                                Request Mzigo pickup
                                                            </Button>
                                                            <p className="text-[10px] leading-relaxed text-white/60">
                                                                Choose one handoff method. Mzigo Ego secures the package and checks it against the order.
                                                            </p>
                                                        </div>
                                                    )}
                                                    {canMarkDroppedAtHub && (
                                                        <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-2">
                                                            <p className="mb-2 text-[10px] leading-relaxed text-blue-950">
                                                                Drop at {HUB_DROPOFF_LOCATION} within 24 hours. Mzigo Ego will check the package against the order before handling delivery.
                                                            </p>
                                                            <Button
                                                                size="sm"
                                                                className="w-full min-h-10 justify-center bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-all duration-200"
                                                                onClick={() => onReadyForPickup(order.id, 'hub_dropoff')}
                                                                disabled={isUpdating}
                                                            >
                                                                <Package className="h-3 w-3 mr-1.5" />
                                                                Mark Handed to Mzigo Ego
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {pickupTracking?.status === 'payment_pending' && (
                                                        <div className="mb-2 rounded-lg border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-[10px] font-semibold text-yellow-100">
                                                            Pickup payment pending. Check your phone to complete it.
                                                        </div>
                                                    )}
                                                    {order.status === 'PENDING' && (
                                                        <div className="space-y-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full min-h-10 justify-center sm:w-auto sm:justify-start lg:w-full text-red-200 hover:bg-red-500/10 border-red-400/20 hover:border-red-400/30 text-xs font-semibold transition-all duration-200"
                                                                onClick={() => onCancel(order.id)}
                                                                disabled={isUpdating}
                                                            >
                                                                <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                Cancel Order
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {canConfirmBooking && (
                                                        <div className="space-y-1.5">
                                                            <Button
                                                                size="sm"
                                                                className="w-full min-h-10 justify-center sm:w-auto sm:justify-start lg:w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                                                                onClick={() => onConfirmBooking(order.id)}
                                                                disabled={isUpdating}
                                                            >
                                                                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                Confirm Booking
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full min-h-10 justify-center sm:w-auto sm:justify-start lg:w-full text-red-200 hover:bg-red-500/10 border-red-400/20 hover:border-red-400/30 text-xs font-semibold transition-all duration-200"
                                                                onClick={() => onCancel(order.id)}
                                                                disabled={isUpdating}
                                                            >
                                                                <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                Cancel Booking
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {canCompleteService && (
                                                        <div className="space-y-1.5">
                                                            <Button
                                                                size="sm"
                                                                className="w-full min-h-10 justify-center sm:w-auto sm:justify-start lg:w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                                                                onClick={() => onMarkServiceReady(order.id)}
                                                                disabled={isUpdating}
                                                            >
                                                                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                Mark Service Delivered
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {canMarkShopReady && (
                                                        <div className="space-y-1.5">
                                                            <Button
                                                                size="sm"
                                                                className="w-full min-h-10 justify-center sm:w-auto sm:justify-start lg:w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                                                                onClick={() => onReadyForPickup(order.id, 'shop_ready')}
                                                                disabled={isUpdating}
                                                            >
                                                                <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                Mark Ready for Shop Pickup
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {order.status === 'DELIVERY_PENDING' &&
                                                        isPaid && !isPhysicalOnline && (
                                                            <div className="space-y-1.5">
                                                                <Button
                                                                    size="sm"
                                                                    className="w-full min-h-10 justify-center sm:w-auto sm:justify-start lg:w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                                                                    onClick={() => onReadyForPickup(order.id, 'shop_ready')}
                                                                    disabled={isUpdating}
                                                                >
                                                                    <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                    <span className="hidden sm:inline">Mark as Ready for Pickup</span>
                                                                    <span className="sm:hidden">Ready for Pickup</span>
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="w-full min-h-10 justify-center sm:w-auto sm:justify-start lg:w-full text-red-200 hover:bg-red-500/10 border-red-400/20 hover:border-red-400/30 text-xs font-semibold transition-all duration-200"
                                                                    onClick={() => onCancel(order.id)}
                                                                    disabled={isUpdating}
                                                                >
                                                                    <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                    Cancel Order
                                                                </Button>
                                                            </div>
                                                        )}
                                                    {order.status === 'CONFIRMED' && (
                                                        <div className="space-y-2">
                                                            <Badge className="w-full justify-center bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Clock className="h-3 w-3 mr-1" />
                                                                Pending Buyer Completion
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
  );
}
