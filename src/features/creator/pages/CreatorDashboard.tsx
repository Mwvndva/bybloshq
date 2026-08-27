import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, Trophy, Wallet } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { toast } from 'sonner';
import { useCreatorDashboardQuery } from '@/features/creator/hooks/queries/useCreatorDashboardQuery';
import { useCreatorReferralDashboardQuery } from '@/features/creator/hooks/queries/useCreatorReferralDashboardQuery';
import { useAcceptShopRequestMutation } from '@/features/creator/hooks/mutations/useAcceptShopRequestMutation';
import { useCreatorWithdrawalMutation } from '@/features/creator/hooks/mutations/useCreatorWithdrawalMutation';
import { useDenyShopRequestMutation } from '@/features/creator/hooks/mutations/useDenyShopRequestMutation';
import { useCreatorLogoutMutation } from '@/features/creator/hooks/mutations/useCreatorAuthMutations';
import { clearRoleSession } from '@/features/auth/services/authSession';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { copyLinkedTextToClipboard, resolveShareOrigin } from '@/shared/utils/shopLinks';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { registerModalDismiss } from '@/shared/utils/modalBackHandler';
import { money, MIN_WITHDRAWAL_AMOUNT, WITHDRAWAL_FEE_TIERS, getWithdrawalFee, getErrorMessage,
  type AnalysisPeriod, type ApiError, type CreatorProfile, type ShopRequest, type LinkedShop,
  type AnalysisRow, type WithdrawalRow, type LeaderboardRow, type DashboardData, type ReferralData } from '@/features/creator/utils/creatorDashboardUtils';
import { CreatorEarningsHero } from '@/features/creator/components/CreatorEarningsHero';
import { CreatorAnalysisCharts } from '@/features/creator/components/CreatorAnalysisCharts';
import { CreatorLinkedShops } from '@/features/creator/components/CreatorLinkedShops';


