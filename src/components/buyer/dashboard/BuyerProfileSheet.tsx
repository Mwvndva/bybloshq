import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LogOut } from 'lucide-react';
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
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto bg-black text-white border-l border-white/15 shadow-2xl shadow-black/70">
        <SheetHeader className="text-left">
          <SheetTitle className="text-white">Buyer Profile</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Full Name</div>
            <div className="mt-1 text-base font-semibold text-white">{user?.fullName || 'Not set'}</div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/60">Email Address</div>
            <div className="mt-1 text-sm font-semibold text-white break-words">{user?.email || 'Not set'}</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">City</div>
                <div className="mt-1 text-sm font-semibold text-white">{user?.city || 'Not set'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Area</div>
                <div className="mt-1 text-sm font-semibold text-white">{user?.location || 'Not set'}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Mobile Payment</div>
                <div className="mt-1 text-sm font-semibold text-white">{user?.mobilePayment || 'Not set'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">WhatsApp</div>
                <div className="mt-1 text-sm font-semibold text-white">{user?.whatsappNumber || 'Not set'}</div>
              </div>
            </div>
          </div>

          <button
            onClick={onToggleEdit}
            className="h-10 rounded-xl border border-white/15 bg-white/10 text-sm font-semibold text-white hover:bg-white/15"
          >
            {isEditingProfile ? 'Cancel Editing' : 'Edit Profile'}
          </button>

          {isEditingProfile && (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 shadow-sm space-y-3">
              <Input value={fullName} onChange={event => onFullNameChange(event.target.value)} placeholder="Full Name" className="bg-black border border-white/15 text-white h-10" />
              <Select value={city} onValueChange={(value) => {
                onCityChange(value);
                onLocationAreaChange('');
              }}>
                <SelectTrigger className="bg-black border border-white/15 text-white h-10">
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(locationData).map(cityName => <SelectItem key={cityName} value={cityName}>{cityName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={locationArea} onValueChange={onLocationAreaChange} disabled={!city}>
                <SelectTrigger className="bg-black border border-white/15 text-white h-10">
                  <SelectValue placeholder="Select Area" />
                </SelectTrigger>
                <SelectContent>
                  {(locationData[city] || []).map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={mobilePayment} onChange={event => onMobilePaymentChange(event.target.value)} placeholder="Mobile Payment Number" className="bg-black border border-white/15 text-white h-10" />
              <Input value={whatsappNumber} onChange={event => onWhatsappNumberChange(event.target.value)} placeholder="WhatsApp Number" className="bg-black border border-white/15 text-white h-10" />
              <Button onClick={onSaveProfile} disabled={isSavingProfile} className="w-full bg-[#F5C518] text-black h-10 font-bold">
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          )}

          <RefundCard refundAmount={refundAmount} />

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
