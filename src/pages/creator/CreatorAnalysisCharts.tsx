import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, type AnalysisPeriod } from './creatorDashboardUtils';

interface ChartPoint { period?: string; sales: number; salesValue: number; earnings: number; clicks: number; }

interface CreatorAnalysisChartsProps {
  chartData: ChartPoint[];
  analysisPeriod: AnalysisPeriod;
  setAnalysisPeriod: (period: AnalysisPeriod) => void;
}

export function CreatorAnalysisCharts({ chartData, analysisPeriod, setAnalysisPeriod }: CreatorAnalysisChartsProps) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">Ambassador analysis</h2>
        <div className="grid grid-cols-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-200/60 dark:bg-black/30 p-1 text-xs font-black">
          {(['daily', 'weekly', 'monthly'] as AnalysisPeriod[]).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setAnalysisPeriod(period)}
              className={`rounded-xl px-3 py-2 capitalize transition-all ${
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
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid stroke="var(--byblos-border, rgba(255,255,255,0.08))" vertical={false} />
            <XAxis dataKey="period" stroke="var(--byblos-subtext, rgba(255,255,255,0.45))" fontSize={11} />
            <YAxis stroke="var(--byblos-subtext, rgba(255,255,255,0.45))" fontSize={11} />
            <Tooltip contentStyle={{ background: 'var(--byblos-card-bg, #050505)', border: '1px solid var(--byblos-border, rgba(255,255,255,0.12))', color: 'var(--byblos-text, #ffffff)', borderRadius: 12 }} />
            <Bar dataKey="clicks" fill="#facc15" radius={[6, 6, 0, 0]} barSize={12} />
            <Bar dataKey="sales" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 h-56 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-white/40">Sales value</p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--byblos-border, rgba(255,255,255,0.08))" vertical={false} />
            <XAxis dataKey="period" stroke="var(--byblos-subtext, rgba(255,255,255,0.45))" fontSize={11} />
            <YAxis stroke="var(--byblos-subtext, rgba(255,255,255,0.45))" fontSize={11} tickFormatter={(value) => `${Number(value) / 1000}k`} />
            <Tooltip
              formatter={(value) => money(value as number)}
              contentStyle={{ background: 'var(--byblos-card-bg, #050505)', border: '1px solid var(--byblos-border, rgba(255,255,255,0.12))', color: 'var(--byblos-text, #ffffff)', borderRadius: 12 }}
            />
            <Line type="monotone" dataKey="salesValue" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
