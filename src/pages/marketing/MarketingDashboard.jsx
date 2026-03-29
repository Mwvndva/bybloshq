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
            {payload.map((entry, i) => (
                <p key={i} style={{ color: entry.color }} className="mb-0.5">
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
        <div className="min-h-screen bg-[#050505] text-white selection:bg-yellow-500/30">
            {/* Glossy Header Background */}
            <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                            <span className="text-black font-black text-xl">B</span>
                        </div>
                        <h1 className="text-lg font-bold tracking-tight">Marketing Intelligence</h1>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-gray-400 text-xs font-medium">{user?.email}</span>
                        <button
                            onClick={() => fetchAll()}
                            disabled={loading}
                            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        <button
                            onClick={logout}
                            className="bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-white/10"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Dashboard Subheader */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-1">Platform performance overview</p>
                        <h2 className="text-3xl font-black text-white tracking-tighter">Growth Dashboard</h2>
                    </div>

                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 backdrop-blur-md">
                        {[3, 6, 12].map(m => (
                            <button
                                key={m}
                                onClick={() => setPeriod(m)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${period === m
                                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {m}M
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── SECTION 1: KPI STAT CARDS ── */}
                {overview && (
                    <>
                        <section>
                            <SectionTitle subtitle="All-time platform totals">Key Metrics</SectionTitle>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <StatCard title="Total GMV" value={overview.totalGmv} prefix="KSh " color="yellow" />
                                <StatCard title="Platform Revenue" value={overview.totalRevenue} prefix="KSh " color="green" />
                                <StatCard title="Total Orders" value={overview.totalOrders} color="blue" />
                                <StatCard title="Total Sellers" value={overview.totalSellers} color="purple" />
                                <StatCard title="Total Buyers" value={overview.totalBuyers} color="blue" />
                            </div>
                        </section>

                        <section>
                            <SectionTitle subtitle="This calendar month">This Month</SectionTitle>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <StatCard title="GMV This Month" value={overview.gmvThisMonth} prefix="KSh " color="yellow" />
                                <StatCard title="New Sellers" value={overview.newSellersThisMonth} color="purple" />
                                <StatCard title="New Buyers" value={overview.newBuyersThisMonth} color="blue" />
                                <StatCard title="Avg Order Value" value={overview.avgOrderValue} prefix="KSh " color="green" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                                <StatCard title="Cancellation Rate" value={`${overview.cancellationRate}%`} color="red" />
                                <StatCard title="Total Wishlisted" value={overview.totalWishlists} color="purple" />
                                <StatCard title="Total Refunded" value={overview.totalRefunded} prefix="KSh " color="red" />
                                <StatCard title="Referral Rewards Paid" value={overview.totalReferralRewards} prefix="KSh " color="yellow" />
                            </div>
                        </section>
                    </>
                )}

                {/* ── SECTION 2: GMV & REVENUE TREND LINE CHART ── */}
                <section>
                    <ChartCard
                        title="GMV & Revenue Trend"
                        subtitle={`Last ${period} months — completed orders only`}
                    >
                        <ResponsiveContainer width="100%" height={280}>
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
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                                <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
                                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                <Tooltip content={<CustomTooltip prefix="KSh " />} />
                                <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
                                <Area type="monotone" dataKey="gmv" name="GMV" stroke="#F5C842" fill="url(#gmvGrad)" strokeWidth={2} dot={false} />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#34D399" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </section>

                {/* ── SECTION 3: USER GROWTH + ORDER VOLUME — side by side ── */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="User Growth" subtitle="New sellers & buyers per month">
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={userGrowth} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                                <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
                                <Bar dataKey="newSellers" name="New Sellers" fill="#A78BFA" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="newBuyers" name="New Buyers" fill="#60A5FA" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Order Volume" subtitle="Completed orders per month">
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={gmvTrend} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                                <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
                                <Line type="monotone" dataKey="orderCount" name="Orders" stroke="#F5C842" strokeWidth={2} dot={{ fill: '#F5C842', r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </section>

                {/* ── SECTION 4: PRODUCT MIX PIE CHARTS — side by side ── */}
                {productMix && (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard title="Product Type Mix" subtitle="Physical / Digital / Service split">
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={productMix.productTypes}
                                        dataKey="count"
                                        nameKey="type"
                                        cx="50%" cy="50%"
                                        outerRadius={90}
                                        innerRadius={50}
                                        paddingAngle={3}
                                        label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {productMix.productTypes.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val, name) => [val, name]} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title="Aesthetic Distribution" subtitle="Product categories by listing count">
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={productMix.aesthetics}
                                        dataKey="productCount"
                                        nameKey="aesthetic"
                                        cx="50%" cy="50%"
                                        outerRadius={90}
                                        innerRadius={50}
                                        paddingAngle={3}
                                    >
                                        {productMix.aesthetics.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val, name) => [`${val} products`, name]} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </section>
                )}

                {/* ── SECTION 5: ORDER FUNNEL BAR CHART ── */}
                {orderFunnel && (
                    <section>
                        <ChartCard title="Order Status Breakdown" subtitle="Count of orders in each status">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={orderFunnel.orderStatuses} layout="vertical"
                                    margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                                    <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                    <YAxis type="category" dataKey="status" tick={{ fill: CHART_THEME.axis, fontSize: 10 }} width={80} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Orders" radius={[0, 3, 3, 0]}>
                                        {orderFunnel.orderStatuses.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </section>
                )}

                {/* ── SECTION 6: GEOGRAPHY — TOP CITIES ── */}
                {geography && (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard title="Top Cities by Buyers" subtitle="Where your buyers are">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={geography.topBuyerCities.slice(0, 8)} layout="vertical"
                                    margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                                    <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                    <YAxis type="category" dataKey="city" tick={{ fill: CHART_THEME.axis, fontSize: 10 }} width={70} />
                                    <Tooltip />
                                    <Bar dataKey="count" name="Buyers" fill="#60A5FA" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title="Top Cities by GMV" subtitle="Where orders are being placed">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={geography.topGmvCities.slice(0, 8)} layout="vertical"
                                    margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                                    <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
                                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                    <YAxis type="category" dataKey="city" tick={{ fill: CHART_THEME.axis, fontSize: 10 }} width={70} />
                                    <Tooltip content={<CustomTooltip prefix="KSh " />} />
                                    <Bar dataKey="gmv" name="GMV" fill="#F5C842" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </section>
                )}

                {/* ── SECTION 7: TOP PERFORMERS TABLES ── */}
                {topPerfs && (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Sellers */}
                        <ChartCard title="Top Sellers by Sales" subtitle="All-time, completed orders">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-500 text-xs border-b border-gray-800">
                                            <th className="text-left pb-2 pr-4">Shop</th>
                                            <th className="text-left pb-2 pr-4">City</th>
                                            <th className="text-right pb-2">Sales</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topPerfs.topSellers.map((s, i) => (
                                            <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                                <td className="py-2 pr-4 text-white font-medium">
                                                    <span className="text-gray-500 mr-2">{i + 1}.</span>{s.shopName}
                                                </td>
                                                <td className="py-2 pr-4 text-gray-400">{s.city || '—'}</td>
                                                <td className="py-2 text-right text-yellow-400 font-semibold">
                                                    KSh {Number(s.totalSales).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </ChartCard>

                        {/* Top Products */}
                        <ChartCard title="Top Products by Revenue" subtitle="Completed orders only">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-500 text-xs border-b border-gray-800">
                                            <th className="text-left pb-2 pr-4">Product</th>
                                            <th className="text-left pb-2 pr-4">Type</th>
                                            <th className="text-right pb-2">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topPerfs.topProducts.map((p, i) => (
                                            <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                                                <td className="py-2 pr-4 text-white font-medium">
                                                    <span className="text-gray-500 mr-2">{i + 1}.</span>{p.name}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize">
                                                        {p.productType}
                                                    </span>
                                                </td>
                                                <td className="py-2 text-right text-green-400 font-semibold">
                                                    KSh {Number(p.totalRevenue).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </ChartCard>
                    </section>
                )}

                {/* ── SECTION 8: REFERRAL PROGRAM PERFORMANCE ── */}
                {referrals && (
                    <section>
                        <SectionTitle subtitle="Seller referral program analytics">Referral Program</SectionTitle>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                            <StatCard title="Sellers with Referral Codes" value={referrals.sellersWithCodes} color="purple" />
                            <StatCard title="Referred Sellers" value={referrals.referredSellers} color="yellow" />
                            <StatCard title="Total Rewards Paid" value={referrals.monthlyRewards.reduce((a, r) => a + r.totalRewards, 0)}
                                prefix="KSh " color="green" />
                        </div>
                        <ChartCard title="Monthly Referral Rewards" subtitle="KES paid out to referrers each month">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={referrals.monthlyRewards} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                                    <XAxis dataKey="label" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip prefix="KSh " />} />
                                    <Bar dataKey="totalRewards" name="Rewards Paid" fill="#A78BFA" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </section>
                )}

                {/* ── SECTION 9: LIVE ACTIVITY FEED ── */}
                <section>
                    <ChartCard title="Recent Activity" subtitle="Latest orders, registrations, and signups">
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {activity.map((item, i) => {
                                const icons = { order: '🛒', seller: '🏪', buyer: '👤' }
                                const colors = { order: 'text-yellow-400', seller: 'text-purple-400', buyer: 'text-blue-400' }
                                const timeAgo = (ts) => {
                                    const diff = Date.now() - new Date(ts)
                                    const mins = Math.floor(diff / 60000)
                                    const hours = Math.floor(diff / 3600000)
                                    const days = Math.floor(diff / 86400000)
                                    if (mins < 60) return `${mins}m ago`
                                    if (hours < 24) return `${hours}h ago`
                                    return `${days}d ago`
                                }

                                return (
                                    <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-800/50">
                                        <span className="text-lg">{icons[item.type]}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${colors[item.type]}`}>{item.description}</p>
                                            <p className="text-gray-600 text-xs mt-0.5">{timeAgo(item.timestamp)}</p>
                                        </div>
                                        {item.value && (
                                            <span className="text-yellow-400 text-sm font-semibold whitespace-nowrap">
                                                KSh {Number(item.value).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </ChartCard>
                </section>
            </main>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/5 py-8 text-center bg-black/40 backdrop-blur-md mt-12">
                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                    Byblos Marketing Intelligence • Read-only • {new Date().getFullYear()}
                </p>
            </footer>
        </div>
    )
}
