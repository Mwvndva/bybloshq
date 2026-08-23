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
            className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#090909] px-6 text-white"
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            {/* Animated Loading pill */}
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-6 py-3.5 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
                <span className="h-3 w-3 animate-ping rounded-full bg-yellow-400" />
                <span className="text-sm font-bold tracking-wide text-white/90">
                    {message}
                </span>
            </div>
        </div>
    );
}

export default LoadingScreen;
