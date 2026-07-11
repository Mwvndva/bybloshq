import { Calendar, CheckCircle, Clock, MapPin, Package, Truck, User, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ApiOrder } from '@/types/api/order';
import { getOrderInstruction } from '@/utils/orderInstructions';
import { OrderLogisticsTracking } from '../orders/OrderLogisticsTracking';
import { OrderStatusBadge } from './OrderStatusBadge';
import { formatCurrency, formatDate, getEffectiveFulfillmentType, HUB_DROPOFF_LOCATION } from './sellerOrders.utils';

interface SellerOrderCardProps {
  order: ApiOrder;
  isUpdating: boolean;
  onReadyForPickup: (orderId: string, action?: 'hub_dropoff' | 'shop_ready') => void;
  onRequestPickup: (order: ApiOrder) => void;
  onSelectHubDropoff: (orderId: string) => void;
  onMarkServiceReady: (orderId: string) => void;
  onConfirmBooking: (orderId: string) => void;
  onCancel: (orderId: string) => void;
}

export function SellerOrderCard({ order, isUpdating, onReadyForPickup, onRequestPickup, onSelectHubDropoff, onMarkServiceReady, onConfirmBooking, onCancel }: SellerOrderCardProps) {
                            const isService = order.metadata?.product_type === 'service' || order.items?.some(i => i.productType === 'service');
                            const isDigital = order.items?.some(i => i.productType === 'digital');
                            const isPhysicalOrder = !isService && !isDigital;
                            const isPaid = ['success', 'completed', 'paid'].includes(order.paymentStatus?.toLowerCase() || '');
                            const effectiveFulfillmentType = getEffectiveFulfillmentType(order);
                            const isPhysicalOnline = isPhysicalOrder && effectiveFulfillmentType === 'COURIER';
                            const sellerHandoff = (order.metadata?.seller_handoff || {}) as Record<string, unknown>;
                            const pickupTracking = order.logistics?.pickupLeg;
                            const pickupIsActive = !!pickupTracking && !['failed', 'cancelled'].includes(String(pickupTracking.status || '').toLowerCase());
                            const handoffStatus = String(sellerHandoff.status || '').toLowerCase();
                            const orderStatus = String(order.status || '').toUpperCase();
                            const canChooseHandoff = isPhysicalOnline
                                && isPaid
                                && !pickupIsActive
                                && !['dropoff_selected', 'dropped_at_hub'].includes(handoffStatus);
                            const canRequestPickup = isPhysicalOnline
                                && isPaid
                                && !pickupIsActive
                                && !['dropoff_selected', 'dropped_at_hub'].includes(handoffStatus)
                                && !['READY_FOR_BUYER', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUND_PENDING', 'REFUNDED', 'MANUAL_REVIEW'].includes(orderStatus);
                            const canSelectHubDropoff = canChooseHandoff;
                            const canMarkDroppedAtHub = isPhysicalOnline
                                && isPaid
                                && handoffStatus === 'dropoff_selected'
                                && !pickupIsActive;
                            const canConfirmBooking = isService
                                && isPaid
                                && ['PAID', 'AWAITING_SELLER_ACTION', 'SERVICE_PENDING', 'BOOKED'].includes(order.status);
                            const canCompleteService = isService
                                && isPaid
                                && ['CONFIRMED', 'FULFILLING'].includes(order.status);
                            const canMarkShopReady = !isService
                                && !isDigital
                                && !isPhysicalOnline
                                && isPaid
                                && ['PAID', 'AWAITING_SELLER_ACTION', 'DELIVERY_PENDING'].includes(order.status);

                            let cardClasses = "transition-all duration-300 bg-black border shadow-[0_12px_32px_rgba(0,0,0,0.35)] hover:border-yellow-400/40 ";
                            let itemClasses = "text-xs sm:text-sm text-white rounded-lg px-3 py-2 border ";

                            if (isService) {
                                cardClasses += "border-purple-400/45";
                                itemClasses += "bg-purple-500/10 border-purple-400/25";
                            } else if (isDigital) {
                                cardClasses += "border-red-400/45";
                                itemClasses += "bg-red-500/10 border-red-400/25";
                            } else {
                                cardClasses += "border-white/15";
                                itemClasses += "bg-white/8 border-white/12";
                            }

                            return (
                                <Card key={order.id} className={cardClasses}>
                                    <CardContent className="p-4 sm:p-6">
                                        {/* Mobile-first responsive layout */}
                                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-4 sm:gap-6">
                                            {/* Order Information Section */}
                                            <div className="space-y-3 sm:space-y-4 flex-1">
                                                {/* Order Header */}
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-sm sm:text-lg text-white truncate pr-2">Order #{order.orderNumber}</h3>
                                                        <p className="text-[10px] sm:text-sm text-white/70">{formatDate(order.createdAt)}</p>
                                                        {(order.buyerName || order.customer?.name) && (
                                                            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] sm:text-xs text-white bg-blue-500/15 border border-blue-400/30 px-2 py-0.5 rounded-md w-fit max-w-full">
                                                                <User className="h-3 w-3" />
                                                                <span className="font-medium truncate max-w-[180px] sm:max-w-xs">{order.buyerName || order.customer?.name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Status Badge - positioned for mobile */}
                                                    <div className="flex-none">
                                                        <OrderStatusBadge status={order.status} />
                                                    </div>
                                                </div>

                                                {/* NEW: Instruction Banner */}
                                                {(() => {
                                                    const productType = order.metadata?.product_type || (order.items?.some(i => i.productType === 'service') ? 'service' : 'physical');
                                                    const instruction = getOrderInstruction({
                                                        status: order.status,
                                                        userRole: 'seller',
                                                        orderType: String(productType).toUpperCase(),
                                                        fulfillmentType: getEffectiveFulfillmentType(order),
                                                    });
                                                    if (!instruction) return null;
                                                    return (
                                                        <div className={`mt-3 px-4 py-2 rounded-md text-sm font-medium ${instruction.color === 'blue' ? 'bg-blue-50 text-blue-950 border border-blue-200' :
                                                            instruction.color === 'amber' ? 'bg-yellow-50 text-yellow-950 border border-yellow-300' :
                                                                instruction.color === 'green' ? 'bg-green-50 text-green-950 border border-green-200' :
                                                                    'bg-red-50 text-red-950 border border-red-200'
                                                            }`}>
                                                            {instruction.text}
                                                        </div>
                                                    );
                                                })()}

                                                <OrderLogisticsTracking
                                                    order={order}
                                                    view="seller"
                                                    isPhysical={!isService && !isDigital}
                                                    formatCurrency={(value, currency) => formatCurrency(value, currency || order.currency || 'KSH')}
                                                />

                                                {/* Products Section */}
                                                <div>
                                                    <h4 className="text-sm sm:text-base font-semibold text-white mb-3">Products</h4>
                                                    <ul className="space-y-2">
                                                        {order.items && order.items.length > 0 ? (
                                                            order.items.map((item) => (
                                                                <li key={item.id} className={itemClasses}>
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <span className="font-semibold">{item.name}</span>
                                                                        <span className="text-white/70">Qty {item.quantity}</span>
                                                                    </div>
                                                                </li>
                                                            ))
                                                        ) : (
                                                            <li className="text-xs sm:text-sm text-white/70 bg-white/8 rounded-lg px-3 py-2 border border-white/12">No items in this order</li>
                                                        )}
                                                    </ul>
                                                </div>

                                                {/* Service Booking Details */}
                                                {(order.metadata?.booking_date || order.metadata?.service_location || order.metadata?.service_requirements) && (
                                                    <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-400/25 shadow-sm">
                                                        <h4 className="flex items-center text-sm font-semibold text-white mb-2">
                                                            <Calendar className="h-4 w-4 mr-2 text-purple-200" />
                                                            Service Booking Details
                                                        </h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                            <div className="bg-black/60 p-2 rounded border border-purple-400/20">
                                                                <p className="text-purple-200 text-xs font-medium mb-1">Date & Time</p>
                                                                <p className="font-semibold text-white">
                                                                    {order.metadata.booking_date ? formatDate(order.metadata.booking_date as string) : 'N/A'}
                                                                    {order.metadata.booking_time && <span className="text-white/70 font-normal"> at {String(order.metadata.booking_time)}</span>}
                                                                </p>
                                                            </div>
                                                            <div className="bg-black/60 p-2 rounded border border-purple-400/20">
                                                                <p className="text-purple-200 text-xs font-medium mb-1">Location</p>
                                                                <div className="font-semibold text-white break-words">
                                                                    {(order.metadata.buyer_location as { fullAddress?: string; latitude?: number; longitude?: number }) ? (
                                                                        <div className="space-y-1">
                                                                            <p>{(order.metadata.buyer_location as { fullAddress?: string; latitude?: number; longitude?: number }).fullAddress || 'Buyer Coordinates Provided'}</p>
                                                                            {(order.metadata.buyer_location as { fullAddress?: string; latitude?: number; longitude?: number }).latitude && (order.metadata.buyer_location as { fullAddress?: string; latitude?: number; longitude?: number }).longitude && (
                                                                                <a
                                                                                    href={`https://www.google.com/maps?q=${(order.metadata.buyer_location as { fullAddress?: string; latitude?: number; longitude?: number }).latitude},${(order.metadata.buyer_location as { fullAddress?: string; latitude?: number; longitude?: number }).longitude}`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-xs text-purple-200 hover:text-yellow-200 underline block"
                                                                                >
                                                                                    View on Maps
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <p>{String(order.metadata.service_location || 'Not specified')}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {order.metadata?.service_requirements && (
                                                            <div className="mt-3 bg-black/60 p-2 rounded border border-purple-400/20">
                                                                <p className="text-purple-200 text-xs font-medium mb-1">Special Requirements</p>
                                                                <p className="text-sm text-white break-words">
                                                                    {String(order.metadata.service_requirements || '')}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Price and Actions Section */}
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
                                        </div>
                                    </CardContent>
                                </Card>
                            );
}