import { ThemeSegmentedPill } from '@/shared/ui/ThemeSegmentedPill';
import { useThemeScope } from '@/shared/hooks/useAppTheme';

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>('monthly');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState<number | null>(null);
  const withdrawRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useThemeScope('creator');

  // Dismiss active dialog on Android back
  useEffect(() => {
    if (!isNativeApp() || respondingRequestId === null) return;
    return registerModalDismiss(() => {
      setRespondingRequestId(null);
      return true;
    });
  }, [respondingRequestId]);

  const dashboardQuery = useCreatorDashboardQuery(analysisPeriod);
  const referralQuery = useCreatorReferralDashboardQuery();
  const logoutMutation = useCreatorLogoutMutation();
  const withdrawalMutation = useCreatorWithdrawalMutation();
  const acceptRequestMutation = useAcceptShopRequestMutation();
  const denyRequestMutation = useDenyShopRequestMutation();

  const dashboard = dashboardQuery.data || null;
  const referral = referralQuery.data || null;
  const loading = dashboardQuery.isLoading || referralQuery.isLoading;

  const copy = async (value: string, label?: string) => {
    if (label) {
      const copyMode = await copyLinkedTextToClipboard(label, value);
      toast.success(copyMode === 'rich' ? 'Copied as linked text.' : 'Copied.');
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success('Copied.');
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // The local session should still end if the network request fails.
    } finally {
      await clearRoleSession('creator');
      navigate('/creator/login', { replace: true });
    }
  };

  const handleWithdrawal = async () => {
    const amount = Number(withdrawalAmount);
    const withdrawalFee = getWithdrawalFee(amount);
    const totalDeduction = amount + withdrawalFee;
    const balance = Number(dashboard?.creator?.balance || 0);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
      toast.error('Minimum withdrawal is KSh 50.');
      return;
    }
    if (balance < totalDeduction) {
      toast.error(`Your balance must cover the withdrawal and KSh ${withdrawalFee} charge.`);
      return;
    }

    setWithdrawing(true);
    try {
      await withdrawalMutation.mutateAsync(amount);
      toast.success('Withdrawal request sent.');
      setWithdrawalAmount('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Could not request withdrawal.'));
    } finally {
      setWithdrawing(false);
    }
  };

  const handleShopRequest = async (inviteId: number, action: 'accept' | 'deny') => {
    setRespondingRequestId(inviteId);
    try {
      if (action === 'accept') {
        await acceptRequestMutation.mutateAsync(inviteId);
        toast.success('Shop request accepted.');
      } else {
        await denyRequestMutation.mutateAsync(inviteId);
        toast.success('Shop request declined.');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Could not update shop request.'));
    } finally {
      setRespondingRequestId(null);
    }
  };

  const chartData = useMemo(() => (dashboard?.analysis || dashboard?.monthly || []).map((row) => ({
    period: row.period || row.month,
    sales: Number(row.sales || 0),
    salesValue: Number(row.sales_value || row.salesValue || 0),
    earnings: Number(row.earnings || 0),
    clicks: Number(row.clicks || 0)
  })), [dashboard?.analysis, dashboard?.monthly]);

  if (loading) {
    return (
      <main className="dashboard-layout flex min-h-screen items-center justify-center bg-[var(--byblos-bg,#000000)] px-4 text-slate-950 dark:text-white transition-colors duration-200">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] px-5 py-3 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-white/80">Loading creator dashboard...</span>
        </div>
      </main>
    );
  }

  const creator = dashboard?.creator || {};
  const referralLink = `${resolveShareOrigin()}/seller/register?ref=${referral?.referralCode || ''}`;
  const requestedAmount = Number(withdrawalAmount || 0);
  const withdrawalFee = getWithdrawalFee(requestedAmount);
  const totalDeduction = requestedAmount >= MIN_WITHDRAWAL_AMOUNT ? requestedAmount + withdrawalFee : 0;
  const hasEnoughBalance = Number(creator.balance || 0) >= totalDeduction;

  // This-period momentum for the hero — the latest analysis row.
  const latestPeriod = chartData.length ? chartData[chartData.length - 1] : undefined;
  const monthEarnings = Number(latestPeriod?.earnings || 0);
  const monthSales = Number(latestPeriod?.sales || 0);
  const monthClicks = Number(latestPeriod?.clicks || 0);

  const goToWithdraw = () => {
    withdrawRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <main className="dashboard-layout text-slate-950 dark:text-white transition-colors duration-200 bg-[var(--byblos-bg,#000000)]" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', height: '100svh', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <header className="sticky top-0 z-50 bg-[var(--byblos-bg,#000000)] pt-safe-top px-4 py-3 sm:px-6 flex items-center justify-between gap-3 transition-colors duration-200">
        <NotificationBell triggerClassName="text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10" />
        <div className="flex items-center gap-2">
          <ThemeSegmentedPill value={theme} onChange={setTheme} showLabels={false} />
          <AccountSwitcher />
        </div>
      </header>

      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>

        <CreatorEarningsHero
          firstName={creator.firstName}
          totalEarnings={Number(creator.totalEarnings || 0)}
          balance={Number(creator.balance || 0)}
          monthEarnings={monthEarnings}
          monthSales={monthSales}
          monthClicks={monthClicks}
          referralLink={referralLink}
          onCopyLink={() => copy(referralLink)}
          onGoToWithdraw={goToWithdraw}
        />

        {(dashboard?.shopRequests || []).length > 0 && (
          <section className="rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-4">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Shop requests</h2>
            <p className="mt-1 text-sm font-medium text-yellow-700 dark:text-yellow-100/70">Accept a seller request to start earning on that shop.</p>
            <div className="mt-4 grid gap-3">
              {(dashboard?.shopRequests || []).map((request) => (
                <div key={request.id} className="rounded-2xl border border-yellow-400/30 bg-white dark:bg-black/30 p-4 text-slate-950 dark:text-white">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">{request.shop_name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/40">
                        Invited by {request.seller_name || 'seller'}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        onClick={() => handleShopRequest(request.id, 'accept')}
                        disabled={respondingRequestId === request.id}
                        className="h-9 bg-yellow-400 font-black text-black hover:bg-yellow-300"
                      >
                        {respondingRequestId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleShopRequest(request.id, 'deny')}
                        disabled={respondingRequestId === request.id}
                        className="h-9 border-slate-300 dark:border-white/10 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <CreatorLinkedShops shops={dashboard?.shops || []} onCopy={copy} />

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <CreatorAnalysisCharts chartData={chartData} analysisPeriod={analysisPeriod} setAnalysisPeriod={setAnalysisPeriod} />

          <div ref={withdrawRef} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-yellow-500 dark:text-yellow-300" />
              <h2 className="text-base font-black text-slate-950 dark:text-white">Get paid</h2>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-white/50">Paid to {creator.mpesaNumber || 'your M-Pesa number'}.</p>
            <div className="mt-4 space-y-3">
              <Input
                type="number"
                min={MIN_WITHDRAWAL_AMOUNT}
                value={withdrawalAmount}
                onChange={(event) => setWithdrawalAmount(event.target.value)}
                placeholder="Amount in KSh"
                className="h-11 border-slate-300 dark:border-white/10 bg-white dark:bg-black/40 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
              />
              {requestedAmount >= MIN_WITHDRAWAL_AMOUNT && (
                <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-xs font-bold">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600 dark:text-white/55">Withdrawal charge</span>
                    <span className="text-slate-950 dark:text-white">{money(withdrawalFee)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-slate-600 dark:text-white/55">Total deducted</span>
                    <span className={hasEnoughBalance ? 'text-yellow-600 dark:text-yellow-100 font-extrabold' : 'text-red-600 dark:text-red-300 font-extrabold'}>{money(totalDeduction)}</span>
                  </div>
                </div>
              )}
              <Button
                onClick={handleWithdrawal}
                disabled={withdrawing || requestedAmount < MIN_WITHDRAWAL_AMOUNT || !hasEnoughBalance}
                className="h-11 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw to M-Pesa'}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {(dashboard?.withdrawals || []).slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-3 text-xs text-slate-950 dark:text-white">
                  <div className="flex justify-between gap-3 font-bold">
                    <span>{money(item.amount)}</span>
                    <span className="uppercase text-yellow-600 dark:text-yellow-200">{item.status}</span>
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-white/40">Charge {money(item.withdrawal_fee)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500 dark:text-yellow-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">How you rank</h2>
          </div>
          <div className="mt-4 divide-y divide-slate-200 dark:divide-white/10 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            {(dashboard?.leaderboard || []).map((item, index: number) => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-white dark:bg-black/25 p-3 text-slate-950 dark:text-white">
                <div>
                  <p className="font-black">#{index + 1} {item.first_name} {item.last_name}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-white/40">{item.total_sales || 0} sales</p>
                </div>
                <p className="font-black text-yellow-600 dark:text-yellow-200">{money(item.total_income)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-5 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-500 dark:text-white/40">Account</p>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-white/50">Sign out of your creator account on this device.</p>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="mt-3 h-10 w-full border-slate-300 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 sm:w-auto font-bold"
            aria-label="Log out of creator dashboard"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </section>
      </div>
    </main>
  );
}



