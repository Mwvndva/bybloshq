export function ChartCard({ title, subtitle, children, className = '' }) {
    return (
        <div className={`bg-black/40 backdrop-blur-lg border border-white/5 rounded-2xl p-6 shadow-2xl transition-all hover:bg-black/50 ${className}`}>
            <div className="mb-6">
                <h3 className="text-base font-bold text-white tracking-tight leading-none mb-1.5">{title}</h3>
                {subtitle && <p className="text-gray-500 text-xs font-medium">{subtitle}</p>}
            </div>
            <div className="relative">
                {children}
            </div>
        </div>
    )
}
