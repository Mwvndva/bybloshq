/**
 * Shared lightweight fallback for route and app-level lazy loading.
 */
interface RouteFallbackProps {
    message?: string;
}

export function RouteFallback({ message = 'Loading' }: RouteFallbackProps) {
    return (
        <div className="min-h-[100dvh] w-full bg-black text-white flex items-center justify-center px-6">
            <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-3 shadow-sm shadow-black/40">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    {message}
                </span>
            </div>
        </div>
    );
}

export default RouteFallback;
