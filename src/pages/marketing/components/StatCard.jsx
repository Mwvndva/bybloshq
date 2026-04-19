export function StatCard({ title, value, subtitle, trend, color = 'yellow', prefix = '', suffix = '' }) {
    const colors = {
        yellow: 'border-yellow-500/30 bg-yellow-500/5',
        green: 'border-green-500/30 bg-green-500/5',
        blue: 'border-blue-500/30 bg-blue-500/5',
        purple: 'border-purple-500/30 bg-purple-500/5',
        red: 'border-red-500/30 bg-red-500/5',
    }

    const formatValue = (v) => {
        if (typeof v !== 'number') return v
        if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M${suffix}`
        if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(1)}K${suffix}`
        return `${prefix}${v.toLocaleString()}${suffix}`
    }

    return (
        <div className={`backdrop-blur-md border rounded-xl p-4 md:p-5 shadow-xl transition-all hover:bg-black/20 ${colors[color]}`}>
            <p className="text-gray-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1.5 md:mb-2 opacity-80">{title}</p>
            <p className="text-xl md:text-2xl font-black text-white tracking-tight">{formatValue(value)}</p>
            {subtitle && <p className="text-gray-400/60 text-[10px] md:text-xs mt-1 font-medium">{subtitle}</p>}
            {trend !== undefined && (
                <div className="flex items-center gap-1.5 mt-2 md:mt-3">
                    <span className={`text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded ${trend >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                    <span className="text-gray-500 text-[9px] md:text-[10px] uppercase font-black tracking-tighter">vs last month</span>
                </div>
            )}
        </div>
    )
}
