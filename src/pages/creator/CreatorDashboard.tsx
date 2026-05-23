import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2, LogOut, MousePointerClick, Trophy, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import creatorApi from '@/api/creatorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const money = (amount: number | string) => `KSh ${Number(amount || 0).toLocaleString()}`;
const MIN_WITHDRAWAL_AMOUNT = 50;
const WITHDRAWAL_FEE_TIERS = [
  { min: 50, max: 1500, fee: 21 },
  { min: 1501, max: 19999.99, fee: 45 },
  { min: 20000, max: Number.POSITIVE_INFINITY, fee: 63 }
] as const;
const getWithdrawalFee = (amount: number) => {
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) return 0;
  return WITHDRAWAL_FEE_TIERS.find(({ min, max }) => amount >= min && amount <= max)?.fee || 0;
};
type AnalysisPeriod = 'daily' | 'weekly' | 'monthly';
type ApiError = { response?: { data?: { message?: string } }; message?: string };
type CreatorProfile = {
  balance?: number;
  firstName?: string;
  mpesaNumber?: string;
  totalEarnings?: number;
  totalSales?: number;
};
type ShopRequest = { id: number; shop_name?: string; seller_name?: string };
type LinkedShop = {
  id: number;
  shop_name?: string;
  code?: string;
  commission_rate?: number | string;
  sales_count?: number | string;
  click_count?: number | string;
  earnings?: number | string;
};
type AnalysisRow = {
  period?: string;
  month?: string;
  sales?: number | string;
  sales_value?: number | string;
  salesValue?: number | string;
  earnings?: number | string;
  clicks?: number | string;
};
type WithdrawalRow = { id: number; amount?: number | string; withdrawal_fee?: number | string; status?: string };
type LeaderboardRow = {
  id: number;
  first_name?: string;
  last_name?: string;
  total_sales?: number | string;
  total_income?: number | string;
};
type DashboardData = {
  creator?: CreatorProfile;
  shops?: LinkedShop[];
  shopRequests?: ShopRequest[];
  analysis?: AnalysisRow[];
  monthly?: AnalysisRow[];
  withdrawals?: WithdrawalRow[];
  leaderboard?: LeaderboardRow[];
  linkClicks?: number;
};
type ReferralData = { referralCode?: string };

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
};

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>('monthly');
  const [respondingRequestId, setRespondingRequestId] = useState<number | null>(null);

  const loadDashboard = useCallback(async (period: AnalysisPeriod = analysisPeriod) => {
    const [dashboardData, referralData] = await Promise.all([
      creatorApi.getDashboard(period),
      creatorApi.getReferralDashboard()
    ]);
    setDashboard(dashboardData);
    setReferral(referralData);
  }, [analysisPeriod]);

  useEffect(() => {
    loadDashboard()
      .catch(() => {
        localStorage.removeItem('creatorSessionActive');
        navigate('/creator/login');
      })
      .finally(() => setLoading(false));
  }, [navigate, analysisPeriod, loadDashboard]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied.');
  };

  const handleLogout = async () => {
    try {
      await creatorApi.logout();
    } catch {
      // The local session should still end if the network request fails.
    } finally {
      localStorage.removeItem('creatorSessionActive');
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
      await creatorApi.requestWithdrawal(amount);
      toast.success('Withdrawal request sent.');
      setWithdrawalAmount('');
      await loadDashboard(analysisPeriod);
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
        await creatorApi.acceptShopRequest(inviteId);
        toast.success('Shop request accepted.');
      } else {
        await creatorApi.denyShopRequest(inviteId);
        toast.success('Shop request declined.');
      }
      await loadDashboard(analysisPeriod);
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
      <main className="byblos-light-page flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-300" />
      </main>
    );
  }

  const creator = dashboard?.creator || {};
  const referralLink = `${window.location.origin}/seller/register?ref=${referral?.referralCode || ''}`;
  const requestedAmount = Number(withdrawalAmount || 0);
  const withdrawalFee = getWithdrawalFee(requestedAmount);
  const totalDeduction = requestedAmount >= MIN_WITHDRAWAL_AMOUNT ? requestedAmount + withdrawalFee : 0;
  const hasEnoughBalance = Number(creator.balance || 0) >= totalDeduction;

  return (
    <main className="byblos-light-page min-h-screen bg-black px-4 py-6 text-white">
      <div className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Creator dashboard</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Welcome, {creator.firstName}</h1>
            <p className="mt-1 text-sm font-medium text-white/50">Track clicks, sales, earnings, referrals, and withdrawals.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="h-10 w-full border-white/10 bg-white/[0.03] text-white hover:bg-white/10 sm:w-auto"
            aria-label="Log out of creator dashboard"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Balance" value={money(creator.balance)} />
          <Metric label="Completed sales" value={creator.totalSales || 0} />
          <Metric label="Creator earnings" value={money(creator.totalEarnings)} />
          <Metric label="Link clicks" value={dashboard?.linkClicks || 0} icon={<MousePointerClick className="h-5 w-5 text-yellow-300" />} />
        </section>

        {(dashboard?.shopRequests || []).length > 0 && (
          <section className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-4">
            <h2 className="text-xl font-black">Shop requests</h2>
            <p className="mt-1 text-sm font-medium text-yellow-100/70">Accept a seller request to generate your creator link for that shop.</p>
            <div className="mt-4 grid gap-3">
              {(dashboard?.shopRequests || []).map((request) => (
                <div key={request.id} className="rounded-2xl border border-yellow-400/20 bg-black/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">{request.shop_name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
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
                        className="h-9 border-white/10 bg-transparent text-white hover:bg-white/5"
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

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-xl font-black">Linked shops</h2>
          <div className="mt-4 grid gap-3">
            {(dashboard?.shops || []).length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-medium text-white/45">
                No linked shops yet.
              </div>
            ) : (dashboard?.shops || []).map((shop) => {
              const link = `${window.location.origin}/shop/${shop.shop_name}?creator=${shop.code}`;
              return (
                <div key={shop.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">{shop.shop_name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                        {Number(shop.commission_rate || 0.01) * 100}% cut | {shop.sales_count || 0} sales | {shop.click_count || 0} clicks | {money(shop.earnings)}
                      </p>
                      <p className="mt-1 break-all text-xs text-yellow-200/80">{link}</p>
                    </div>
                    <Button variant="outline" onClick={() => copy(link)} className="border-white/10 bg-transparent text-white hover:bg-white/5">
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-black">Creator analysis</h2>
              <div className="grid grid-cols-3 rounded-2xl border border-white/10 bg-black/30 p-1 text-xs font-black">
                {(['daily', 'weekly', 'monthly'] as AnalysisPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setAnalysisPeriod(period)}
                    className={`rounded-xl px-3 py-2 capitalize transition ${analysisPeriod === period ? 'bg-yellow-400 text-black' : 'text-white/50 hover:text-white'}`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="period" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#050505', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                  <Bar dataKey="clicks" fill="#facc15" radius={[6, 6, 0, 0]} barSize={12} />
                  <Bar dataKey="sales" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 h-56 rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/40">Sales value</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="period" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                  <Tooltip
                    formatter={(value) => money(value as number)}
                    contentStyle={{ background: '#050505', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                  />
                  <Line type="monotone" dataKey="salesValue" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-yellow-300" />
              <h2 className="text-xl font-black">Withdraw</h2>
            </div>
            <p className="mt-2 text-sm font-medium text-white/50">Paid to {creator.mpesaNumber || 'your M-Pesa number'}.</p>
            <div className="mt-4 space-y-3">
              <Input
                type="number"
                min={MIN_WITHDRAWAL_AMOUNT}
                value={withdrawalAmount}
                onChange={(event) => setWithdrawalAmount(event.target.value)}
                placeholder="Amount in KSh"
                className="h-11 border-white/10 bg-black/40 text-white"
              />
              {requestedAmount >= MIN_WITHDRAWAL_AMOUNT && (
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs font-bold">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/55">Withdrawal charge</span>
                    <span>{money(withdrawalFee)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-white/55">Total deducted</span>
                    <span className={hasEnoughBalance ? 'text-yellow-100' : 'text-red-300'}>{money(totalDeduction)}</span>
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
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs">
                  <div className="flex justify-between gap-3 font-bold">
                    <span>{money(item.amount)}</span>
                    <span className="uppercase text-yellow-200">{item.status}</span>
                  </div>
                  <p className="mt-1 text-white/40">Charge {money(item.withdrawal_fee)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-300" />
              <h2 className="text-xl font-black">Top creators</h2>
            </div>
            <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
              {(dashboard?.leaderboard || []).map((item, index: number) => (
                <div key={item.id} className="flex items-center justify-between gap-3 bg-black/25 p-3">
                  <div>
                    <p className="font-black">#{index + 1} {item.first_name} {item.last_name}</p>
                    <p className="text-xs font-semibold text-white/40">{item.total_sales || 0} sales</p>
                  </div>
                  <p className="font-black text-yellow-200">{money(item.total_income)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-xl font-black">Seller referral</h2>
            <p className="mt-1 text-sm font-medium text-white/50">Invite sellers and earn KSh 3 for every product they sell. No time limit.</p>
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="break-all text-sm font-bold text-yellow-100">{referralLink}</p>
              <Button onClick={() => copy(referralLink)} className="bg-yellow-400 font-black text-black hover:bg-yellow-300">
                Copy seller link
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}
