export function ChartCard({ title, subtitle, children, className = '' }) {
    return (
        <div className={`bg-white border border-stone-200 rounded-2xl p-4 md:p-6 shadow-[0_18px_45px_rgba(17,17,17,0.08)] transition-all hover:border-yellow-300 ${className}`}>
            <div className="mb-4 md:mb-6">
                <h3 className="text-sm md:text-base font-semibold text-stone-950 tracking-tight leading-none mb-1 md:mb-1.5">{title}</h3>
                {subtitle && <p className="text-stone-500 text-[10px] md:text-xs font-medium">{subtitle}</p>}
            </div>
            <div className="relative">
                {children}
            </div>
        </div>
    )
}
