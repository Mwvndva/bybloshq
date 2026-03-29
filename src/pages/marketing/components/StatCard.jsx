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
        <div className={`border rounded-xl p-5 ${colors[color]}`}>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{formatValue(value)}</p>
            {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
            {trend !== undefined && (
                <p className={`text-xs mt-2 font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
                </p>
            )}
        </div>
    )
}
