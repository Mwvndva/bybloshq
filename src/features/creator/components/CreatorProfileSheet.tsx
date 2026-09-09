import { useEffect, useRef, useState } from 'react';
import { LogOut, Mail, MessageCircle, Phone, UserRound, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ThemeSegmentedPill } from '@/shared/ui/ThemeSegmentedPill';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import { CreatorSocialProfiles } from '@/features/creator/components/CreatorSocialProfiles';
import { CreatorWithdrawalPanel } from '@/features/creator/components/CreatorWithdrawalPanel';
import { useUpdateCreatorProfileMutation } from '@/features/creator/hooks/mutations/useUpdateCreatorProfileMutation';
import { LegalLinks } from '@/shared/components/LegalLinks';
import type { CreatorProfile, CreatorClearance, WithdrawalRow } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: CreatorProfile;
  clearance?: CreatorClearance;
  withdrawals: WithdrawalRow[];
  onLogout: () => void;
  focusWithdrawals?: boolean;
}

function ReadOnlyDetail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] p-3">
      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-white/70">
        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-yellow-500" />{label}</span>
        <span className="flex items-center gap-1 text-slate-400 dark:text-white/40 normal-case font-semibold"><Lock className="h-3 w-3" />Read-only</span>
      </div>
      <div className="mt-2 break-words text-sm font-bold leading-5 text-slate-950 dark:text-white">{value?.trim() || 'Not set'}</div>
    </div>
  );
}

export function CreatorProfileSheet({ open, onOpenChange, creator, clearance, withdrawals, onLogout, focusWithdrawals }: CreatorProfileSheetProps) {
  const { theme, setTheme } = useThemeScope('creator');
  const updateMutation = useUpdateCreatorProfileMutation();
  const withdrawRef = useRef<HTMLDivElement>(null);

  const [mpesa, setMpesa] = useState(creator.mpesaNumber || '');
  const [whatsapp, setWhatsapp] = useState(creator.whatsappNumber || '');

  useEffect(() => {
    setMpesa(creator.mpesaNumber || '');
    setWhatsapp(creator.whatsappNumber || '');
  }, [creator.mpesaNumber, creator.whatsappNumber]);

  useEffect(() => {
    if (open && focusWithdrawals) {
      const id = setTimeout(() => withdrawRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220);
      return () => clearTimeout(id);
    }
  }, [open, focusWithdrawals]);

  const contactChanged =
    (mpesa.trim() || '') !== (creator.mpesaNumber || '') ||
    (whatsapp.trim() || '') !== (creator.whatsappNumber || '');

  const fullName = [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim();

  const handleSaveContact = async () => {
    try {
      await updateMutation.mutateAsync({
        mpesaNumber: mpesa.trim() || undefined,
        whatsappNumber: whatsapp.trim() || null
      });
      toast.success('Details saved.');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Could not save your details.');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] text-slate-950 dark:text-white p-0"
      >
        <SheetHeader className="px-4 pt-6 pb-2 text-left">
          <SheetTitle className="text-slate-950 dark:text-white">Profile</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          {/* Theme */}
          <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60">Theme</span>
            <ThemeSegmentedPill value={theme} onChange={setTheme} className="mt-2 flex w-full [&>button]:flex-1" />
          </section>

          {/* Personal details */}
          <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-4">
            <h3 className="text-sm font-black text-slate-950 dark:text-white">Personal details</h3>
            <ReadOnlyDetail icon={UserRound} label="Full name" value={fullName} />
            <ReadOnlyDetail icon={Mail} label="Email" value={creator.email} />

            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3">
              <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-white/70">
                <Phone className="h-3.5 w-3.5 text-yellow-500" />M-Pesa number
              </label>
              <Input
                value={mpesa}
                onChange={(e) => setMpesa(e.target.value)}
                placeholder="0712345678"
                inputMode="tel"
                className="mt-2 h-9 border border-slate-300 dark:border-white/10 bg-white dark:bg-[#141414] text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
              />
              <p className="mt-1 text-[10px] text-slate-400 dark:text-white/40">Where your withdrawals are paid.</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3">
              <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-white/70">
                <MessageCircle className="h-3.5 w-3.5 text-yellow-500" />WhatsApp number
              </label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="0712345678"
                inputMode="tel"
                className="mt-2 h-9 border border-slate-300 dark:border-white/10 bg-white dark:bg-[#141414] text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
              />
            </div>

            <Button
              type="button"
              onClick={handleSaveContact}
              disabled={!contactChanged || updateMutation.isPending}
              className="h-9 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {updateMutation.isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</> : 'Save details'}
            </Button>
          </section>

          {/* Social media */}
          <CreatorSocialProfiles profile={creator} />

          {/* Withdrawals */}
          <div ref={withdrawRef} className="scroll-mt-4">
            <CreatorWithdrawalPanel creator={creator} clearance={clearance} withdrawals={withdrawals} />
          </div>

          {/* Legal */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">Legal</h3>
            <LegalLinks />
          </section>

          {/* Logout */}
          <Button
            type="button"
            variant="outline"
            onClick={onLogout}
            className="h-10 w-full border-slate-300 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-bold"
          >
            <LogOut className="mr-2 h-4 w-4" />Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
