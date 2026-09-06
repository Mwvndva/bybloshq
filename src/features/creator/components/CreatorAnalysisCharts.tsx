import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, type AnalysisPeriod, type AnalysisRow, type BusinessEarningRow } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorAnalysisChartsProps {
  analysis: AnalysisRow[];
  businessEarnings: BusinessEarningRow[];
  analysisPeriod: AnalysisPeriod;
  setAnalysisPeriod: (period: AnalysisPeriod) => void;
}

const PERIODS: AnalysisPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

const axisStroke = 'var(--byblos-subtext, rgba(255,255,255,0.45))';
const gridStroke = 'var(--byblos-border, rgba(255,255,255,0.08))';
const tooltipStyle = {
  background: 'var(--byblos-card-bg, #050505)',
  border: '1px solid var(--byblos-border, rgba(255,255,255,0.12))',
  color: 'var(--byblos-text, #ffffff)',
  borderRadius: 12
};

export function CreatorAnalysisCharts({ analysis, businessEarnings, analysisPeriod, setAnalysisPeriod }: CreatorAnalysisChartsProps) {
  const [selectedBusiness, setSelectedBusiness] = useState<string>('all');

  const periods = useMemo(() => analysis.map((r) => String(r.period ?? r.month ?? '')), [analysis]);

  const commissionData = useMemo(
    () => analysis.map((r) => ({ period: String(r.period ?? r.month ?? ''), commission: Number(r.commission_earnings ?? 0) })),
    [analysis]
  );

  const businesses = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of businessEarnings) map.set(String(row.seller_id), row.shop_name || `Business ${row.seller_id}`);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [businessEarnings]);

  const businessData = useMemo(() => {
    const byPeriod = new Map<string, number>();
    for (const p of periods) byPeriod.set(p, 0);
    for (const row of businessEarnings) {
      if (selectedBusiness !== 'all' && String(row.seller_id) !== selectedBusiness) continue;
      const p = String(row.period ?? '');
      if (!byPeriod.has(p)) continue;
      byPeriod.set(p, (byPeriod.get(p) || 0) + Number(row.earnings ?? 0));
    }
    return periods.map((p) => ({ period: p, earnings: Number(byPeriod.get(p) || 0) }));
  }, [periods, businessEarnings, selectedBusiness]);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">How you're doing</h2>
        <div className="grid grid-cols-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-200/60 dark:bg-black/30 p-1 text-xs font-black">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setAnalysisPeriod(period)}
              className={`rounded-xl px-2.5 py-2 capitalize transition-all ${
                analysisPeriod === period
                  ? 'bg-yellow-400 text-black font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Commission earnings */}
      <div className="mt-4 h-56 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-white/40">Commission earnings</p>
        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={commissionData}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis dataKey="period" stroke={axisStroke} fontSize={11} />
            <YAxis stroke={axisStroke} fontSize={11} />
            <Tooltip formatter={(value) => money(value as number)} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="commission" name="Commission" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Invited-business earnings (KSh 3) with business + period switching */}
      <div className="mt-4 h-64 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-white/40">Invited-business earnings</p>
          <select
            value={selectedBusiness}
            onChange={(e) => setSelectedBusiness(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#141414] px-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
          >
            <option value="all">All businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {businesses.length === 0 ? (
          <div className="flex h-[80%] items-center justify-center text-center text-xs font-medium text-slate-400 dark:text-white/40">
            Invite a business with your referral link to start earning KSh 3 per sale.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="82%">
            <LineChart data={businessData}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="period" stroke={axisStroke} fontSize={11} />
              <YAxis stroke={axisStroke} fontSize={11} />
              <Tooltip formatter={(value) => money(value as number)} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="earnings" name="Invited-business" stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
