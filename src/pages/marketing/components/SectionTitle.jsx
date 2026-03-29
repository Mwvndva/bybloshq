export function SectionTitle({ children, subtitle }) {
    return (
        <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">{children}</h2>
            {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
    )
}
