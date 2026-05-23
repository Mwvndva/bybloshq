/**
 * Shared lightweight fallback for route and app-level lazy loading.
 */
interface RouteFallbackProps {
    message?: string;
}

export function RouteFallback({ message = 'Loading' }: RouteFallbackProps) {
    return (
        <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#f8f7f2] px-6 text-stone-950">
            <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white px-5 py-3 shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-400" />
                <span className="text-sm font-semibold text-stone-800">
                    {message}
                </span>
            </div>
        </div>
    );
}

export default RouteFallback;
