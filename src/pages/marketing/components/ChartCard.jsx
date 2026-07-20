export function ChartCard({ title, subtitle, children, className = '' }) {
    return (
        <div className={`bg-[#0A0A0A]/70 border border-white/10 rounded-2xl p-4 md:p-6 shadow-xl transition-all hover:border-yellow-500/30 ${className}`}>
            <div className="mb-4 md:mb-6">
                <h3 className="text-sm md:text-base font-semibold text-white tracking-tight leading-none mb-1 md:mb-1.5">{title}</h3>
                {subtitle && <p className="text-gray-400 text-[10px] md:text-xs font-medium">{subtitle}</p>}
            </div>
            <div className="relative">
                {children}
            </div>
        </div>
    )
}
