import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, MapPin, Edit2, Loader2 } from 'lucide-react';
import LocationPicker from './common/LocationPicker';
import { Product } from '@/types';
import { hasPreciseLocation, type BuyerLocationPayload } from '@/lib/location';
import { useServiceBooking, type ProductWithApiFields } from './useServiceBooking';


interface ServiceBookingModalProps {
    product: Product;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bookingData: {
        date: Date;
        time: string;
        location: string;
        locationType?: string;
        serviceRequirements?: string;
        buyerLocation?: BuyerLocationPayload | null
    }) => void;
    initialBuyerLocation?: BuyerLocationPayload | null;
}

export function ServiceBookingModal({ product, isOpen, onClose, onConfirm, initialBuyerLocation = null }: ServiceBookingModalProps & { product: ProductWithApiFields }) {
    const {
        date,
        setDate,
        isDateDisabled,
        time,
        setTime,
        availableTimeSlots,
        isShopless,
        isChangingLocation,
        setIsChangingLocation,
        handleLocationPickerChange,
        customLocation,
        buyerProfile,
        saveLocationToProfile,
        isUpdatingProfile,
        buyerLocation,
        location,
        seller,
        serviceRequirements,
        setServiceRequirements,
        wordCount,
        maxWords,
        handleConfirm,
        isValid,
        getDisabledReason,
    } = useServiceBooking(product, isOpen, onConfirm, initialBuyerLocation);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex flex-col w-[95vw] max-w-[400px] max-h-[85dvh] gap-0 p-0 overflow-hidden rounded-[32px] border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-[#0a0a0a] text-slate-950 dark:text-white transition-colors duration-200">
                <DialogHeader className="p-6 pb-2 shrink-0 space-y-4 pt-8 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a]">
                    <div className="mx-auto w-12 h-12 bg-yellow-50 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-yellow-200 dark:border-white/10">
                        <CalendarIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="space-y-1 text-center">
                        <DialogTitle className="text-xl font-bold text-slate-950 dark:text-white">Book Service</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-600 dark:text-[#666]">
                            {product.name}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-center">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    disabled={isDateDisabled}
                                    className="bg-transparent text-slate-950 dark:text-white p-0"
                                    classNames={{
                                        nav_button: "border-0 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white text-slate-500 dark:text-[#666] h-8 w-8",
                                        caption: "text-sm font-bold pt-1 text-slate-950 dark:text-white",
                                        head_cell: "text-slate-500 dark:text-[#666] text-[0.8rem] font-medium pt-1 w-8 sm:w-9",
                                        cell: "h-8 w-8 sm:h-9 sm:w-9 text-center text-sm p-0 flex items-center justify-center",
                                        day: "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl aria-selected:opacity-100 text-yellow-600 dark:text-yellow-400",
                                        day_selected: "!bg-yellow-400 !text-black hover:!bg-yellow-400 hover:!text-black focus:!bg-yellow-400 focus:!text-black font-bold",
                                        day_today: "text-slate-950 dark:text-white bg-slate-100 dark:bg-white/5 font-bold",
                                        day_outside: "text-slate-300 dark:text-[#333] opacity-50",
                                        day_disabled: "text-slate-300 dark:text-[#333] opacity-50 hover:bg-transparent",
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-[#666]">Time</Label>
                                <Select value={time} onValueChange={setTime}>
                                    <SelectTrigger className="w-full h-11 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-transparent text-base sm:text-sm font-medium focus:ring-1 focus:ring-yellow-400 transition-all text-slate-950 dark:text-white">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-[#666]" />
                                            <SelectValue placeholder="Select time" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/5 text-white max-h-[200px]">
                                        {availableTimeSlots.map(slot => (
                                            <SelectItem key={slot} value={slot} className="focus:bg-white/10 focus:text-white text-base sm:text-sm py-2.5 cursor-pointer">{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Location Selection - STRICT MODE */}
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-yellow-400/80 tracking-widest pl-1">
                                    {isShopless ? "Your Service Address / My Location" : "Service Location"}
                                </Label>

                                {isShopless ? (
                                    <div className="space-y-4 animate-in fade-in duration-500">
                                        {isChangingLocation ? (
                                            <div className="space-y-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                                                <LocationPicker
                                                    onLocationChange={handleLocationPickerChange}
                                                    initialAddress={customLocation || buyerProfile?.fullAddress}
                                                    mapClassName="h-44 sm:h-56"
                                                />
                                                <Button
                                                    onClick={saveLocationToProfile}
                                                    disabled={isUpdatingProfile || !buyerLocation}
                                                    className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-2xl shadow-lg shadow-yellow-400/20"
                                                >
                                                    {isUpdatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Precise Address'}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-4 p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-white/20 transition-all group">
                                                <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-yellow-400/10 transition-colors">
                                                    <MapPin className="h-5 w-5 text-[#666] group-hover:text-yellow-400" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium text-white/90">
                                                        {customLocation || buyerProfile?.fullAddress || 'Search Precise Location...'}
                                                    </p>
                                                    <button
                                                        onClick={() => setIsChangingLocation(true)}
                                                        className="text-[10px] font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-wider flex items-center gap-1.5"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                        Edit Address
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {!isShopless ? (
                                            // Always use seller profile address for In-Store (Task BUG-SHOP-12)
                                            <div
                                                className="flex items-center gap-4 p-4 bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.1)] rounded-3xl border-2 border-yellow-400 transition-all cursor-default"
                                            >
                                                <div className="w-10 h-10 bg-black/10 rounded-2xl flex items-center justify-center shrink-0">
                                                    <MapPin className="h-5 w-5 text-black" />
                                                </div>
                                                <p className="text-sm font-bold text-black">
                                                    {location || seller?.physicalAddress || 'Our Shop'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-white/5 rounded-3xl border border-white/5 text-center italic text-[#666] text-xs">
                                                Please select a location above!
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
                                    Service Requirements <span className={`ml-1 ${wordCount > maxWords ? 'text-red-400' : 'text-[#444]'}`}>({wordCount}/{maxWords})</span>
                                </Label>
                                <textarea
                                    placeholder="Describe your needs..."
                                    value={serviceRequirements}
                                    onChange={(e) => setServiceRequirements(e.target.value)}
                                    className="flex min-h-[80px] w-full rounded-xl bg-white/5 border-0 px-3 py-2 text-sm text-white placeholder:text-[#555] focus:ring-1 focus:ring-yellow-400 focus:outline-none resize-none font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-2 pb-8 mt-auto shrink-0 space-y-3">
                    <div className="flex items-center justify-between text-xs px-1 mb-1">
                        <span className="text-[#666] font-medium">Total Price</span>
                        <span className="text-lg font-black text-white">
                            {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(product.price)}
                        </span>
                    </div>

                    <Button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className="w-full h-12 rounded-xl bg-yellow-400 text-black font-bold text-sm hover:bg-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.1)] disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                        Confirm Booking
                    </Button>
                    {!isValid && (
                        <p className="text-xs text-[#666] text-center font-medium">
                            {getDisabledReason()}
                        </p>
                    )}
                    <Button variant="ghost" onClick={onClose} className="w-full h-10 rounded-xl text-xs font-bold text-[#666] hover:text-white">
                        Cancel
                    </Button>
                </div>
            </DialogContent>

            <Dialog open={isChangingLocation} onOpenChange={setIsChangingLocation}>
                <DialogContent className="flex flex-col w-[95vw] max-w-[450px] max-h-[90dvh] gap-0 p-0 overflow-hidden rounded-[32px] border border-white/5 shadow-2xl bg-[#0a0a0a] text-white z-[60]">
                    <DialogHeader className="p-6 pb-2 shrink-0 space-y-4 pt-8">
                        <div className="mx-auto w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                            <MapPin className="h-6 w-6 text-yellow-400" />
                        </div>
                        <div className="space-y-1 text-center">
                            <DialogTitle className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Update My Location</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-[#666]">
                                This location will be saved to your profile.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
                        <LocationPicker
                            initialAddress={buyerLocation?.address}
                            initialCoordinates={hasPreciseLocation(buyerLocation) ? { lat: buyerLocation.lat, lng: buyerLocation.lng } : null}
                            onLocationChange={handleLocationPickerChange}
                            label="Search Address"
                            autoPopulate={false}
                            initialValue={buyerLocation?.address || ''}
                            mapClassName="h-44 sm:h-56"
                        />
                    </div>

                    <DialogFooter className="p-6 pt-2 pb-8 mt-auto shrink-0 flex flex-col gap-3">
                        <Button
                            onClick={saveLocationToProfile}
                            disabled={isUpdatingProfile || !buyerLocation?.address}
                            className="w-full h-12 rounded-xl bg-yellow-400 text-black font-bold text-sm hover:bg-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.1)] disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save & Use Location
                        </Button>
                        <Button variant="ghost" onClick={() => setIsChangingLocation(false)} className="w-full h-10 rounded-xl text-xs font-bold text-[#666] hover:text-white">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}


