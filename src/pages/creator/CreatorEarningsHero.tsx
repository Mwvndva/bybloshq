import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronRight, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from './creatorDashboardUtils';

interface CreatorEarningsHeroProps {
  firstName?: string;
  totalEarnings: number;
  balance: number;
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
 * The ambassador dashboard's hero — the thesis of the page: "your links are
 * earning." It pairs the proof (earnings to date + this-period momentum) with
 * the tool to grow (the shareable link + a prominent Share action), and offers a
 * one-tap pointer to cash out. This is the single bold element; every other
 * section on the page stays quiet.
 */
export function CreatorEarningsHero({
  firstName,
  totalEarnings,
  balance,
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

  return (
    <section className="relative overflow-hidden rounded-3xl border border-yellow-400/30 bg-slate-50 dark:bg-[#0a0a0a] p-5 shadow-sm transition-colors duration-200 sm:p-6">
      {/* Ambient gold glow — the one flourish, kept subtle. */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-yellow-400/10 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-600 dark:text-yellow-300">
          Creator · {name}
        </p>

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
              {name}, your links are ready to earn
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-white/50">
              Share your link to make your first KSh 3.
            </p>
          </div>
        )}

        {(monthClicks > 0 || monthSales > 0) && (
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-white/50">
            {monthClicks.toLocaleString()} clicks · {monthSales.toLocaleString()} sales this month
          </p>
        )}

        {/* The signature element: the link, right next to what it has earned. */}
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 break-all text-xs font-bold text-yellow-700 dark:text-yellow-100 sm:text-sm" title={referralLink}>
            {referralLink}
          </p>
          <Button
            type="button"
            onClick={onCopyLink}
            className="h-10 shrink-0 bg-yellow-400 font-black text-black hover:bg-yellow-300"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share link
          </Button>
        </div>

        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-white/50">
          Earn KSh 3 on every product your sellers sell — no time limit.
        </p>

        <button
          type="button"
          onClick={onGoToWithdraw}
          className="mt-3 inline-flex items-center gap-1 rounded-lg text-sm font-bold text-slate-700 transition-colors hover:text-slate-950 dark:text-white/70 dark:hover:text-white"
        >
          Balance {money(balance)} ready
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
