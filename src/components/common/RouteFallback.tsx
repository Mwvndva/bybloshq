/**
 * RouteFallback — Byblos-branded loading spinner for Suspense route boundaries.
 * Replaces all inline LoadingFallback / Loader / bare Loader2 components
 * scattered across route files.
 */
export function RouteFallback() {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
        </div>
    );
}

export default RouteFallback;
