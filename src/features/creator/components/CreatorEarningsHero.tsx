import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronRight, Clock, Share2, Store, Infinity, HelpCircle, ChevronDown, ChevronUp, Sparkles, UserPlus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { money, formatSettlementDate } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorEarningsHeroProps {
  firstName?: string;
  totalEarnings: number;
  balance: number;
  availableBalance?: number;
  clearingBalance?: number;
  nextAvailableAt?: string | null;
  isClearing?: boolean;
  monthEarnings: number;
  monthSales: number;
  monthClicks: number;
  referralLink: string;
  onCopyLink: () => void;
  onGoToWithdraw: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Count up to `target` on mount; snaps straight to it when reduced motion is on. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

/**
 * The creator dashboard's hero — pairs overall creator earnings proof with
 * the permanent "Add a Seller" lifetime referral engine and cash-out quick link.
 */
export function CreatorEarningsHero({
  firstName,
  totalEarnings,
  balance,
  availableBalance,
  clearingBalance,
  nextAvailableAt,
  isClearing,
  monthEarnings,
  monthSales,
  monthClicks,
  referralLink,
  onCopyLink,
  onGoToWithdraw,
}: CreatorEarningsHeroProps) {
  const animatedEarnings = useCountUp(totalEarnings);
  const hasEarnings = totalEarnings > 0;
  const name = firstName || 'Creator';
  const [showExplain, setShowExplain] = useState(true);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-yellow-400/30 bg-slate-50 dark:bg-[#0a0a0a] p-5 shadow-sm transition-colors duration-200 sm:p-6">
      {/* Ambient gold glow */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-yellow-400/10 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-600 dark:text-yellow-300">
            Creator · {name}
          </p>

          <button
            type="button"
            onClick={onGoToWithdraw}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg text-xs sm:text-sm font-bold text-slate-700 transition-colors hover:text-slate-950 dark:text-white/70 dark:hover:text-white"
          >
            {isClearing && (availableBalance ?? 0) === 0 ? (
              <>
                <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                <span>
                  Clearing {money(clearingBalance ?? 0)} · Available {nextAvailableAt ? formatSettlementDate(nextAvailableAt) : 'soon'}
                </span>
              </>
            ) : isClearing && (availableBalance ?? 0) > 0 ? (
              <>
                <span>Available {money(availableBalance ?? 0)} ready</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-white/40">
                  ({money(clearingBalance ?? 0)} clearing)
                </span>
              </>
            ) : (
              <span>Balance {money(balance)} ready</span>
            )}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {hasEarnings ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              You&apos;ve earned{' '}
              <span className="text-yellow-600 dark:text-yellow-300 tabular-nums">
                KSh {Math.round(animatedEarnings).toLocaleString()}
              </span>{' '}
              so far
            </h1>
            {monthEarnings > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                <ArrowUpRight className="h-3.5 w-3.5" />
                +{money(monthEarnings)} this month
              </span>
            )}
          </div>
        ) : (
          <div className="mt-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {name}, your creator earnings hub
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-white/50">
              Grow your income by inviting sellers and collaborating with registered shops.
            </p>
          </div>
        )}

        {(monthClicks > 0 || monthSales > 0) && (
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-white/50">
            {monthClicks.toLocaleString()} clicks · {monthSales.toLocaleString()} sales this month
          </p>
        )}

        {/* ── Add a Seller · Lifetime Referral Program ── */}
        <div className="mt-5 rounded-2xl border border-yellow-400/35 bg-white/90 dark:bg-white/[0.03] p-4 sm:p-5 shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 border border-yellow-400/30">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Add a Seller · Lifetime Referral Link
                  </h2>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 uppercase tracking-wide">
                    KSh 3 Per Sale
                  </span>
                  <span className="rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-700 dark:text-yellow-300 text-[10px] font-black px-2 py-0.5 uppercase tracking-wide flex items-center gap-1">
                    <Infinity className="h-3 w-3" />
                    Lifetime
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                  Earn passive royalties whenever a store you refer makes a sale. Share this link with vendors, boutique owners, and entrepreneurs.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowExplain(!showExplain)}
              className="self-start sm:self-auto flex items-center gap-1 text-xs font-bold text-yellow-700 hover:text-yellow-800 dark:text-yellow-300 dark:hover:text-yellow-200 transition-colors shrink-0"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>{showExplain ? 'Hide how it works' : 'How does this work?'}</span>
              {showExplain ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Referral Link Copy Bar */}
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-2 pl-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-all text-xs font-bold text-yellow-800 dark:text-yellow-100 sm:text-sm font-mono" title={referralLink}>
              {referralLink}
            </p>
            <Button
              type="button"
              onClick={onCopyLink}
              className="h-9 shrink-0 bg-yellow-400 font-black text-black hover:bg-yellow-300 text-xs px-4 shadow-sm"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Copy seller invite link
            </Button>
          </div>

          {/* Explanatory Breakdown: How it works & Difference from Shop Collaborations */}
          {showExplain && (
            <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-white/10 space-y-4 animate-in fade-in duration-200 text-xs">
              {/* 3 Steps to Lifetime Royalties */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 p-3">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white mb-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 font-bold text-[9px] text-black">1</span>
                    Share with Store Owners
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-white/50 leading-relaxed">
                    Send this link to business owners, wholesalers, or creatives who want to sell online.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 p-3">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white mb-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 font-bold text-[9px] text-black">2</span>
                    Permanent Attribution
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-white/50 leading-relaxed">
                    When they open a shop with your code, they are permanently linked to your creator profile forever.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 p-3">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white mb-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 font-bold text-[9px] text-white">3</span>
                    Earn KSh 3 on Every Sale
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-white/50 leading-relaxed">
                    Every product they ever sell pays you KSh 3 with no time limit. Truly recurring passive royalties.
                  </p>
                </div>
              </div>

              {/* Comparison: Add a Seller vs Shop Collaboration */}
              <div className="rounded-xl border border-yellow-400/25 bg-yellow-400/5 p-3.5 space-y-2">
                <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                  Understanding the Difference: 2 Ways to Earn as a Creator
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-[11px]">
                  <div className="rounded-lg bg-white/70 dark:bg-black/40 p-3 border border-yellow-400/20">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Store className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                      <span className="font-black text-yellow-700 dark:text-yellow-300">
                        Method 1: Add a Seller (This Section)
                      </span>
                    </div>
                    <ul className="space-y-1 text-slate-600 dark:text-white/60 text-[11px] leading-relaxed">
                      <li>• <strong>Audience:</strong> Merchants & shop owners looking to sell.</li>
                      <li>• <strong>You earn:</strong> Fixed <strong>KSh 3 on every product</strong> they sell.</li>
                      <li>• <strong>Duration:</strong> <strong>Lifetime</strong> (No time limit / forever).</li>
                      <li>• <strong>Effort:</strong> You refer the merchant once; you do NOT need to promote their individual items.</li>
                    </ul>
                  </div>

                  <div className="rounded-lg bg-white/70 dark:bg-black/40 p-3 border border-yellow-400/20">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        Method 2: Shop Collaborations (Marketplace Below)
                      </span>
                    </div>
                    <ul className="space-y-1 text-slate-600 dark:text-white/60 text-[11px] leading-relaxed">
                      <li>• <strong>Audience:</strong> Shoppers and your social media followers.</li>
                      <li>• <strong>You earn:</strong> Percentage commission (e.g. <strong>5% – 20% per sale</strong>).</li>
                      <li>• <strong>Duration:</strong> Per approved shop collaboration.</li>
                      <li>• <strong>Effort:</strong> You share tracking links to product storefronts and earn when buyers complete orders.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
