import type { FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, RefreshCw, CheckCircle, XCircle, Package, MapPin, CreditCard } from 'lucide-react';
import LocationPicker from '../common/LocationPicker';
import type { ApiOrder } from '@/types/api/order';
import { formatCurrency, HUB_DROPOFF_LOCATION } from './sellerOrders.utils';

interface PickupQuote {
  feeAmount: number;
  distanceKm: number;
  chargeableDistanceKm: number;
  rateKesPerKm: number;
  currency: string;
  pricingModel?: string;
  cbdPickupFeeKes?: number;
  cbdRadiusKm?: number;
}

interface SellerOrderDialogsProps {
  pickupOrder: ApiOrder | null;
  closeRequestPickupDialog: () => void;
  pickupDialogHelpText: string;
  requestPickup: (event: FormEvent) => Promise<void>;
  isPickupQuoteLoading: boolean;
  pickupQuote: PickupQuote | null;
  setPickupLocation: React.Dispatch<React.SetStateAction<{ address: string; lat: number | null; lng: number | null }>>;
  pickupPhone: string;
  setPickupPhone: React.Dispatch<React.SetStateAction<string>>;
  isRequestingPickup: boolean;
  pickupQuoteError: string;
  showPickupDialog: boolean;
  setShowPickupDialog: React.Dispatch<React.SetStateAction<boolean>>;
  readyAction: 'hub_dropoff' | 'shop_ready';
  markAsReadyForPickup: () => Promise<void>;
  isUpdating: boolean;
  showCancelDialog: boolean;
  setShowCancelDialog: React.Dispatch<React.SetStateAction<boolean>>;
  cancelOrder: () => Promise<void>;
}

