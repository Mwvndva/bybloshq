import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Edit3, LogOut, Mail, MapPin, MessageCircle, Phone, UserRound, WalletCards } from 'lucide-react';
import RefundCard from '../RefundCard';
import { BuyerMembershipCard } from './BuyerMembershipCard';
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton';
import { deleteBuyerAccount } from '@/features/buyer/api/profile';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { ThemeSegmentedPill } from '@/shared/ui/ThemeSegmentedPill';

interface BuyerProfileSheetProps {
  isEditingProfile: boolean;
  isOpen: boolean;
  isSavingProfile: boolean;
  mobilePayment: string;
  refundAmount: number;
  user: import("@/features/auth/types/authTypes").UserProfile | null;
  whatsappNumber: string;
  onLogout: () => void;
  onMobilePaymentChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSaveProfile: () => void;
  onToggleEdit: () => void;
  onWhatsappNumberChange: (value: string) => void;
}

function displayValue(value?: string | null) {
  return value?.trim() || 'Not set';
}

function BuyerThemePillPicker() {
  const { theme, setTheme } = useThemeScope('buyer');

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60">
        Theme
      </span>
      <ThemeSegmentedPill value={theme} onChange={setTheme} className="flex w-full [&>button]:flex-1" />
    </div>
  );
}

/**
 * One account field. Read-only fields render their saved value; the editable
 * contact numbers swap the value for an inline input in edit mode — no separate
 * "edit" form to keep in sync.
 */
function ProfileDetail({
  icon: Icon,
  label,
  value,
  editable,
  editing,
  placeholder,
  onChange
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  editable?: boolean;
  editing?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  const isInput = Boolean(editable && editing);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] p-3 transition-colors">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-white/70">
        <Icon className="h-3.5 w-3.5 text-[#F5C518]" />
        {label}
      </div>
      {isInput ? (
        <Input
          value={value ?? ''}
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder}
          inputMode="tel"
          autoComplete="tel"
          className="mt-2 h-9 border border-slate-300 dark:border-white/10 bg-white dark:bg-[#141414] text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus-visible:ring-[#F5C518]"
        />
      ) : (
        <div className="mt-2 break-words text-sm font-bold leading-5 text-slate-950 dark:text-white">
          {displayValue(value)}
        </div>
      )}
    </div>
  );
}

export function BuyerProfileContent({
  isEditingProfile,
  isSavingProfile,
  mobilePayment,
  refundAmount,
  user,
  whatsappNumber,
  onLogout,
  onMobilePaymentChange,
  onSaveProfile,
  onToggleEdit,
  onWhatsappNumberChange
}: Omit<BuyerProfileSheetProps, 'isOpen' | 'onOpenChange'>) {
  const buyerUser = user as import("@/features/auth/types/authTypes").BuyerProfile | null;

  return (
    <div className="w-full space-y-4">
      {/* App Theme Picker Pill - Positioned Above Account Details */}
      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 shadow-sm">
        <BuyerThemePillPicker />
      </section>

      {/* Account Details Section */}
      <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">Account Details</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-white/80">
              {isEditingProfile ? 'Update your payment and WhatsApp numbers.' : 'Your saved buyer information.'}
            </p>
          </div>
          <Button
            type="button"
            onClick={onToggleEdit}
            variant="outline"
            className="h-9 shrink-0 gap-2 border-slate-300 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
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
            <ProfileDetail
              icon={Phone}
              label="Mobile payment"
              value={mobilePayment}
              editable
              editing={isEditingProfile}
              placeholder="Mobile payment number"
              onChange={onMobilePaymentChange}
            />
            <ProfileDetail
              icon={MessageCircle}
              label="WhatsApp"
              value={whatsappNumber}
              editable
              editing={isEditingProfile}
              placeholder="WhatsApp number"
              onChange={onWhatsappNumberChange}
            />
          </div>
        </div>

        {isEditingProfile && (
          <Button
            onClick={onSaveProfile}
            disabled={isSavingProfile}
            className="h-10 w-full bg-[#F5C518] font-bold text-black hover:bg-yellow-300"
          >
            {isSavingProfile ? 'Saving...' : 'Save changes'}
          </Button>
        )}
      </section>

      <BuyerMembershipCard />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <WalletCards className="h-4 w-4 text-[#F5C518]" />
          <h3 className="text-sm font-bold text-slate-950 dark:text-white">Refunds</h3>
        </div>
        <RefundCard refundAmount={refundAmount} compact />
      </section>

      <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black p-4">
        <Button
          onClick={onLogout}
          className="h-10 w-full justify-center gap-2 bg-red-600 font-bold text-white hover:bg-red-500"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
        <DeleteAccountButton deleteAccount={deleteBuyerAccount} onDeleted={onLogout} />
      </div>
    </div>
  );
}

export function BuyerProfileSheet(props: BuyerProfileSheetProps) {
  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="right"
        className="z-[100] flex h-dvh w-full max-w-none transform-gpu flex-col overflow-hidden border-l border-slate-200 dark:border-white/10 bg-white dark:bg-black p-0 text-slate-950 dark:text-white shadow-2xl shadow-black/60 will-change-transform sm:max-w-[430px]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] px-5 py-4 text-left">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-950 dark:text-white">Buyer Profile</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">
              Account settings, theme, and refunds
            </p>
          </div>
          <button
            type="button"
            onClick={() => props.onOpenChange(false)}
            className="rounded-full p-2 text-slate-500 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close profile sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-5">
          <BuyerProfileContent {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
