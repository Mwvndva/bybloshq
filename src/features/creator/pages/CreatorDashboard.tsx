import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, UserRound } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { toast } from 'sonner';
import { useCreatorDashboardQuery } from '@/features/creator/hooks/queries/useCreatorDashboardQuery';
import { useCreatorReferralDashboardQuery } from '@/features/creator/hooks/queries/useCreatorReferralDashboardQuery';
import { useAcceptShopRequestMutation } from '@/features/creator/hooks/mutations/useAcceptShopRequestMutation';
import { useDenyShopRequestMutation } from '@/features/creator/hooks/mutations/useDenyShopRequestMutation';
import { useCreatorLogoutMutation } from '@/features/creator/hooks/mutations/useCreatorAuthMutations';
import { useLeavePromotedShopMutation } from '@/features/creator/hooks/mutations/useLeavePromotedShopMutation';
import { useLeaveInvitedBusinessMutation } from '@/features/creator/hooks/mutations/useLeaveInvitedBusinessMutation';
import { clearRoleSession } from '@/features/auth/services/authSession';
import { Button } from '@/shared/ui/button';
import { copyLinkedTextToClipboard, resolveShareOrigin } from '@/shared/utils/shopLinks';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { registerModalDismiss } from '@/shared/utils/modalBackHandler';
import { useThemeScope } from '@/shared/hooks/useAppTheme';
import {
  money,
  getErrorMessage,
  MAX_PROMOTED_SHOPS,
  MAX_INVITED_BUSINESSES,
  type AnalysisPeriod
} from '@/features/creator/utils/creatorDashboardUtils';
import { CreatorEarningsHero } from '@/features/creator/components/CreatorEarningsHero';
import { CreatorAnalysisCharts } from '@/features/creator/components/CreatorAnalysisCharts';
import { CreatorLinkedShops } from '@/features/creator/components/CreatorLinkedShops';
import { CreatorHowItWorks } from '@/features/creator/components/CreatorHowItWorks';
import { CreatorAvailableShops } from '@/features/creator/components/CreatorAvailableShops';
import { CreatorProfileSheet } from '@/features/creator/components/CreatorProfileSheet';

type DashboardTab = 'performance' | 'shops';

