import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalAuth } from '@/features/auth/hooks/useGlobalAuth';
import {
    LineChart, Line, AreaChart, Area,
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { marketingApi } from '../api/marketingApi';
import { StatCard } from '../components/StatCard';
import { ChartCard } from '../components/ChartCard';
import { SectionTitle } from '../components/SectionTitle';
import { LoadingSpinner } from '../components/LoadingSpinner';

import { useAppTheme } from '@/shared/hooks/useAppTheme';

const COLORS = ['#F5C842', '#E5E5E5', '#737373', '#D4D4D4', '#F59E0B', '#A3A3A3', '#E7E5DF', '#525252'];

interface TooltipPayload {
    name: string;
    value: number | string;
    color: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
    prefix?: string;
    suffix?: string;
}

const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10 rounded-lg p-3 text-xs shadow-xl text-slate-900 dark:text-white">
            <p className="text-slate-500 dark:text-gray-400 mb-2 font-medium">{label}</p>
            {payload.map((entry) => (
                <p key={entry.name} style={{ color: entry.color }} className="mb-0.5 font-medium">
                    {entry.name}: <span className="font-bold">{prefix}{Number(entry.value).toLocaleString()}{suffix}</span>
                </p>
            ))}
        </div>
    );
};

export default function MarketingDashboard() {
    const navigate = useNavigate();
    const { theme } = useAppTheme();
    const isLight = theme === 'light' || (theme === 'system' && typeof window !== 'undefined' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

    const chartTheme = {
        grid: isLight ? 'rgba(0, 0, 0, 0.08)' : '#262626',
        axis: isLight ? '#64748b' : '#9CA3AF',
        tooltip: isLight
            ? { bg: '#ffffff', border: 'rgba(0,0,0,0.1)', text: '#0f172a' }
            : { bg: '#0A0A0A', border: 'rgba(255,255,255,0.1)', text: '#F5F5F5' }
    };
    const { user: globalUser, logout } = useGlobalAuth();
    const [period, setPeriod] = useState<number>(12);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    // Data state
    const [overview, setOverview] = useState<any>(null);
    const [gmvTrend, setGmvTrend] = useState<any[]>([]);
    const [userGrowth, setUserGrowth] = useState<any[]>([]);
    const [productMix, setProductMix] = useState<any>(null);
    const [orderFunnel, setOrderFunnel] = useState<any>(null);
    const [geography, setGeography] = useState<any>(null);
    const [topPerfs, setTopPerfs] = useState<any>(null);
    const [referrals, setReferrals] = useState<any>(null);
    const [activity, setActivity] = useState<any[]>([]);

    const user = globalUser?.profile || JSON.parse(sessionStorage.getItem('marketing_user') || '{}');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [ov, gmv, ug, pm, of_, geo, tp, ref, act] = await Promise.all([
                marketingApi.getOverview(),
                marketingApi.getGmvTrend(period),
                marketingApi.getUserGrowth(period),
                marketingApi.getProductMix(),
                marketingApi.getOrderFunnel(),
                marketingApi.getGeography(),
                marketingApi.getTopPerformers(),
                marketingApi.getReferrals(),
                marketingApi.getActivity(20)
            ]);
            const extractArray = (res: any) => {
                const payload = res?.data?.data ?? res?.data;
                return Array.isArray(payload) ? payload : [];
            };

            const extractObject = (res: any) => {
                const payload = res?.data?.data ?? res?.data;
                return payload && typeof payload === 'object' ? payload : null;
            };

            setOverview(extractObject(ov));
            setGmvTrend(extractArray(gmv));
            setUserGrowth(extractArray(ug));
            setProductMix(extractArray(pm));
            setOrderFunnel(extractArray(of_));
            setGeography(extractArray(geo));
            setTopPerfs(extractObject(tp));
            setReferrals(extractObject(ref));
            setActivity(extractArray(act));
        } catch (err) {
            setError('Failed to load dashboard data. Please refresh.');
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    if (loading) return (
        <div className="flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[#050505]">
            <LoadingSpinner />
        </div>
    );

    if (error) return (
        <div className="flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[#050505] p-4">
            <div className="text-red-400 text-center rounded-3xl border border-white/10 bg-[#0A0A0A]/70 p-8 shadow-xl">
                <p>{error}</p>
                <button onClick={fetchAll} className="mt-4 text-yellow-500 underline text-sm">Try again</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-[100svh] overflow-x-hidden bg-[#050505] p-3 text-white selection:bg-yellow-500/30 sm:p-4 md:p-8 lg:p-12 space-y-8 md:space-y-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0A0A0A]/70 border border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 shadow-xl relative overflow-hidden group">
                <div className="relative z-10 flex items-center gap-5 md:gap-8">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-400 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm">
                        <span className="text-black font-semibold text-2xl md:text-3xl">B</span>
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white">Marketing Dashboard<span className="text-yellow-500">.</span></h1>
                        <p className="text-gray-400 text-xs md:text-sm font-medium mt-1">Platform growth and acquisition.</p>
                    </div>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(Number(e.target.value))}
                        className="bg-[#171717] border border-white/10 text-xs font-semibold rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500 transition-colors cursor-pointer"
                    >
                        <option value={3}>Last 3 Months</option>
                        <option value={6}>Last 6 Months</option>
                        <option value={12}>Last 12 Months</option>
                    </select>

                    <button
                        onClick={async () => {
                            await logout();
                            navigate('/admin/marketing/login');
                        }}
                        className="bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-xl px-4 py-2.5 text-gray-300 border border-white/10 transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            {/* Overview Stat Cards */}
            {overview && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <StatCard
                        title="Total Registered Users"
                        value={Number(overview.totalUsers || 0).toLocaleString()}
                        trend={overview.userGrowthMoM}
                        label="MoM growth"
                        color="yellow"
                    />
                    <StatCard
                        title="Active Sellers"
                        value={Number(overview.activeSellers || 0).toLocaleString()}
                        sub={`${overview.pendingSellers || 0} pending verification`}
                        color="gray"
                    />
                    <StatCard
                        title="Active Creators"
                        value={Number(overview.activeCreators || 0).toLocaleString()}
                        sub={`KSh ${Number(overview.creatorEarningsTotalKsh || 0).toLocaleString()} paid out`}
                        color="gray"
                    />
                    <StatCard
                        title="Gross Merchandise Value"
                        value={`KSh ${Number((overview.totalGmvCents || 0) / 100).toLocaleString()}`}
                        trend={overview.gmvGrowthMoM}
                        label="MoM growth"
                        color="yellow"
                    />
                </div>
            )}

            {/* Charts Section 1: GMV & User Growth Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <ChartCard title="GMV Trend (KSh)" subtitle="Gross merchandise value over time">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={gmvTrend}>
                            <defs>
                                <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F5C842" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#F5C842" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                            <XAxis dataKey="month" stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip prefix="KSh " />} />
                            <Area type="monotone" dataKey="gmvKsh" name="GMV" stroke="#F5C842" fillOpacity={1} fill="url(#gmvGrad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="User Acquisition" subtitle="New buyer, seller, and creator signups">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={userGrowth}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                            <XAxis dataKey="month" stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="buyers" name="Buyers" fill="#F5C842" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sellers" name="Sellers" fill="#737373" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="creators" name="Creators" fill="#E5E5E5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Charts Section 2: Funnel & Mix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {Array.isArray(productMix) && productMix.length > 0 && (
                    <ChartCard title="Product Mix" subtitle="Orders by category">
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={productMix}
                                    dataKey="count"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ category }) => category}
                                >
                                    {productMix.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {Array.isArray(orderFunnel) && orderFunnel.length > 0 && (
                    <ChartCard title="Order Conversion Funnel" subtitle="Visitor to delivery breakdown">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={orderFunnel} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                                <XAxis type="number" stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
                                <YAxis dataKey="stage" type="category" stroke={chartTheme.axis} tick={{ fontSize: 11 }} width={90} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Count" fill="#F5C842" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {Array.isArray(geography) && geography.length > 0 && (
                    <ChartCard title="Top Buyer Locations" subtitle="Geographic distribution">
                        <div className="space-y-3 pt-2">
                            {geography.map((item: any, i: number) => (
                                <div key={item.city || i} className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <span className="text-xs font-medium text-gray-300">{item.city}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 bg-white/10 h-2 rounded-full overflow-hidden">
                                            <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${item.percentage || 0}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-white w-10 text-right">{item.percentage}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                )}
            </div>

            {/* Section 3: Top Performers & Referrals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                {Array.isArray(topPerfs?.sellers) && topPerfs.sellers.length > 0 && (
                    <div className="bg-[#0A0A0A]/70 border border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 shadow-xl">
                        <SectionTitle title="Top Performing Shops" subtitle="Highest GMV sellers this month" />
                        <div className="divide-y divide-white/5">
                            {topPerfs.sellers.map((s: any, idx: number) => (
                                <div key={s.id || idx} className="py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-yellow-500 w-5">#{idx + 1}</span>
                                        <div>
                                            <p className="text-sm font-semibold text-white">{s.shopName || s.name}</p>
                                            <p className="text-xs text-gray-400">{s.category || 'General'}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-white">KSh {Number(s.gmvKsh || 0).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {Array.isArray(referrals?.creators) && referrals.creators.length > 0 && (
                    <div className="bg-[#0A0A0A]/70 border border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 shadow-xl">
                        <SectionTitle title="Creator Referrals" subtitle="Top performing growth ambassadors" />
                        <div className="divide-y divide-white/5">
                            {referrals.creators.map((c: any, idx: number) => (
                                <div key={c.id || idx} className="py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-yellow-500 w-5">#{idx + 1}</span>
                                        <div>
                                            <p className="text-sm font-semibold text-white">{c.name}</p>
                                            <p className="text-xs text-gray-400">{c.referredSellersCount || 0} sellers invited</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-yellow-400">KSh {Number(c.earnedKsh || 0).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Section 4: Live Activity Log */}
            {activity?.length > 0 && (
                <div className="bg-[#0A0A0A]/70 border border-white/10 rounded-2xl md:rounded-[2rem] p-6 md:p-8 shadow-xl">
                    <SectionTitle title="Live Platform Activity" subtitle="Recent signups, orders, and referrals" />
                    <div className="space-y-3 mt-4">
                        {activity.map((item: any, idx: number) => (
                            <div key={item.id || idx} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                                    <span className="text-gray-300 font-medium">{item.description}</span>
                                </div>
                                <span className="text-gray-500 font-mono">{item.timeAgo || 'Just now'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
