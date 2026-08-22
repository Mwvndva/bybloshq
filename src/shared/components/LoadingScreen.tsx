import React from 'react';

export interface LoadingScreenProps {
    message?: string;
}

/**
 * Full-screen loading state shown during:
 * - Initial cold-start auth revalidation
 * - Lazy route loading
 *
 * Always rendered in dark mode to match the app's dark homescreen,
 * preventing a white flash before the theme is applied.
 */
export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
    return (
        <div
            className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#090909] px-6"
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            {/* Animated logo mark */}
            <div className="mb-8 flex items-center justify-center">
                <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-2xl bg-yellow-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-yellow-400">
                        <span className="text-2xl font-black text-black">B</span>
                    </div>
                </div>
            </div>

            {/* Loading pill */}
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-400" />
                <span className="text-sm font-semibold text-white/75">
                    {message}
                </span>
            </div>
        </div>
    );
}

export default LoadingScreen;
