import { OrderStatus } from '@/types';
import { useState, useMemo, useCallback, useEffect, useRef, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format, isValid, parseISO } from 'date-fns';
import type { ApiOrder } from '@/types/api/order';
import { OrderStatusBadge } from './OrderStatusBadge';
import { SellerOrderCard } from './SellerOrderCard';

import { Clock, Package, Truck, CheckCircle, RefreshCw, XCircle, Calendar, User, Download, MapPin, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportOrdersToCSV } from '@/utils/exportUtils';
import {
  useQuotePickupMutation,
  useRequestPickupMutation,
  useSelectHubDropoffMutation,
  useMarkDroppedAtHubMutation,
  useUpdateOrderStatusMutation,
  useConfirmBookingMutation,
  useCancelSellerOrderMutation
} from '@/hooks/seller/mutations/useSellerOrderMutations';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import { getOrderInstruction } from '@/utils/orderInstructions';
import { useSellerOrders } from './dashboard/hooks/useSellerOrders';
import { sellerDashboardQueryKeys } from './dashboard/queryKeys';
import LocationPicker from '../common/LocationPicker';
import { OrderLogisticsTracking } from '../orders/OrderLogisticsTracking';

import { formatCurrency, formatDate, getEffectiveFulfillmentType, hasBuyerPaidDoorDelivery, HUB_DROPOFF_LOCATION } from './sellerOrders.utils';

