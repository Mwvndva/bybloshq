/**
 * Shared lightweight fallback for route and app-level lazy loading.
 */
interface RouteFallbackProps {
    message?: string;
}

export function RouteFallback({ message = 'Loading' }: RouteFallbackProps) {
    return (
        <div className="min-h-[45dvh] w-full bg-white flex items-center justify-center px-6">
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {message}
                </span>
            </div>
        </div>
    );
}

export default RouteFallback;