export function SellerOrderDialogs({
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
  isUpdating,
  showCancelDialog,
  setShowCancelDialog,
  cancelOrder,
}: SellerOrderDialogsProps) {
  return (
    <>
            {/* Seller Pickup Payment Dialog */}
            <Dialog open={!!pickupOrder} onOpenChange={(open) => !open && closeRequestPickupDialog()}>
                <DialogContent className="flex max-h-[82dvh] flex-col overflow-hidden w-[92vw] sm:max-w-md bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/15 text-slate-950 dark:text-white shadow-2xl">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
                            <div className="w-8 h-8 bg-yellow-400 text-black rounded-full flex items-center justify-center font-bold">
                                <Truck className="h-4 w-4" />
                            </div>
                            Request Mzigo Ego pickup
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-600 dark:text-white/75 font-medium">
                            {pickupDialogHelpText}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={requestPickup} className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="space-y-4 py-2">
                            {pickupOrder && (
                                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 text-xs sm:grid-cols-3">
                                    <div>
                                        <p className="text-slate-500 dark:text-white/60">Order</p>
                                        <p className="font-bold text-slate-900 dark:text-white">#{pickupOrder.orderNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 dark:text-white/60">Package</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{pickupOrder.items?.[0]?.name || 'Physical product'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 dark:text-white/60">Pickup fee</p>
                                        <p className="font-bold text-yellow-700 dark:text-yellow-200">
                                            {isPickupQuoteLoading ? 'Calculating...' : formatCurrency(pickupQuote?.feeAmount || 0, pickupQuote?.currency || 'KSH')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
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
                                    className="[&_label]:!text-slate-800 dark:[&_label]:!text-white [&_p]:!text-slate-600 dark:[&_p]:!text-white/70"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                                <div className="space-y-2">
                                    <Label htmlFor="pickup-phone" className="text-xs font-bold text-slate-800 dark:text-white">M-Pesa number for pickup fee</Label>
                                    <Input
                                        id="pickup-phone"
                                        type="tel"
                                        value={pickupPhone}
                                        onChange={(event) => setPickupPhone(event.target.value)}
                                        placeholder="0712345678"
                                        className="bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-400"
                                        disabled={isRequestingPickup}
                                    />
                                </div>
                                <div className="rounded-xl border border-yellow-400/30 bg-amber-50 dark:bg-yellow-400/10 p-3 text-xs">
                                    <div className="flex items-center gap-2 text-amber-900 dark:text-yellow-100">
                                        <CreditCard className="h-4 w-4" />
                                        <span className="font-bold">Seller pays the Mzigo pickup fee.</span>
                                    </div>
                                    {pickupQuote && (
                                        <p className="mt-2 text-amber-800 dark:text-white/75 font-medium">
                                            {pickupQuote.pricingModel === 'cbd_flat'
                                                ? `Nairobi CBD flat pickup fee: ${formatCurrency(pickupQuote.feeAmount, pickupQuote.currency || 'KSH')}.`
                                                : `${pickupQuote.chargeableDistanceKm} km billed at KSh ${pickupQuote.rateKesPerKm}/km.`}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 text-xs text-slate-700 dark:text-white/75 font-medium">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-300" />
                                <span>After the pickup fee is paid, Mzigo Ego collects the package, secures it, and checks it against the order before delivery.</span>
                            </div>

                            {pickupQuoteError && (
                                <p className="rounded-lg border border-red-300 dark:border-red-400/25 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-100">
                                    {pickupQuoteError}
                                </p>
                            )}
                        </div>

                        <DialogFooter className="sticky bottom-0 mt-3 gap-2 border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0a0a0a] py-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeRequestPickupDialog}
                                disabled={isRequestingPickup}
                                className="bg-slate-100 dark:bg-transparent border-slate-300 dark:border-white/20 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 font-semibold"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isRequestingPickup || isPickupQuoteLoading}
                                className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-md"
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
                <DialogContent className="w-[90vw] sm:max-w-sm bg-white dark:bg-[#0a0a0a] backdrop-blur-[12px] border border-slate-200 dark:border-white/15 shadow-xl text-slate-950 dark:text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-400/20 rounded-full flex items-center justify-center">
                                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                            </div>
                            {readyAction === 'hub_dropoff' ? 'Confirm Mzigo Ego Drop-off' : 'Confirm Shop Pickup Readiness'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-600 dark:text-white/75 leading-relaxed font-medium">
                            {readyAction === 'hub_dropoff'
                                ? 'Have you handed this package to Mzigo Ego?'
                                : 'Is this order ready for the buyer to collect at your shop?'}
                        </DialogDescription>
                    </DialogHeader>

                    {readyAction === 'hub_dropoff' && (
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-400/20 rounded-xl p-4 my-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                                <Package className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                            </div>
                            <div className="text-sm">
                                <p className="font-bold text-blue-900 dark:text-blue-100 mb-1">Mzigo Ego drop-off location:</p>
                                <p className="text-blue-800 dark:text-blue-50 font-medium">
                                    {HUB_DROPOFF_LOCATION}
                                </p>
                            </div>
                        </div>
                    </div>
                    )}

                    <div className="bg-amber-50 dark:bg-yellow-500/10 border border-amber-200 dark:border-yellow-400/20 rounded-xl p-3 mb-4">
                        <p className="text-sm text-amber-900 dark:text-yellow-100 font-semibold">
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
                            className="w-full sm:w-auto bg-slate-100 dark:bg-transparent border-slate-300 dark:border-white/20 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 h-8 text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={markAsReadyForPickup}
                            disabled={isUpdating}
                            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold shadow-sm hover:shadow-md transition-all duration-200 h-8 text-xs"
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
                <DialogContent className="w-[90vw] sm:max-w-[350px] bg-white dark:bg-[#0a0a0a] backdrop-blur-[12px] border border-slate-200 dark:border-white/15 shadow-xl text-slate-950 dark:text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
                            <div className="w-8 h-8 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-400/20 rounded-full flex items-center justify-center">
                                <XCircle className="h-4 w-4 text-red-600 dark:text-red-300" />
                            </div>
                            Cancel Order
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-600 dark:text-white/75 leading-relaxed font-medium">
                            Are you sure you want to cancel this order?
                            <br /><br />
                            The buyer will receive a full refund to their account balance.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-400/20 rounded-xl p-3 mb-4">
                        <p className="text-sm text-red-900 dark:text-red-100 font-semibold">
                            This action cannot be undone. The buyer will be notified of the cancellation.
                        </p>
                    </div>

                    <DialogFooter className="mt-4 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowCancelDialog(false)}
                            disabled={isUpdating}
                            className="bg-slate-100 dark:bg-transparent border-slate-300 dark:border-white/20 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 font-semibold"
                        >
                            No, Keep Order
                        </Button>
                        <Button
                            onClick={cancelOrder}
                            disabled={isUpdating}
                            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold shadow-sm hover:shadow-md transition-all duration-200"
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
