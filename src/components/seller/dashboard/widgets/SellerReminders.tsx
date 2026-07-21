import { useMemo, useState } from 'react';
import { ArrowRight, PackagePlus, Sparkles, UserRoundPen, X } from 'lucide-react';
import type { SellerProfile } from '@/features/auth/types/authTypes';
import type { SellerTabId } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Only nudge once a seller has had a reasonable chance to set things up. */
function isOlderThan24h(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created >= DAY_MS;
}

function dismissKey(sellerId: string | number | undefined, reminder: string): string {
  return `seller_reminder_dismissed:${sellerId ?? 'anon'}:${reminder}`;
}

interface ReminderCardProps {
  icon: typeof PackagePlus;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  onDismiss: () => void;
}

function ReminderCard({ icon: Icon, title, description, ctaLabel, onCta, onDismiss }: ReminderCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Do not show this again"
        title="Do not show this again"
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.16)' }}
        >
          <Icon className="h-5 w-5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white sm:text-base">{title}</p>
          <p className="mt-1 text-xs leading-5 text-white/60 sm:text-sm">{description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCta}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black shadow-[0_10px_24px_rgba(0,0,0,0.4)] transition-transform active:scale-95 sm:text-sm"
              style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
            >
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-[11px] font-semibold text-white/40 underline-offset-2 transition-colors hover:text-white/70 hover:underline"
            >
              Do not show this again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SellerRemindersProps {
  sellerProfile?: SellerProfile | null;
  totalProducts: number;
  onSelectTab: (tab: SellerTabId) => void;
}

/**
 * Gentle onboarding nudges for sellers: one to finish the business profile
 * (photo / banner / bio) and one to add their first product. They only appear
 * ~24h after signup — enough time to set up without nagging on day one — and
 * each carries a "Do not show this again" action persisted per seller.
 */
export function SellerReminders({ sellerProfile, totalProducts, onSelectTab }: SellerRemindersProps) {
  const sellerId = sellerProfile?.id;

  const [dismissed, setDismissed] = useState<Record<string, boolean>>(() => ({
    profile: localStorage.getItem(dismissKey(sellerId, 'profile')) === '1',
    products: localStorage.getItem(dismissKey(sellerId, 'products')) === '1',
  }));

  const dismiss = (reminder: 'profile' | 'products') => {
    localStorage.setItem(dismissKey(sellerId, reminder), '1');
    setDismissed((prev) => ({ ...prev, [reminder]: true }));
  };

  const { showProfile, missingLabel, showProducts } = useMemo(() => {
    const eligible = isOlderThan24h(sellerProfile?.createdAt);
    const missing: string[] = [];
    if (!sellerProfile?.avatarUrl) missing.push('business photo');
    if (!sellerProfile?.bannerImage) missing.push('banner');
    if (!sellerProfile?.bio?.trim()) missing.push('bio');

    const label =
      missing.length === 0
        ? ''
        : missing.length === 1
          ? `Add your ${missing[0]}.`
          : `Add your ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}.`;

    return {
      showProfile: eligible && missing.length > 0 && !dismissed.profile,
      missingLabel: label,
      showProducts: eligible && totalProducts <= 0 && !dismissed.products,
    };
  }, [sellerProfile?.createdAt, sellerProfile?.avatarUrl, sellerProfile?.bannerImage, sellerProfile?.bio, totalProducts, dismissed]);

  if (!showProfile && !showProducts) return null;

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {showProfile && (
        <ReminderCard
          icon={UserRoundPen}
          title="Finish your business profile"
          description={`${missingLabel} A complete profile builds trust and gets you more followers.`}
          ctaLabel="Complete profile"
          onCta={() => onSelectTab('settings')}
          onDismiss={() => dismiss('profile')}
        />
      )}
      {showProducts && (
        <ReminderCard
          icon={totalProducts <= 0 ? PackagePlus : Sparkles}
          title="Add your first product"
          description="Your shop is live but empty — add a product so buyers have something to discover and click."
          ctaLabel="Add a product"
          onCta={() => onSelectTab('products')}
          onDismiss={() => dismiss('products')}
        />
      )}
    </div>
  );
}
