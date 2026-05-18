import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2, MousePointerClick, Trophy, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import creatorApi from '@/api/creatorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const money = (amount: number | string) => `KSh ${Number(amount || 0).toLocaleString()}`;

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<any>(null);
  const [referral, setReferral] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');

  const loadDashboard = async () => {
    const [dashboardData, referralData] = await Promise.all([
      creatorApi.getDashboard(),
      creatorApi.getReferralDashboard()
    ]);
    setDashboard(dashboardData);
    setReferral(referralData);
  };

  useEffect(() => {
    loadDashboard()
      .catch(() => {
        localStorage.removeItem('creatorSessionActive');
        navigate('/creator/login');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied.');
  };

  const handleWithdrawal = async () => {
    const amount = Number(withdrawalAmount);
    if (!Number.isFinite(amount) || amount < 50) {
      toast.error('Minimum withdrawal is KSh 50.');
      return;
    }

    setWithdrawing(true);
    try {
      await creatorApi.requestWithdrawal(amount);
      toast.success('Withdrawal request sent.');
      setWithdrawalAmount('');
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not request withdrawal.');
    } finally {
      setWithdrawing(false);
    }
  };

  const chartData = useMemo(() => (dashboard?.monthly || []).map((row: any) => ({
    month: row.month,
    sales: Number(row.sales || 0),
    earnings: Number(row.earnings || 0),
    clicks: Number(row.clicks || 0)
  })), [dashboard?.monthly]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-300" />
      </main>
    );
  }

  const creator = dashboard?.creator || {};
  const referralLink = `${window.location.origin}/seller/register?ref=${referral?.referralCode || ''}`;

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Creator dashboard</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Welcome, {creator.firstName}</h1>
            <p className="mt-1 text-sm font-medium text-white/50">Track clicks, sales, earnings, referrals, and withdrawals.</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Balance" value={money(creator.balance)} />
          <Metric label="Completed sales" value={creator.totalSales || 0} />
          <Metric label="Creator earnings" value={money(creator.totalEarnings)} />
          <Metric label="Link clicks" value={dashboard?.linkClicks || 0} icon={<MousePointerClick className="h-5 w-5 text-yellow-300" />} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-xl font-black">Monthly analysis</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#050505', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                  <Bar dataKey="clicks" fill="#facc15" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sales" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
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
                min={50}
                value={withdrawalAmount}
                onChange={(event) => setWithdrawalAmount(event.target.value)}
                placeholder="Amount in KSh"
                className="h-11 border-white/10 bg-black/40 text-white"
              />
              <Button onClick={handleWithdrawal} disabled={withdrawing} className="h-11 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300">
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw to M-Pesa'}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {(dashboard?.withdrawals || []).slice(0, 3).map((item: any) => (
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

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-xl font-black">Linked shops</h2>
          <div className="mt-4 grid gap-3">
            {(dashboard?.shops || []).map((shop: any) => {
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

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-300" />
              <h2 className="text-xl font-black">Top creators</h2>
            </div>
            <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
              {(dashboard?.leaderboard || []).map((item: any, index: number) => (
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