export default function CreatorDashboard() {
  const navigate = useNavigate();
  useThemeScope('creator');

  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>('monthly');
  const [tab, setTab] = useState<DashboardTab>('performance');
  const [respondingRequestId, setRespondingRequestId] = useState<number | null>(null);
  const [leavingShopSellerId, setLeavingShopSellerId] = useState<number | null>(null);
  const [leavingBusinessSellerId, setLeavingBusinessSellerId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFocusWithdrawals, setSheetFocusWithdrawals] = useState(false);

  const dashboardQuery = useCreatorDashboardQuery(analysisPeriod);
  const referralQuery = useCreatorReferralDashboardQuery();
  const logoutMutation = useCreatorLogoutMutation();
  const acceptRequestMutation = useAcceptShopRequestMutation();
  const denyRequestMutation = useDenyShopRequestMutation();
  const leaveShopMutation = useLeavePromotedShopMutation();
  const leaveBusinessMutation = useLeaveInvitedBusinessMutation();

  const dashboard = dashboardQuery.data || null;
  const referral = referralQuery.data || null;
  const loading = dashboardQuery.isLoading || referralQuery.isLoading;

  // Dismiss the shop-request dialog on Android back.
  useEffect(() => {
    if (!isNativeApp() || respondingRequestId === null) return;
    return registerModalDismiss(() => {
      setRespondingRequestId(null);
      return true;
    });
  }, [respondingRequestId]);

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

  const handleLeaveShop = async (sellerId: number) => {
    setLeavingShopSellerId(sellerId);
    try {
      await leaveShopMutation.mutateAsync(sellerId);
      toast.success('You have left this shop.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Could not leave this shop.'));
    } finally {
      setLeavingShopSellerId(null);
    }
  };

  const handleLeaveBusiness = async (sellerId: number) => {
    setLeavingBusinessSellerId(sellerId);
    try {
      await leaveBusinessMutation.mutateAsync(sellerId);
      toast.success('You have left this business.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Could not leave this business.'));
    } finally {
      setLeavingBusinessSellerId(null);
    }
  };

  const analysis = useMemo(() => dashboard?.analysis || dashboard?.monthly || [], [dashboard?.analysis, dashboard?.monthly]);
  const businessEarnings = useMemo(() => dashboard?.businessEarnings || [], [dashboard?.businessEarnings]);

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
  const clearance = dashboard?.clearance;
  const totalBalance = Number(clearance?.totalBalance ?? creator.balance ?? 0);
  const availableBalance = Number(clearance?.availableBalance ?? creator.balance ?? 0);
  const clearingBalance = Number(clearance?.clearingBalance ?? 0);
  const isClearing = Boolean(clearance?.isClearing);
  const nextAvailableAt = clearance?.nextAvailableAt;

  const referralLink = `${resolveShareOrigin()}/seller/register?ref=${referral?.referralCode || ''}`;
  const invitedBusinesses = referral?.referredSellers || [];
  const linkedShops = dashboard?.shops || [];
  const shopRequests = dashboard?.shopRequests || [];

  const latestPeriod = analysis.length ? analysis[analysis.length - 1] : undefined;
  const monthEarnings = Number(latestPeriod?.earnings || 0);
  const monthSales = Number(latestPeriod?.sales || 0);
  const monthClicks = Number(latestPeriod?.clicks || 0);

  const openWithdrawals = () => {
    setSheetFocusWithdrawals(true);
    setSheetOpen(true);
  };
  const openProfile = () => {
    setSheetFocusWithdrawals(false);
    setSheetOpen(true);
  };

  const tabButton = (value: DashboardTab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-black capitalize transition-all ${
        tab === value
          ? 'bg-yellow-400 text-black shadow-sm'
          : 'text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      {label}
      {badge ? (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <main className="dashboard-layout text-slate-950 dark:text-white transition-colors duration-200 bg-[var(--byblos-bg,#000000)]" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', height: '100svh', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <header className="sticky top-0 z-50 bg-[var(--byblos-bg,#000000)] pt-safe-top px-4 py-3 sm:px-6 flex items-center justify-between gap-3 transition-colors duration-200">
        <NotificationBell triggerClassName="text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10" />
        <div className="flex items-center gap-2">
          <AccountSwitcher />
          <button
            type="button"
            onClick={openProfile}
            aria-label="Open profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-white/10"
          >
            <UserRound className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="px-4 pt-3 sm:px-6 lg:px-8">
        <div className="flex gap-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/30 p-1">
          {tabButton('performance', 'Performance')}
          {tabButton('shops', 'Shops', shopRequests.length)}
        </div>
      </div>

      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {tab === 'performance' ? (
          <>
            <CreatorHowItWorks />

            <CreatorEarningsHero
              firstName={creator.firstName}
              totalEarnings={Number(creator.totalEarnings || 0)}
              balance={totalBalance}
              availableBalance={availableBalance}
              clearingBalance={clearingBalance}
              nextAvailableAt={nextAvailableAt}
              isClearing={isClearing}
              monthEarnings={monthEarnings}
              monthSales={monthSales}
              monthClicks={monthClicks}
              referralLink={referralLink}
              onCopyLink={() => copy(referralLink)}
              onGoToWithdraw={openWithdrawals}
            />

            <CreatorAnalysisCharts
              analysis={analysis}
              businessEarnings={businessEarnings}
              analysisPeriod={analysisPeriod}
              setAnalysisPeriod={setAnalysisPeriod}
            />

            <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">Invited businesses</h2>
                <span className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-white/60">
                  {invitedBusinesses.length}/{MAX_INVITED_BUSINESSES} invited
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-white/45">
                Businesses you invited earn you KSh 3 per sale. Leaving cancels only pending (still-clearing) earnings.
              </p>
              <div className="mt-4 grid gap-3">
                {invitedBusinesses.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-4 text-sm font-medium text-slate-500 dark:text-white/45">
                    Share your referral link (in the earnings card above) to invite up to {MAX_INVITED_BUSINESSES} businesses.
                  </div>
                ) : invitedBusinesses.map((biz) => {
                  const sid = Number(biz.id);
                  const isLeaving = leavingBusinessSellerId === sid;
                  return (
                    <div key={biz.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-4 text-slate-950 dark:text-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950 dark:text-white">{biz.shop_name || `Business ${biz.id}`}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-white/40">Earned {money(biz.earnings)}</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleLeaveBusiness(sid)}
                          disabled={isLeaving}
                          className="border-red-300 dark:border-red-500/30 bg-white dark:bg-transparent text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-2 h-4 w-4" />Leave</>}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <>
            {shopRequests.length > 0 && (
              <section className="rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-4">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">Shop requests</h2>
                <p className="mt-1 text-sm font-medium text-yellow-700 dark:text-yellow-100/70">Accept a seller request to start earning on that shop.</p>
                <div className="mt-4 grid gap-3">
                  {shopRequests.map((request) => (
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

            <CreatorLinkedShops
              shops={linkedShops}
              onCopy={copy}
              onLeave={handleLeaveShop}
              leavingSellerId={leavingShopSellerId}
              maxPromotions={MAX_PROMOTED_SHOPS}
            />

            <CreatorAvailableShops />
          </>
        )}
      </div>

      <CreatorProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        creator={creator}
        clearance={clearance}
        withdrawals={dashboard?.withdrawals || []}
        onLogout={handleLogout}
        focusWithdrawals={sheetFocusWithdrawals}
      />
    </main>
  );
}
