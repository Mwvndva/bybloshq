import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Edit3, LogOut, Mail, MapPin, MessageCircle, Phone, UserRound, WalletCards } from 'lucide-react';
import RefundCard from '../RefundCard';

interface BuyerProfileSheetProps {
  city: string;
  fullName: string;
  isEditingProfile: boolean;
  isOpen: boolean;
  isSavingProfile: boolean;
  locationArea: string;
  locationData: Record<string, string[]>;
  mobilePayment: string;
  refundAmount: number;
  user: import("@/features/auth/types/authTypes").UserProfile | null;
  whatsappNumber: string;
  onCityChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onLocationAreaChange: (value: string) => void;
  onLogout: () => void;
  onMobilePaymentChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSaveProfile: () => void;
  onToggleEdit: () => void;
  onWhatsappNumberChange: (value: string) => void;
}

const fieldClassName = 'h-10 border border-stone-300 bg-white text-stone-950 placeholder:text-stone-400 focus-visible:ring-[#F5C518]';

function displayValue(value?: string | null) {
  return value?.trim() || 'Not set';
}

function ProfileDetail({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        <Icon className="h-3.5 w-3.5 text-[#F5C518]" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold leading-5 text-stone-950">
        {displayValue(value)}
      </div>
    </div>
  );
}

export function BuyerProfileSheet({
  city,
  fullName,
  isEditingProfile,
  isOpen,
  isSavingProfile,
  locationArea,
  locationData,
  mobilePayment,
  refundAmount,
  user,
  whatsappNumber,
  onCityChange,
  onFullNameChange,
  onLocationAreaChange,
  onLogout,
  onMobilePaymentChange,
  onOpenChange,
  onSaveProfile,
  onToggleEdit,
  onWhatsappNumberChange
}: BuyerProfileSheetProps) {
  const buyerUser = user as import("@/features/auth/types/authTypes").BuyerProfile | null;
  const profileInitial = displayValue(buyerUser?.fullName || buyerUser?.email).slice(0, 1).toUpperCase();

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-dvh w-full max-w-none transform-gpu flex-col overflow-hidden border-l border-stone-200 bg-[#f8f7f2] p-0 text-stone-950 shadow-2xl shadow-black/10 will-change-transform data-[state=closed]:duration-200 data-[state=open]:duration-200 sm:max-w-[430px]"
      >
        <SheetHeader className="border-b border-stone-200 bg-white px-5 py-5 pr-14 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#F5C518]/35 bg-[#F5C518] text-base font-black text-black">
              {profileInitial}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-semibold text-stone-950">Buyer Profile</SheetTitle>
              <SheetDescription className="mt-1 text-xs text-stone-500">
                Profile details, refund balance, and account actions.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-950">Account Details</h3>
                <p className="mt-1 text-xs text-stone-500">Your saved buyer information.</p>
              </div>
              <Button
                type="button"
                onClick={onToggleEdit}
                variant="outline"
                className="h-9 shrink-0 gap-2 border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            <div className="grid gap-3">
              <ProfileDetail icon={UserRound} label="Full name" value={buyerUser?.fullName} />
              <ProfileDetail icon={Mail} label="Email address" value={buyerUser?.email} />
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileDetail icon={MapPin} label="City" value={buyerUser?.city} />
                <ProfileDetail icon={MapPin} label="Area" value={buyerUser?.location} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileDetail icon={Phone} label="Mobile payment" value={buyerUser?.mobilePayment} />
                <ProfileDetail icon={MessageCircle} label="WhatsApp" value={buyerUser?.whatsappNumber} />
              </div>
            </div>
          </section>

          {isEditingProfile && (
            <section className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-stone-950">Edit Details</h3>
              <Input value={fullName} onChange={event => onFullNameChange(event.target.value)} placeholder="Full Name" className={fieldClassName} />
              <Select value={city} onValueChange={(value) => {
                onCityChange(value);
                onLocationAreaChange('');
              }}>
                <SelectTrigger className={fieldClassName}>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent className="border-stone-200 bg-white text-stone-950">
                  {Object.keys(locationData).map(cityName => <SelectItem key={cityName} value={cityName}>{cityName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={locationArea} onValueChange={onLocationAreaChange} disabled={!city}>
                <SelectTrigger className={fieldClassName}>
                  <SelectValue placeholder="Select Area" />
                </SelectTrigger>
                <SelectContent className="border-stone-200 bg-white text-stone-950">
                  {(locationData[city] || []).map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={mobilePayment} onChange={event => onMobilePaymentChange(event.target.value)} placeholder="Mobile Payment Number" className={fieldClassName} />
              <Input value={whatsappNumber} onChange={event => onWhatsappNumberChange(event.target.value)} placeholder="WhatsApp Number" className={fieldClassName} />
              <Button onClick={onSaveProfile} disabled={isSavingProfile} className="w-full bg-[#F5C518] text-black h-10 font-bold">
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </Button>
            </section>
          )}

          <section className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-[#F5C518]" />
              <h3 className="text-sm font-semibold text-stone-950">Refunds</h3>
            </div>
            <RefundCard refundAmount={refundAmount} compact />
          </section>
        </div>

        <div className="border-t border-stone-200 bg-white p-4">
          <Button
            onClick={onLogout}
            variant="outline"
            className="h-10 w-full justify-center gap-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}


