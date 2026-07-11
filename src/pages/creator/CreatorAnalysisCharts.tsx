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
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-black">Ambassador analysis</h2>
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
  );
}
