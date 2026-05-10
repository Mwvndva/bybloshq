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
  user: any;
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

const fieldClassName = 'h-10 border border-white/15 bg-black text-white placeholder:text-white/45 focus-visible:ring-[#F5C518]';

function displayValue(value?: string | null) {
  return value?.trim() || 'Not set';
}

function ProfileDetail({
  icon: Icon,
  label,
  value
}: {
  icon: any;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">
        <Icon className="h-3.5 w-3.5 text-[#F5C518]" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold leading-5 text-white">
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
  const profileInitial = displayValue(user?.fullName || user?.email).slice(0, 1).toUpperCase();

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-dvh w-full max-w-none flex-col overflow-hidden border-l border-white/15 bg-black p-0 text-white shadow-2xl shadow-black/70 sm:max-w-[430px]"
      >
        <SheetHeader className="border-b border-white/10 bg-[#050505] px-5 py-5 pr-14 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#F5C518]/35 bg-[#F5C518] text-base font-black text-black">
              {profileInitial}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-semibold text-white">Buyer Profile</SheetTitle>
              <SheetDescription className="mt-1 text-xs text-white/65">
                Profile details, refund balance, and account actions.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          <section className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Account Details</h3>
                <p className="mt-1 text-xs text-white/55">Your saved buyer information.</p>
              </div>
              <Button
                type="button"
                onClick={onToggleEdit}
                variant="outline"
                className="h-9 shrink-0 gap-2 border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            <div className="grid gap-3">
              <ProfileDetail icon={UserRound} label="Full name" value={user?.fullName} />
              <ProfileDetail icon={Mail} label="Email address" value={user?.email} />
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileDetail icon={MapPin} label="City" value={user?.city} />
                <ProfileDetail icon={MapPin} label="Area" value={user?.location} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileDetail icon={Phone} label="Mobile payment" value={user?.mobilePayment} />
                <ProfileDetail icon={MessageCircle} label="WhatsApp" value={user?.whatsappNumber} />
              </div>
            </div>
          </section>

          {isEditingProfile && (
            <section className="mt-4 space-y-3 rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">Edit Details</h3>
              <Input value={fullName} onChange={event => onFullNameChange(event.target.value)} placeholder="Full Name" className={fieldClassName} />
              <Select value={city} onValueChange={(value) => {
                onCityChange(value);
                onLocationAreaChange('');
              }}>
                <SelectTrigger className={fieldClassName}>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent className="border-white/15 bg-black text-white">
                  {Object.keys(locationData).map(cityName => <SelectItem key={cityName} value={cityName}>{cityName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={locationArea} onValueChange={onLocationAreaChange} disabled={!city}>
                <SelectTrigger className={fieldClassName}>
                  <SelectValue placeholder="Select Area" />
                </SelectTrigger>
                <SelectContent className="border-white/15 bg-black text-white">
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
              <h3 className="text-sm font-semibold text-white">Refunds</h3>
            </div>
            <RefundCard refundAmount={refundAmount} compact />
          </section>
        </div>

        <div className="border-t border-white/10 bg-[#050505] p-4">
          <Button
            onClick={onLogout}
            variant="outline"
            className="h-10 w-full justify-center gap-2 border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/15"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
