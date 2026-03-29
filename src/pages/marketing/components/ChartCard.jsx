export function ChartCard({ title, subtitle, children, className = '' }) {
    return (
        <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </div>
    )
}