export default function SellerOrdersSection() {
    const queryClient = useQueryClient();
    const ordersQuery = useSellerOrders();
    const orders = useMemo(() => ordersQuery.data || [], [ordersQuery.data]);
    const isLoading = ordersQuery.isLoading;
    const [isUpdating, setIsUpdating] = useState(false);
    
    const quotePickupMutation = useQuotePickupMutation();
    const requestPickupMutation = useRequestPickupMutation();
    const selectHubDropoffMutation = useSelectHubDropoffMutation();
    const markDroppedAtHubMutation = useMarkDroppedAtHubMutation();
    const updateOrderStatusMutation = useUpdateOrderStatusMutation();
    const confirmBookingMutation = useConfirmBookingMutation();
    const cancelOrderMutation = useCancelSellerOrderMutation();

    // Store latest mutateAsync in a ref so the quote effect doesn't need the mutation as a dep
    const quotePickupRef = useRef(quotePickupMutation.mutateAsync);
    quotePickupRef.current = quotePickupMutation.mutateAsync;

    // FIX (Task 18): Prevent duplicate order mutations via synchronous lock
    const { runWithLock } = useAsyncLock();
    const [showPickupDialog, setShowPickupDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [readyAction, setReadyAction] = useState<'hub_dropoff' | 'shop_ready'>('hub_dropoff');
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [pickupOrder, setPickupOrder] = useState<ApiOrder | null>(null);
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
        pricingModel?: string;
        cbdPickupFeeKes?: number;
        cbdRadiusKm?: number;
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
                const quote = await quotePickupRef.current({
                    orderId: pickupOrder.id,
                    phone: pickupPhone,
                    address: pickupLocation.address,
                    lat: pickupLocation.lat,
                    lng: pickupLocation.lng
                });
                setPickupQuote({
                    feeAmount: Number(quote.feeAmount || 0),
                    distanceKm: Number(quote.distanceKm || 0),
                    chargeableDistanceKm: Number(quote.chargeableDistanceKm || 0),
                    rateKesPerKm: Number(quote.rateKesPerKm || 40),
                    currency: quote.currency || 'KES'
                });
            } catch (error) {
                const err = error as { message?: string; response?: { data?: { error?: string; message?: string } } };
                setPickupQuote(null);
                setPickupQuoteError(err.response?.data?.error || err.response?.data?.message || err.message || 'Could not calculate pickup fee');
            } finally {
                setIsPickupQuoteLoading(false);
            }
        }, 400);

        return () => window.clearTimeout(timer);
    }, [pickupOrder, pickupLocation.address, pickupLocation.lat, pickupLocation.lng, pickupPhone]);

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

    const openRequestPickupDialog = (order: ApiOrder) => {
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
                await requestPickupMutation.mutateAsync({
                    orderId: pickupOrder.id,
                    phone: pickupPhone.trim(),
                    address: pickupLocation.address.trim(),
                    lat: pickupLocation.lat,
                    lng: pickupLocation.lng,
                    quote: {
                        ...pickupQuote,
                        idempotencyKey
                    }
                });
                setIsRequestingPickup(false);
                closeRequestPickupDialog();
            } catch (error) {
                const err = error as { message?: string; response?: { data?: { message?: string } } };
                setPickupQuoteError(err.response?.data?.message || err.message || 'Failed to request pickup');
                toast({
                    title: 'Pickup request failed',
                    description: err.response?.data?.message || err.message || 'Please try again.',
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
                await selectHubDropoffMutation.mutateAsync(orderId);
                toast({
                    title: 'Mzigo Ego drop-off selected',
                    description: 'Drop the package at Mzigo Ego within 24 hours, then mark it handed over.'
                });
            } catch (error) {
                const err = error as { message?: string; response?: { data?: { message?: string } } };
                toast({
                    title: 'Could not select Mzigo drop-off',
                    description: err.response?.data?.message || err.message || 'Please try again.',
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
                    await markDroppedAtHubMutation.mutateAsync(selectedOrderId);
                } else {
                    await updateOrderStatusMutation.mutateAsync({ orderId: selectedOrderId, status: 'READY_FOR_BUYER' as OrderStatus });
                }

                toast({
                    title: readyAction === 'hub_dropoff' ? 'Package handed to Mzigo Ego' : 'Order ready for pickup',
                    description: readyAction === 'hub_dropoff'
                        ? 'Mzigo Ego will secure the package, check it against the order, and update the buyer.'
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
                await updateOrderStatusMutation.mutateAsync({ orderId, status: 'DELIVERY_COMPLETE' as OrderStatus });

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
                await updateOrderStatusMutation.mutateAsync({ orderId, status: 'READY_FOR_BUYER' as OrderStatus });

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
                await confirmBookingMutation.mutateAsync(orderId);

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
                const result = await cancelOrderMutation.mutateAsync(cancellingOrderId);

                toast({
                    title: 'Order Cancelled',
                    description: `The order has been cancelled. Buyer will receive a refund of KSh ${result.refundAmount?.toLocaleString() || '0'}.`,
                });
            } catch (err) {
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

    const pickupOrderIsPhysicalOnline = pickupOrder
        ? !pickupOrder.items?.some(item => item.productType === 'service' || item.productType === 'digital') && getEffectiveFulfillmentType(pickupOrder) === 'COURIER'
        : false;
    const pickupDialogHelpText = pickupOrderIsPhysicalOnline
        ? 'Choose pickup if you want Mzigo Ego to collect the package from your location. They will secure it and check it against the order before delivery.'
        : 'Mzigo pickup is only available for online shop courier orders.';

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
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-red-200 shadow-sm">
                <div className="mx-auto w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mb-4">
                    <RefreshCw className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-950 mb-2">Unable to load orders</h3>
                <p className="text-slate-600 max-w-md mx-auto mb-4">Please try refreshing your orders.</p>
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
                    <Package className="h-8 w-8 text-yellow-700" />
                </div>
                <h3 className="text-lg font-semibold text-slate-950 mb-2">No orders yet</h3>
                <p className="text-slate-600 max-w-md mx-auto">Your orders will appear here when customers purchase your products.</p>
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
                            className="h-11 rounded-2xl bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 focus:border-yellow-400/70 focus:ring-yellow-400/20"
                        />
                    </div>

                    {/* Export Button */}
                    <Button
                        onClick={() => exportOrdersToCSV(orders)}
                        variant="outline"
                        className="h-11 rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-yellow-400 hover:text-black gap-2"
                        disabled={orders.length === 0}
                    >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export Orders</span>
                        <span className="sm:hidden">Export</span>
                    </Button>
                </div>

                <div className="space-y-4">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-slate-600">No orders found matching "{searchQuery}"</p>
                        </div>
                    ) : (
                        filteredOrders.map((order) => (
                            <SellerOrderCard
                                key={order.id}
                                order={order}
                                isUpdating={isUpdating}
                                onReadyForPickup={handleReadyForPickupClick}
                                onRequestPickup={openRequestPickupDialog}
                                onSelectHubDropoff={selectHubDropoff}
                                onMarkServiceReady={markServiceReadyForBuyerConfirmation}
                                onConfirmBooking={confirmBooking}
                                onCancel={handleCancelClick}
                            />
                        ))
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
                            {pickupDialogHelpText}
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
                                        <span className="font-semibold">Seller pays the Mzigo pickup fee.</span>
                                    </div>
                                    {pickupQuote && (
                                        <p className="mt-2 text-white/75">
                                            {pickupQuote.pricingModel === 'cbd_flat'
                                                ? `Nairobi CBD flat pickup fee: ${formatCurrency(pickupQuote.feeAmount, pickupQuote.currency || 'KSH')}.`
                                                : `${pickupQuote.chargeableDistanceKm} km billed at KSh ${pickupQuote.rateKesPerKm}/km.`}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
                                <span>After the pickup fee is paid, Mzigo Ego collects the package, secures it, and checks it against the order before delivery.</span>
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
                            {readyAction === 'hub_dropoff' ? 'Confirm Mzigo Ego Drop-off' : 'Confirm Shop Pickup Readiness'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-white/75 leading-relaxed">
                            {readyAction === 'hub_dropoff'
                                ? 'Have you handed this package to Mzigo Ego?'
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
                                <p className="font-semibold text-blue-100 mb-1">Mzigo Ego drop-off location:</p>
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
                                ? 'Please confirm only after Mzigo Ego has received the package. They will secure it and check it against the order before delivery.'
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
                                    {readyAction === 'hub_dropoff' ? 'Confirm Handoff' : 'Confirm Ready'}
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


