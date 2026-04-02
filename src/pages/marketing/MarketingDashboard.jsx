import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    LineChart, Line, AreaChart, Area,
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { marketingApi } from '../../services/marketingApi'
import { StatCard } from './components/StatCard'
import { ChartCard } from './components/ChartCard'
import { SectionTitle } from './components/SectionTitle'
import { LoadingSpinner } from './components/LoadingSpinner'

// Chart colour palette — matches Byblos brand (yellow, white, greys + accent colours)
const COLORS = ['#F5C842', '#60A5FA', '#34D399', '#F87171', '#A78BFA', '#FB923C', '#38BDF8', '#4ADE80']

const CHART_THEME = {
    grid: '#1F2937',
    axis: '#6B7280',
    tooltip: { bg: '#111827', border: '#374151', text: '#F9FAFB' }
}

// Custom tooltip for all charts
const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
            <p className="text-gray-400 mb-2 font-medium">{label}</p>
            {payload.map((entry) => (
                <p key={entry.name} style={{ color: entry.color }} className="mb-0.5">
                    {entry.name}: <span className="font-bold">{prefix}{Number(entry.value).toLocaleString()}{suffix}</span>
                </p>
            ))}
        </div>
    )
}

export default function MarketingDashboard() {
    const navigate = useNavigate()
    const [period, setPeriod] = useState(12)  // months selector
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Data state
    const [overview, setOverview] = useState(null)
    const [gmvTrend, setGmvTrend] = useState([])
    const [userGrowth, setUserGrowth] = useState([])
    const [productMix, setProductMix] = useState(null)
    const [orderFunnel, setOrderFunnel] = useState(null)
    const [geography, setGeography] = useState(null)
    const [topPerfs, setTopPerfs] = useState(null)
    const [referrals, setReferrals] = useState(null)
    const [activity, setActivity] = useState([])

    const user = JSON.parse(sessionStorage.getItem('marketing_user') || '{}')

    const logout = () => {
        sessionStorage.removeItem('marketing_token')
        sessionStorage.removeItem('marketing_user')
        navigate('/admin/marketing/login')
    }

    const fetchAll = useCallback(async () => {
        setLoading(true)
        setError('')
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
            ])
            setOverview(ov.data.data)
            setGmvTrend(gmv.data.data)
            setUserGrowth(ug.data.data)
            setProductMix(pm.data.data)
            setOrderFunnel(of_.data.data)
            setGeography(geo.data.data)
            setTopPerfs(tp.data.data)
            setReferrals(ref.data.data)
            setActivity(act.data.data)
        } catch (err) {
            setError('Failed to load dashboard data. Please refresh.')
        } finally {
            setLoading(false)
        }
    }, [period])

    useEffect(() => {
        const token = sessionStorage.getItem('marketing_token')
        if (!token) { navigate('/admin/marketing/login'); return }
        fetchAll()
    }, [fetchAll, navigate])

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <LoadingSpinner />
        </div>
    )

    if (error) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-red-400 text-center">
                <p>{error}</p>
                <button onClick={fetchAll} className="mt-4 text-yellow-400 underline text-sm">Try again</button>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 lg:p-12 space-y-8 md:space-y-12 selection:bg-yellow-500/30">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/[0.02] to-transparent pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-5 md:gap-8">
                    <div className="w-12 h-12 md:w-20 md:h-20 bg-yellow-500 rounded-xl md:rounded-3xl flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:scale-110 transition-transform duration-500">
                        <span className="text-black font-black text-2xl md:text-4xl">B</span>
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic">INTELLIGENCE<span className="text-yellow-500">.</span></h1>
                        <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] mt-1 opacity-60">Marketing Protocol / Admin Engine</p>
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-between md:justify-end gap-3 md:gap-6 bg-black/20 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none">
                    <div className="text-left md:text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Authenticated As</p>
                        <p className="text-xs md:text-sm font-bold text-white tracking-tight truncate max-w-[150px] md:max-w-none">{user?.email}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20
                       text-gray-400 hover:text-red-400 px-4 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl
                       text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-sm"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            {overview && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                    <StatCard title="Total GMV" value={overview.totalGmv} prefix="KSh " color="yellow" />
                    <StatCard title="Platform Revenue" value={overview.totalRevenue} prefix="KSh " color="green" />
                    <StatCard title="Total Orders" value={overview.totalOrders} color="blue" />
                    <StatCard title="Total Sellers" value={overview.totalSellers} color="purple" />
                    <StatCard title="Total Buyers" value={overview.totalBuyers} color="blue" />
                </div>
            )}

            <main className="max-w-[1600px] mx-auto space-y-8 md:space-y-12">
                {/* Dashboard Subheader */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
                    <div>
                        <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-1">Platform performance overview</p>
                        <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">Growth Dashboard</h2>
                    </div>

                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 backdrop-blur-md">
                        {[3, 6, 12].map(m => (
                            <button
                                key={m}
                                onClick={() => setPeriod(m)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${period === m
                                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {m}M
                            </button>
                        ))}
                    </div>
                </div>

                {overview && (
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <SectionTitle subtitle="This calendar month">Monthly Pulse</SectionTitle>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            <StatCard title="GMV This Month" value={overview.gmvThisMonth} prefix="KSh " color="yellow" />
                            <StatCard title="New Sellers" value={overview.newSellersThisMonth} color="purple" />
                            <StatCard title="New Buyers" value={overview.newBuyersThisMonth} color="blue" />
                            <StatCard title="Avg Order Value" value={overview.avgOrderValue} prefix="KSh " color="green" />
                        </div>
                    </section>
                )}

                {/* ── SECTION 2: GMV & REVENUE TREND LINE CHART ── */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <ChartCard
                        title="Performance Trajectory"
                        subtitle={`Aggregated monthly conversion velocity — Last ${period} months`}
                    >
                        <div className="h-[300px] md:h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={gmvTrend} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F5C842" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#F5C842" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34D399" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 10 }} />
                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 10 }}
                                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                    <Tooltip content={<CustomTooltip prefix="KSh " />} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
                                    <Area type="monotone" dataKey="gmv" name="GMV" stroke="#F5C842" fill="url(#gmvGrad)" strokeWidth={3} dot={false} />
                                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#34D399" fill="url(#revGrad)" strokeWidth={3} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </section>

                {/* ── SECTION 3: USER GROWTH + ORDER VOLUME — side by side ── */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                    <ChartCard title="User Acquisition" subtitle="New platform operators per month">
                        <div className="h-[250px] md:h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={userGrowth} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 10 }} />
                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
                                    <Bar dataKey="newSellers" name="New Sellers" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="newBuyers" name="New Buyers" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    <ChartCard title="Order Velocity" subtitle="Completed transactional volume">
                        <div className="h-[250px] md:h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={gmvTrend} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 10 }} />
                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
                                    <Line type="monotone" dataKey="orderCount" name="Orders" stroke="#F5C842" strokeWidth={3} dot={{ fill: '#F5C842', r: 4, strokeWidth: 2, stroke: '#000' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </section>

                {/* ── SECTION 4: PRODUCT MIX PIE CHARTS — side by side ── */}
                {productMix && (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                        <ChartCard title="Product Architecture" subtitle="Physical vs Digital distribution">
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={productMix.productTypes}
                                            dataKey="count"
                                            nameKey="type"
                                            cx="50%" cy="50%"
                                            outerRadius={90}
                                            innerRadius={60}
                                            paddingAngle={8}
                                            label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                                            labelLine={false}
                                        >
                                            {productMix.productTypes.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Aesthetic Profiling" subtitle="Inventory across curated categories">
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={productMix.aesthetics}
                                            dataKey="productCount"
                                            nameKey="aesthetic"
                                            cx="50%" cy="50%"
                                            outerRadius={90}
                                            innerRadius={60}
                                            paddingAngle={5}
                                            label={({ aesthetic, percent }) => `${aesthetic} ${(percent * 100).toFixed(0)}%`}
                                            labelLine={false}
                                        >
                                            {productMix.aesthetics.map((entry) => (
                                                <Cell key={entry.aesthetic} fill={COLORS[productMix.aesthetics.indexOf(entry) % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>
                    </section>
                )}

                {/* ── SECTION 5: TOP PERFORMERS TABLES ── */}
                {topPerfs && (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                        <ChartCard title="Elite Merchants" subtitle="Top-tier shop performance by GMV">
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                            <th className="pb-4 pr-4">Merchant</th>
                                            <th className="pb-4 pr-4 hidden sm:table-cell">Area</th>
                                            <th className="pb-4 text-right">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {topPerfs?.topSellers?.map((s, i) => (
                                            <tr key={s.id} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4 pr-4 text-sm font-bold text-white tracking-tight">
                                                    <span className="text-yellow-500/50 mr-3 tabular-nums">0{i + 1}</span>
                                                    {s.shopName}
                                                </td>
                                                <td className="py-4 pr-4 hidden sm:table-cell text-xs text-gray-500 font-medium italic">
                                                    {s.location || 'Nairobi'}
                                                </td>
                                                <td className="py-4 text-right text-sm font-black text-yellow-500 tabular-nums">
                                                    KSh {Number(s.totalSales || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </ChartCard>

                        <ChartCard title="Power Products" subtitle="Highest yielding inventory assets">
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                            <th className="pb-4 pr-4">Product Asset</th>
                                            <th className="pb-4 pr-4 hidden sm:table-cell">Type</th>
                                            <th className="pb-4 text-right">Yield</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {topPerfs?.topProducts?.map((p, i) => (
                                            <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4 pr-4 text-sm font-bold text-white tracking-tight">
                                                    <span className="text-blue-500/50 mr-3 tabular-nums">0{i + 1}</span>
                                                    {p.name}
                                                </td>
                                                <td className="py-4 pr-4 hidden sm:table-cell">
                                                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-black uppercase text-gray-500 border border-white/5">
                                                        {p.productType}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-right text-sm font-black text-green-400 tabular-nums">
                                                    KSh {Number(p.totalRevenue || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </ChartCard>
                    </section>
                )}

                {/* ── SECTION 6: LIVE ACTIVITY FEED ── */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                    <ChartCard title="Real-time Protocol Feed" subtitle="Latest platform transactions and registrations">
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                            {Array.isArray(activity) && activity.length > 0 ? (
                                activity.map((item) => {
                                    const key = `${item.type}-${item.timestamp}-${item.description.slice(0, 20)}`;
                                    const icons = { order: '🛒', seller: '🏪', buyer: '👤' }
                                    const colors = { order: 'text-yellow-500', seller: 'text-purple-500', buyer: 'text-blue-500' }
                                    const bgColors = { order: 'bg-yellow-500/5', seller: 'bg-purple-500/5', buyer: 'bg-blue-500/5' }
                                    const timeAgo = (ts) => {
                                        if (!ts) return 'Unknown';
                                        const diff = Date.now() - new Date(ts).getTime();
                                        const mins = Math.floor(diff / 60000);
                                        const hours = Math.floor(diff / 3600000);
                                        const days = Math.floor(diff / 86400000);

                                        if (mins < 1) return 'Just now';
                                        if (mins < 60) return `${mins}m ago`;
                                        if (hours < 24) return `${hours}h ago`;
                                        if (days === 1) return 'Yesterday';
                                        return `${days}d ago`;
                                    }

                                    return (
                                        <div key={key} className={`flex items-center gap-4 p-4 rounded-2xl border border-white/[0.03] transition-all hover:bg-white/[0.02] ${bgColors[item.type] || 'bg-white/5'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-xl shadow-inner border border-white/5">
                                                {icons[item.type] || '⚡'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold tracking-tight ${colors[item.type] || 'text-white'}`}>{item.description}</p>
                                                <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest mt-0.5">{timeAgo(item.timestamp)}</p>
                                            </div>
                                            {item.value && (
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-white tabular-nums">KSh {Number(item.value).toLocaleString()}</p>
                                                    <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Protocol Value</p>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="py-12 text-center text-gray-600 font-bold uppercase tracking-widest text-xs italic">
                                    No recent activity reported by protocol.
                                </div>
                            )}
                        </div>
                    </ChartCard>
                </section>
            </main>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/5 pt-12 pb-16 text-center animate-in fade-in duration-1000 delay-700">
                <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
                    Byblos Marketing Intelligence • Secure Read-only Environment • {new Date().getFullYear()}
                </p>
            </footer>
        </div>
    );
}
