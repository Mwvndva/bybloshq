export function SectionTitle({ children, subtitle }) {
    return (
        <div className="mb-6 pt-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                {children}
                <div className="h-[1px] flex-grow bg-gradient-to-r from-white/10 to-transparent"></div>
            </h2>
            {subtitle && <p className="text-gray-500 text-xs font-medium mt-1">{subtitle}</p>}
        </div>
    )
}
