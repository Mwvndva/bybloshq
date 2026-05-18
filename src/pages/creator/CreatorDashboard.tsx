import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import creatorApi from '@/api/creatorApi';
import { Button } from '@/components/ui/button';

const money = (amount: number | string) => `KSh ${Number(amount || 0).toLocaleString()}`;

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<any>(null);
  const [referral, setReferral] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([creatorApi.getDashboard(), creatorApi.getReferralDashboard()])
      .then(([dashboardData, referralData]) => {
        setDashboard(dashboardData);
        setReferral(referralData);
      })
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-300" />
      </main>
    );
  }

  const creator = dashboard?.creator || {};
  const referralLink = `${window.location.origin}/creator/register?ref=${referral?.referralCode || ''}`;

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Creator dashboard</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Welcome, {creator.firstName}</h1>
            <p className="mt-1 text-sm font-medium text-white/50">Your completed-sale earnings and shop links.</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Balance" value={money(creator.balance)} />
          <Metric label="Completed sales" value={creator.totalSales || 0} />
          <Metric label="Creator earnings" value={money(creator.totalEarnings)} />
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
                        {Number(shop.commission_rate || 0.01) * 100}% · {shop.sales_count || 0} sales · {money(shop.earnings)}
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

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-xl font-black">Creator referral</h2>
          <p className="mt-1 text-sm font-medium text-white/50">Invite other creators and earn KSh 3 for every product they help sell. No time limit.</p>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-all text-sm font-bold text-yellow-100">{referralLink}</p>
            <Button onClick={() => copy(referralLink)} className="bg-yellow-400 font-black text-black hover:bg-yellow-300">
              Copy referral link
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">{label}</p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}
