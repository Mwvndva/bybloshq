export function ChartCard({ title, subtitle, children, className = '' }) {
    return (
        <div className={`unified-card p-6 transition-all hover:bg-white/[0.08] ${className}`}>
            <div className="mb-4 md:mb-6">
                <h3 className="text-sm md:text-base font-black text-white tracking-tight leading-none mb-1 md:mb-1.5 uppercase italic">{title}</h3>
                {subtitle && <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-widest">{subtitle}</p>}
            </div>
            <div className="relative">
                {children}
            </div>
        </div>
    )
}
