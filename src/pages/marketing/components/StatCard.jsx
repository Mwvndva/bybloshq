export function StatCard({ title, value, subtitle, trend, color = 'yellow', prefix = '', suffix = '' }) {
    const colors = {
        yellow: 'border-yellow-200 bg-yellow-50',
        green: 'border-emerald-100 bg-emerald-50',
        blue: 'border-stone-200 bg-white',
        purple: 'border-stone-200 bg-white',
        red: 'border-red-100 bg-red-50',
    }

    const formatValue = (v) => {
        if (typeof v !== 'number') return v
        if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M${suffix}`
        if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(1)}K${suffix}`
        return `${prefix}${v.toLocaleString()}${suffix}`
    }

    return (
        <div className={`border rounded-2xl p-4 md:p-5 shadow-[0_18px_45px_rgba(17,17,17,0.08)] transition-all hover:border-yellow-300 ${colors[color]}`}>
            <p className="text-stone-500 text-xs font-semibold mb-1.5 md:mb-2">{title}</p>
            <p className="text-xl md:text-2xl font-semibold text-stone-950 tracking-tight">{formatValue(value)}</p>
            {subtitle && <p className="text-stone-500 text-[10px] md:text-xs mt-1 font-medium">{subtitle}</p>}
            {trend !== undefined && (
                <div className="flex items-center gap-1.5 mt-2 md:mt-3">
                    <span className={`text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded ${trend >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                    <span className="text-stone-500 text-[9px] md:text-[10px] font-semibold">vs last month</span>
                </div>
            )}
        </div>
    )
}
