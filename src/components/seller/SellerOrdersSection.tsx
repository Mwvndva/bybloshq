import { useState, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format, isValid, parseISO } from 'date-fns';
import { Order, OrderStatus } from '@/types/order';

// Helper function to safely format dates
const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'MMM d, yyyy') : 'Date not available';
};

// Helper function to safely format currency values
const formatCurrency = (value: number | undefined, currency: string = 'KSH') => {
    if (value === undefined || isNaN(value)) return `${currency} 0.00`;
    return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const HUB_DROPOFF_LOCATION = 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32';
import { Clock, Package, Truck, CheckCircle, RefreshCw, XCircle, Calendar, User, Download, MapPin, CreditCard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sellerApi } from '@/api/sellerApi';
import { exportOrdersToCSV } from '@/utils/exportUtils';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import { getOrderInstruction } from '@/utils/orderInstructions';
import { useSellerOrders } from './dashboard/hooks/useSellerOrders';
import { sellerDashboardQueryKeys } from './dashboard/queryKeys';
import LocationPicker from '../common/LocationPicker';
import { OrderLogisticsTracking } from '../orders/OrderLogisticsTracking';

export default function SellerOrdersSection() {
    const queryClient = useQueryClient();
    const ordersQuery = useSellerOrders();
    const orders = useMemo(() => ordersQuery.data || [], [ordersQuery.data]);
    const isLoading = ordersQuery.isLoading;
    const [isUpdating, setIsUpdating] = useState(false);
    // FIX (Task 18): Prevent duplicate order mutations via synchronous lock
    const { runWithLock } = useAsyncLock();
    const [showPickupDialog, setShowPickupDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [readyAction, setReadyAction] = useState<'hub_dropoff' | 'shop_ready'>('hub_dropoff');
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [pickupOrder, setPickupOrder] = useState<Order | null>(null);
    const [pickupPhone, setPickupPhone] = useState('');
    const [pickupLocation, setPickupLocation] = useState<{ address: string; lat: number | null; lng: number | null }>({
        address: '',
        lat: null,
        lng: null
    });
    const [pickupQuote, setPickupQuote] = useState<{
        feeAmount: number;
        distanceKm: number;
        chargeableDistanceKm: number;
        rateKesPerKm: number;
        currency: string;
    } | null>(null);
    const [pickupQuoteError, setPickupQuoteError] = useState('');
    const [isPickupQuoteLoading, setIsPickupQuoteLoading] = useState(false);
    const [isRequestingPickup, setIsRequestingPickup] = useState(false);

    const { toast } = useToast();

    const refreshOrders = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.orders }),
            queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.analytics })
        ]);
    }, [queryClient]);

    useEffect(() => {
        if (!pickupOrder) {
            setPickupQuote(null);
            setPickupQuoteError('');
            setIsPickupQuoteLoading(false);
            return;
        }

        if (pickupLocation.lat === null || pickupLocation.lng === null) {
            setPickupQuote(null);
            setPickupQuoteError('');
            return;
        }

        const timer = window.setTimeout(async () => {
            setIsPickupQuoteLoading(true);
            setPickupQuoteError('');
            try {
                const quote = await sellerApi.quotePickup({
                    address: pickupLocation.address,
                    latitude: pickupLocation.lat as number,
                    longitude: pickupLocation.lng as number
                });
                setPickupQuote({
                    feeAmount: Number(quote.feeAmount || 0),
                    distanceKm: Number(quote.distanceKm || 0),
                    chargeableDistanceKm: Number(quote.chargeableDistanceKm || 0),
                    rateKesPerKm: Number(quote.rateKesPerKm || 40),
                    currency: quote.currency || 'KES'
                });
            } catch (error: any) {
                setPickupQuote(null);
                setPickupQuoteError(error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not calculate pickup fee');
            } finally {
                setIsPickupQuoteLoading(false);
            }
        }, 400);

        return () => window.clearTimeout(timer);
    }, [pickupOrder, pickupLocation.address, pickupLocation.lat, pickupLocation.lng]);

    // Filter orders based on search query
    const filteredOrders = useMemo(() => {
        if (!searchQuery.trim()) return orders;

        const query = searchQuery.toLowerCase();
        return orders.filter(order =>
            order.buyerName?.toLowerCase().includes(query) ||
            order.items?.some(item => item.name.toLowerCase().includes(query)) ||
            order.id?.toString().toLowerCase().includes(query) ||
            order.orderNumber?.toLowerCase().includes(query)
        );
    }, [orders, searchQuery]);

    const handleReadyForPickupClick = (orderId: string, action: 'hub_dropoff' | 'shop_ready' = 'hub_dropoff') => {
        setSelectedOrderId(orderId);
        setReadyAction(action);
        setShowPickupDialog(true);
    };

    const openRequestPickupDialog = (order: Order) => {
        setPickupOrder(order);
        setPickupPhone('');
        setPickupLocation({ address: '', lat: null, lng: null });
        setPickupQuote(null);
        setPickupQuoteError('');
    };

    const closeRequestPickupDialog = () => {
        if (isRequestingPickup) return;
        setPickupOrder(null);
        setPickupPhone('');
        setPickupLocation({ address: '', lat: null, lng: null });
        setPickupQuote(null);
        setPickupQuoteError('');
    };

    const requestPickup = async (event: FormEvent) => {
        event.preventDefault();
        if (!pickupOrder) return;

        const phonePattern = /^(\+?254|0)[17]\d{8}$/;
        if (!phonePattern.test(pickupPhone.trim())) {
            setPickupQuoteError('Enter a valid M-Pesa number, for example 0712345678.');
            return;
        }

        if (!pickupLocation.address.trim() || pickupLocation.lat === null || pickupLocation.lng === null) {
            setPickupQuoteError('Pin the pickup location and enter the full pickup address.');
            return;
        }

        if (isPickupQuoteLoading) {
            setPickupQuoteError('Please wait while the pickup fee is calculated.');
            return;
        }

        if (!pickupQuote) {
            setPickupQuoteError(pickupQuoteError || 'Pickup fee could not be calculated.');
            return;
        }

        await runWithLock(async () => {
            try {
                setIsRequestingPickup(true);
                const idempotencyKey = `seller-pickup:${pickupOrder.id}:${Date.now()}`;
                await sellerApi.requestPickup(pickupOrder.id, {
                    mobilePayment: pickupPhone.trim(),
                    pickupLocation: {
                        address: pickupLocation.address.trim(),
                        latitude: pickupLocation.lat as number,
                        longitude: pickupLocation.lng as number
                    },
                    idempotencyKey
                });
                await refreshOrders();
                toast({
                    title: 'Pickup payment sent',
                    description: 'Check your phone to pay the pickup fee. Pickup activates after payment succeeds.'
                });
                setIsRequestingPickup(false);
                closeRequestPickupDialog();
            } catch (error: any) {
                setPickupQuoteError(error?.response?.data?.message || error?.message || 'Failed to request pickup');
                toast({
                    title: 'Pickup request failed',
                    description: error?.response?.data?.message || error?.message || 'Please try again.',
                    variant: 'destructive'
                });
            } finally {
                setIsRequestingPickup(false);
            }
        });
    };

    const selectHubDropoff = async (orderId: string) => {
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await sellerApi.selectHubDropoff(orderId);
                await refreshOrders();
                toast({
                    title: 'Hub drop-off selected',
                    description: 'Drop the package at the hub within 24 hours, then mark it dropped off.'
                });
            } catch (error: any) {
                toast({
                    title: 'Could not select hub drop-off',
                    description: error?.response?.data?.message || error?.message || 'Please try again.',
                    variant: 'destructive'
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    const markAsReadyForPickup = async () => {
        if (!selectedOrderId) return;

        setShowPickupDialog(false);
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);

                if (readyAction === 'hub_dropoff') {
                    await sellerApi.markDroppedAtHub(selectedOrderId);
                } else {
                    await sellerApi.updateOrderStatus(selectedOrderId, 'READY_FOR_BUYER' as OrderStatus);
                }
                await refreshOrders();

                toast({
                    title: readyAction === 'hub_dropoff' ? 'Package dropped at hub' : 'Order ready for pickup',
                    description: readyAction === 'hub_dropoff'
                        ? 'The buyer and logistics timeline have been updated.'
                        : 'The buyer has been notified that their order is ready for shop pickup.',
                });
            } catch (err) {
                console.error('Failed to update order status:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to mark order as ready for pickup. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
                setSelectedOrderId(null);
                setReadyAction('hub_dropoff');
            }
        });
    };

    const markAsDelivered = async (orderId: string) => {
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await sellerApi.updateOrderStatus(orderId, 'DELIVERY_COMPLETE' as OrderStatus);
                await refreshOrders();

                toast({
                    title: 'Order Delivered',
                    description: 'The order has been marked as delivered.',
                });
            } catch (err) {
                console.error('Failed to update order status:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to mark order as delivered. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    const markServiceReadyForBuyerConfirmation = async (orderId: string) => {
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await sellerApi.updateOrderStatus(orderId, 'READY_FOR_BUYER' as OrderStatus);
                await refreshOrders();

                toast({
                    title: 'Service Delivered',
                    description: 'The buyer can now confirm completion to release the funds.',
                });
            } catch (err) {
                console.error('Failed to update order status:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to mark the service as delivered. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    const confirmBooking = async (orderId: string) => {
        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                await sellerApi.confirmBooking(orderId);
                await refreshOrders();

                toast({
                    title: 'Booking Confirmed',
                    description: 'The service booking has been confirmed and the buyer has been notified.',
                });
            } catch (err) {
                console.error('Failed to confirm booking:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to confirm booking. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    const handleCancelClick = (orderId: string) => {
        setCancellingOrderId(orderId);
        setShowCancelDialog(true);
    };

    const cancelOrder = async () => {
        if (!cancellingOrderId) return;

        setShowCancelDialog(false);

        // FIX (Task 18): Prevent duplicate order mutations
        await runWithLock(async () => {
            try {
                setIsUpdating(true);
                const result = await sellerApi.cancelOrder(cancellingOrderId);
                await refreshOrders();

                toast({
                    title: 'Order Cancelled',
                    description: `The order has been cancelled. Buyer will receive a refund of KSh ${result.refundAmount?.toLocaleString() || '0'}.`,
                });
            } catch (err: any) {
                console.error('Failed to cancel order:', err);
                toast({
                    title: 'Error',
                    description: err.response?.data?.message || 'Failed to cancel order. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsUpdating(false);
            }
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-4 sm:space-y-6">
                {[1, 2].map((i) => (
                    <Card key={i} className="bg-black border border-white/15 shadow-sm hover:shadow-md transition-all duration-300">
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                                <div className="space-y-3 sm:space-y-4 flex-1">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 mb-2" />
                                            <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
                                        </div>
                                        <Skeleton className="h-6 w-20 sm:w-24 self-start sm:self-auto" />
                                    </div>
                                    <div>
                                        <Skeleton className="h-4 sm:h-5 w-16 sm:w-20 mb-2" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-8 sm:h-10 w-full rounded-lg" />
                                            <Skeleton className="h-8 sm:h-10 w-3/4 rounded-lg" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-0 lg:space-y-3 lg:min-w-[200px]">
                                    <div className="flex-1 sm:flex-none">
                                        <Skeleton className="h-6 sm:h-7 w-24 sm:w-32 mb-1" />
                                        <Skeleton className="h-3 w-16 sm:w-20" />
                                    </div>
                                    <div className="w-full sm:w-auto lg:w-full space-y-2">
                                        <Skeleton className="h-8 sm:h-9 w-full rounded-md" />
                                        <Skeleton className="h-8 sm:h-9 w-full rounded-md" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (ordersQuery.error) {
        return (
            <div className="text-center py-12 px-4 bg-black rounded-2xl border border-red-400/25">
                <div className="mx-auto w-16 h-16 bg-red-500/15 border border-red-400/30 rounded-full flex items-center justify-center mb-4">
                    <RefreshCw className="h-8 w-8 text-red-200" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Unable to load orders</h3>
                <p className="text-white/75 max-w-md mx-auto mb-4">Please try refreshing your orders.</p>
                <Button
                    onClick={() => ordersQuery.refetch()}
                    className="bg-yellow-400 text-black hover:bg-yellow-500"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                </Button>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-12 px-4">
                <div className="mx-auto w-16 h-16 bg-yellow-400/15 border border-yellow-400/30 rounded-full flex items-center justify-center mb-4">
                    <Package className="h-8 w-8 text-yellow-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
                <p className="text-white/75 max-w-md mx-auto">Your orders will appear here when customers purchase your products.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4 sm:space-y-6">
                {/* Search and Export Controls */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <Input
                            placeholder="Search by buyer name, product, or order ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black border-white/20 text-white placeholder:text-white/65 focus:border-yellow-400/70 focus:ring-yellow-400/20"
                        />
                    </div>

                    {/* Export Button */}
                    <Button
                        onClick={() => exportOrdersToCSV(orders)}
                        variant="outline"
                        className="border-white/20 text-white hover:bg-yellow-400 hover:text-black gap-2"
                        disabled={orders.length === 0}
                    >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export Orders</span>
                        <span className="sm:hidden">Export</span>
                    </Button>
                </div>

                <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-12 px-4 bg-black rounded-2xl border border-white/15">
                            <p className="text-white/75">No orders found matching "{searchQuery}"</p>
                        </div>
                    ) : (
                        filteredOrders.map((order) => {
                            const isService = order.metadata?.product_type === 'service' || order.items?.some(i => i.productType === 'service');
                            const isDigital = order.items?.some(i => i.productType === 'digital');
                            const isPaid = ['success', 'completed', 'paid'].includes(order.paymentStatus?.toLowerCase() || '');
                            const isPhysicalOnline = !isService && !isDigital && order.fulfillment_type === 'COURIER';
                            const sellerHandoff = order.metadata?.seller_handoff || {};
                            const pickupTracking = order.logistics?.pickupLeg;
                            const pickupIsActive = !!pickupTracking && !['failed', 'cancelled'].includes(String(pickupTracking.status || '').toLowerCase());
                            const handoffStatus = String(sellerHandoff.status || '').toLowerCase();
                            const canChooseHandoff = isPhysicalOnline
                                && isPaid
                                && !pickupIsActive
                                && !['dropoff_selected', 'dropped_at_hub'].includes(handoffStatus);
                            const canRequestPickup = canChooseHandoff;
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
                                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-4 sm:gap-6">
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
                                                        {order.status === 'COMPLETED' ? (
                                                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <CheckCircle className="h-3 w-3 mr-1" /> Completed
                                                            </Badge>
                                                        ) : order.status === 'AWAITING_SELLER_ACTION' ? (
                                                            <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Clock className="h-3 w-3 mr-1" /> Seller Action
                                                            </Badge>
                                                        ) : order.status === 'FULFILLING' ? (
                                                            <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Truck className="h-3 w-3 mr-1" /> Fulfilling
                                                            </Badge>
                                                        ) : order.status === 'READY_FOR_BUYER' ? (
                                                            <Badge className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Package className="h-3 w-3 mr-1" /> Ready for Buyer
                                                            </Badge>
                                                        ) : order.status === 'DELIVERY_COMPLETE' ? (
                                                            <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Package className="h-3 w-3 mr-1" /> Delivery Complete
                                                            </Badge>
                                                        ) : order.status === 'DELIVERY_PENDING' ? (
                                                            <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Truck className="h-3 w-3 mr-1" /> Delivery Pending
                                                            </Badge>
                                                        ) : order.status === 'FAILED' ? (
                                                            <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <XCircle className="h-3 w-3 mr-1" /> Failed
                                                            </Badge>
                                                        ) : order.status === 'CANCELLED' ? (
                                                            <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <XCircle className="h-3 w-3 mr-1" /> Cancelled
                                                            </Badge>
                                                        ) : order.status === 'SERVICE_PENDING' ? (
                                                            <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <CheckCircle className="h-3 w-3 mr-1" /> Service Pending
                                                            </Badge>
                                                        ) : order.status === 'COLLECTION_PENDING' ? (
                                                            <Badge className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Package className="h-3 w-3 mr-1" /> Ready for Collection
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
                                                                <Clock className="h-3 w-3 mr-1" /> Pending
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* NEW: Instruction Banner */}
                                                {(() => {
                                                    const productType = order.metadata?.product_type || (order.items?.some(i => i.productType === 'service') ? 'service' : 'physical');
                                                    const instruction = getOrderInstruction({
                                                        status: order.status,
                                                        userRole: 'seller',
                                                        orderType: productType.toUpperCase(),
                                                        fulfillmentType: order.fulfillment_type,
                                                    });
                                                    if (!instruction) return null;
                                                    return (
                                                        <div className={`mt-3 px-4 py-2 rounded-md text-sm font-medium ${instruction.color === 'blue' ? 'bg-blue-500/15 text-white border border-blue-400/30' :
                                                            instruction.color === 'amber' ? 'bg-yellow-400/15 text-yellow-100 border border-yellow-400/30' :
                                                                instruction.color === 'green' ? 'bg-green-500/15 text-green-100 border border-green-400/30' :
                                                                    'bg-red-500/15 text-red-100 border border-red-400/30'
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
                                                                    {order.metadata.booking_date ? formatDate(order.metadata.booking_date) : 'N/A'}
                                                                    {order.metadata.booking_time && <span className="text-white/70 font-normal"> at {order.metadata.booking_time}</span>}
                                                                </p>
                                                            </div>
                                                            <div className="bg-black/60 p-2 rounded border border-purple-400/20">
                                                                <p className="text-purple-200 text-xs font-medium mb-1">Location</p>
                                                                <div className="font-semibold text-white break-words">
                                                                    {order.metadata.buyer_location ? (
                                                                        <div className="space-y-1">
                                                                            <p>{order.metadata.buyer_location.fullAddress || 'Buyer Coordinates Provided'}</p>
                                                                            {order.metadata.buyer_location.latitude && order.metadata.buyer_location.longitude && (
                                                                                <a
                                                                                    href={`https://www.google.com/maps?q=${order.metadata.buyer_location.latitude},${order.metadata.buyer_location.longitude}`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-xs text-purple-200 hover:text-yellow-200 underline block"
                                                                                >
                                                                                    View on Maps
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <p>{order.metadata.service_location || 'Not specified'}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {order.metadata?.service_requirements && (
                                                            <div className="mt-3 bg-black/60 p-2 rounded border border-purple-400/20">
                                                                <p className="text-purple-200 text-xs font-medium mb-1">Special Requirements</p>
                                                                <p className="text-sm text-white break-words">
                                                                    {order.metadata.service_requirements}
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
                                                                className="w-full justify-center border-blue-400/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 text-[10px] sm:text-xs font-semibold transition-all duration-200 h-7"
                                                                onClick={() => selectHubDropoff(order.id)}
                                                                disabled={isUpdating}
                                                            >
                                                                <MapPin className="h-3 w-3 mr-1.5" />
                                                                I will drop off at hub
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {canRequestPickup && (
                                                        <div className="mb-2 space-y-1.5">
                                                            <Button
                                                                size="sm"
                                                                className="w-full justify-center bg-yellow-400 text-black hover:bg-yellow-300 text-[10px] sm:text-xs font-semibold transition-all duration-200 h-7"
                                                                onClick={() => openRequestPickupDialog(order)}
                                                                disabled={isUpdating || isRequestingPickup}
                                                            >
                                                                <Truck className="h-3 w-3 mr-1.5" />
                                                                Request pickup
                                                            </Button>
                                                            <p className="text-[10px] leading-relaxed text-white/60">
                                                                Optional. Without pickup, drop the package at the hub within 24 hours.
                                                            </p>
                                                        </div>
                                                    )}
                                                    {canMarkDroppedAtHub && (
                                                        <div className="mb-2 rounded-lg border border-blue-400/25 bg-blue-500/10 p-2">
                                                            <p className="mb-2 text-[10px] leading-relaxed text-blue-100">
                                                                Drop at {HUB_DROPOFF_LOCATION} within 24 hours.
                                                            </p>
                                                            <Button
                                                                size="sm"
                                                                className="w-full justify-center bg-blue-500 hover:bg-blue-600 text-white text-[10px] sm:text-xs font-semibold transition-all duration-200 h-7"
                                                                onClick={() => handleReadyForPickupClick(order.id, 'hub_dropoff')}
                                                                disabled={isUpdating}
                                                            >
                                                                <Package className="h-3 w-3 mr-1.5" />
                                                                Mark Dropped Off at Hub
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
                                                                className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-200 hover:bg-red-500/10 border-red-400/20 hover:border-red-400/30 text-[10px] sm:text-xs font-semibold transition-all duration-200 h-6"
                                                                onClick={() => handleCancelClick(order.id)}
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
                                                                className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-[10px] sm:text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200 h-6"
                                                                onClick={() => confirmBooking(order.id)}
                                                                disabled={isUpdating}
                                                            >
                                                                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                Confirm Booking
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-200 hover:bg-red-500/10 border-red-400/20 hover:border-red-400/30 text-[10px] sm:text-xs font-semibold transition-all duration-200 h-6"
                                                                onClick={() => handleCancelClick(order.id)}
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
                                                                className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-[10px] sm:text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200 h-6"
                                                                onClick={() => markServiceReadyForBuyerConfirmation(order.id)}
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
                                                                className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-[10px] sm:text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200 h-6"
                                                                onClick={() => handleReadyForPickupClick(order.id, 'shop_ready')}
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
                                                                    className="w-full sm:w-auto lg:w-full justify-center sm:justify-start bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-[10px] sm:text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200 h-6"
                                                                    onClick={() => handleReadyForPickupClick(order.id, 'shop_ready')}
                                                                    disabled={isUpdating}
                                                                >
                                                                    <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5" />
                                                                    <span className="hidden sm:inline">Mark as Ready for Pickup</span>
                                                                    <span className="sm:hidden">Ready for Pickup</span>
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="w-full sm:w-auto lg:w-full justify-center sm:justify-start text-red-200 hover:bg-red-500/10 border-red-400/20 hover:border-red-400/30 text-[10px] sm:text-xs font-semibold transition-all duration-200 h-6"
                                                                    onClick={() => handleCancelClick(order.id)}
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
                        })
                    )}
                </div>

            </div >

            {/* Seller Pickup Payment Dialog */}
            <Dialog open={!!pickupOrder} onOpenChange={(open) => !open && closeRequestPickupDialog()}>
                <DialogContent className="flex max-h-[88dvh] flex-col overflow-hidden sm:max-w-2xl bg-black border border-white/15 text-white">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                            <div className="w-8 h-8 bg-yellow-400 text-black rounded-full flex items-center justify-center">
                                <Truck className="h-4 w-4" />
                            </div>
                            Request Mzigo Ego pickup
                        </DialogTitle>
                        <DialogDescription className="text-sm text-white/75">
                            Pickup is optional. If you do not request pickup, drop the package at the hub within 24 hours.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={requestPickup} className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="space-y-4 py-2">
                            {pickupOrder && (
                                <div className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs sm:grid-cols-3">
                                    <div>
                                        <p className="text-white/60">Order</p>
                                        <p className="font-semibold text-white">#{pickupOrder.orderNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/60">Package</p>
                                        <p className="font-semibold text-white">{pickupOrder.items?.[0]?.name || 'Physical product'}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/60">Pickup fee</p>
                                        <p className="font-semibold text-yellow-200">
                                            {isPickupQuoteLoading ? 'Calculating...' : formatCurrency(pickupQuote?.feeAmount || 0, pickupQuote?.currency || 'KSH')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <LocationPicker
                                    label="Pickup Location"
                                    detailedLabel="Full Pickup Address"
                                    placeholder="Search pickup location..."
                                    autoPopulate
                                    onLocationChange={(address, coordinates) => {
                                        setPickupLocation({
                                            address,
                                            lat: coordinates?.lat ?? null,
                                            lng: coordinates?.lng ?? null
                                        });
                                    }}
                                    className="[&_label]:!text-white [&_p]:!text-white/70"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                                <div className="space-y-2">
                                    <Label htmlFor="pickup-phone" className="text-xs font-semibold text-white">M-Pesa number for pickup fee</Label>
                                    <Input
                                        id="pickup-phone"
                                        type="tel"
                                        value={pickupPhone}
                                        onChange={(event) => setPickupPhone(event.target.value)}
                                        placeholder="0712345678"
                                        className="bg-white text-slate-950 placeholder:text-slate-400"
                                        disabled={isRequestingPickup}
                                    />
                                </div>
                                <div className="rounded-xl border border-yellow-400/25 bg-yellow-400/10 p-3 text-xs">
                                    <div className="flex items-center gap-2 text-yellow-100">
                                        <CreditCard className="h-4 w-4" />
                                        <span className="font-semibold">Seller pays pickup from CBD hub.</span>
                                    </div>
                                    {pickupQuote && (
                                        <p className="mt-2 text-white/75">
                                            {pickupQuote.chargeableDistanceKm} km billed at KSh {pickupQuote.rateKesPerKm}/km.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
                                <span>After the pickup fee is paid, the pickup leg becomes visible to Mzigo Ego. If the buyer also paid for door delivery, both legs stay grouped under the same package.</span>
                            </div>

                            {pickupQuoteError && (
                                <p className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
                                    {pickupQuoteError}
                                </p>
                            )}
                        </div>

                        <DialogFooter className="sticky bottom-0 mt-3 gap-2 border-t border-white/10 bg-black py-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeRequestPickupDialog}
                                disabled={isRequestingPickup}
                                className="bg-transparent border-white/20 text-white hover:bg-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isRequestingPickup || isPickupQuoteLoading}
                                className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
                            >
                                {isRequestingPickup ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Sending STK...
                                    </>
                                ) : (
                                    'Pay pickup fee'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Ready for Pickup Confirmation Dialog */}
            < Dialog open={showPickupDialog} onOpenChange={setShowPickupDialog} >
                <DialogContent className="sm:max-w-md bg-black backdrop-blur-[12px] border border-white/15 shadow-xl text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                            <div className="w-8 h-8 bg-blue-500/10 border border-blue-400/20 rounded-full flex items-center justify-center">
                                <Truck className="h-4 w-4 text-blue-300" />
                            </div>
                            {readyAction === 'hub_dropoff' ? 'Confirm Package Drop-off' : 'Confirm Shop Pickup Readiness'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-white/75 leading-relaxed">
                            {readyAction === 'hub_dropoff'
                                ? 'Have you dropped off the package at the specified location?'
                                : 'Is this order ready for the buyer to collect at your shop?'}
                        </DialogDescription>
                    </DialogHeader>

                    {readyAction === 'hub_dropoff' && (
                    <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 my-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-500/10 border border-blue-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                                <Package className="h-4 w-4 text-blue-300" />
                            </div>
                            <div className="text-sm">
                                <p className="font-semibold text-blue-100 mb-1">Drop-off Location:</p>
                                <p className="text-blue-50">
                                    {HUB_DROPOFF_LOCATION}
                                </p>
                            </div>
                        </div>
                    </div>
                    )}

                    <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-xl p-3 mb-4">
                        <p className="text-sm text-yellow-100 font-semibold">
                            {readyAction === 'hub_dropoff'
                                ? 'Please confirm only after the package has been physically dropped off at the specified location.'
                                : 'Please confirm only after the package is ready to hand over to the buyer.'}
                        </p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setShowPickupDialog(false)}
                            disabled={isUpdating}
                            className="w-full sm:w-auto bg-transparent border-white/20 text-white hover:bg-white/10 h-8 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={markAsReadyForPickup}
                            disabled={isUpdating}
                            className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200 h-8 text-xs"
                        >
                            {isUpdating ? (
                                <>
                                    <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-3 w-3 mr-2" />
                                    {readyAction === 'hub_dropoff' ? 'Confirm Drop-off' : 'Confirm Ready'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Cancel Order Confirmation Dialog */}
            < Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog} >
                <DialogContent className="sm:max-w-[425px] bg-black backdrop-blur-[12px] border border-white/15 shadow-xl text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                            <div className="w-8 h-8 bg-red-500/10 border border-red-400/20 rounded-full flex items-center justify-center">
                                <XCircle className="h-4 w-4 text-red-300" />
                            </div>
                            Cancel Order
                        </DialogTitle>
                        <DialogDescription className="text-sm text-white/75 leading-relaxed">
                            Are you sure you want to cancel this order?
                            <br /><br />
                            The buyer will receive a full refund to their account balance.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-3 mb-4">
                        <p className="text-sm text-red-100 font-semibold">
                            This action cannot be undone. The buyer will be notified of the cancellation.
                        </p>
                    </div>

                    <DialogFooter className="mt-4 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowCancelDialog(false)}
                            disabled={isUpdating}
                            className="bg-transparent border-white/20 text-white hover:bg-white/10"
                        >
                            No, Keep Order
                        </Button>
                        <Button
                            onClick={cancelOrder}
                            disabled={isUpdating}
                            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                        >
                            {isUpdating ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Cancelling...
                                </>
                            ) : (
                                'Yes, Cancel Order'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </>
    );
}
