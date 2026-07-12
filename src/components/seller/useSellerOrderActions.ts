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

export function useSellerOrderActions() {
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


    return {
        isLoading,
        ordersQuery,
        orders,
        searchQuery,
        setSearchQuery,
        filteredOrders,
        isUpdating,
        handleReadyForPickupClick,
        openRequestPickupDialog,
        selectHubDropoff,
        markServiceReadyForBuyerConfirmation,
        confirmBooking,
        handleCancelClick,
        pickupOrder,
        closeRequestPickupDialog,
        pickupDialogHelpText,
        requestPickup,
        isPickupQuoteLoading,
        pickupQuote,
        setPickupLocation,
        pickupPhone,
        setPickupPhone,
        isRequestingPickup,
        pickupQuoteError,
        showPickupDialog,
        setShowPickupDialog,
        readyAction,
        markAsReadyForPickup,
        showCancelDialog,
        setShowCancelDialog,
        cancelOrder,
    };
}
