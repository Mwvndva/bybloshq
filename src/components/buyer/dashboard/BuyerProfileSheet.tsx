import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Edit3, LogOut, Mail, MapPin, MessageCircle, Phone, UserRound, WalletCards, Monitor, Moon, Sun } from 'lucide-react';
import RefundCard from '../RefundCard';
import { BuyerMembershipCard } from './BuyerMembershipCard';
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton';
import { deleteBuyerAccount } from '@/api/buyer/profile';
import { useAppTheme, type AppTheme } from '@/hooks/useAppTheme';

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
  const { theme, setTheme } = useAppTheme();

  const OPTIONS: { value: AppTheme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'system', label: 'System', Icon: Monitor },
    { value: 'light',  label: 'Light',  Icon: Sun },
    { value: 'dark',   label: 'Dark',   Icon: Moon },
  ];

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60">
        Theme
      </span>
      <div className="flex items-center rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-200/60 dark:bg-white/[0.06] p-1 gap-1">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              id={`buyer-theme-${value}`}
              onClick={() => setTheme(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition-all duration-200 ${
                active
                  ? 'bg-yellow-400 text-black shadow-md font-extrabold'
                  : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-white/10'
              }`}
              aria-pressed={active}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-black' : 'text-slate-500 dark:text-white/60'}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
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

export function BuyerProfileSheet({
  isEditingProfile,
  isOpen,
  isSavingProfile,
  mobilePayment,
  refundAmount,
  user,
  whatsappNumber,
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
        className="flex h-dvh w-full max-w-none transform-gpu flex-col overflow-hidden border-l border-slate-200 dark:border-white/10 bg-white dark:bg-black p-0 text-slate-950 dark:text-white shadow-2xl shadow-black/40 will-change-transform data-[state=closed]:duration-200 data-[state=open]:duration-200 sm:max-w-[430px]"
      >
        <SheetHeader className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] px-5 py-5 pr-14 text-left">
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg font-bold text-slate-950 dark:text-white">Buyer Profile</SheetTitle>
            <SheetDescription className="mt-1 text-xs text-slate-600 dark:text-white/80">
              Profile details, refund balance, theme settings, and account actions.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5 space-y-4">
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
        </div>

        <div className="space-y-2 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black p-4">
          <Button
            onClick={onLogout}
            className="h-10 w-full justify-center gap-2 bg-red-600 font-bold text-white hover:bg-red-500"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
          <DeleteAccountButton deleteAccount={deleteBuyerAccount} onDeleted={onLogout} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
