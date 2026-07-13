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
import { useSellerOrderActions } from './useSellerOrderActions';
import { SellerOrderDialogs } from './SellerOrderDialogs';

export default function SellerOrdersSection() {
    const {
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
    } = useSellerOrderActions();

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
                                isRequestingPickup={isRequestingPickup}
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

            <SellerOrderDialogs
                pickupOrder={pickupOrder}
                closeRequestPickupDialog={closeRequestPickupDialog}
                pickupDialogHelpText={pickupDialogHelpText}
                requestPickup={requestPickup}
                isPickupQuoteLoading={isPickupQuoteLoading}
                pickupQuote={pickupQuote}
                setPickupLocation={setPickupLocation}
                pickupPhone={pickupPhone}
                setPickupPhone={setPickupPhone}
                isRequestingPickup={isRequestingPickup}
                pickupQuoteError={pickupQuoteError}
                showPickupDialog={showPickupDialog}
                setShowPickupDialog={setShowPickupDialog}
                readyAction={readyAction}
                markAsReadyForPickup={markAsReadyForPickup}
                isUpdating={isUpdating}
                showCancelDialog={showCancelDialog}
                setShowCancelDialog={setShowCancelDialog}
                cancelOrder={cancelOrder}
            />
        </>
    );
}


