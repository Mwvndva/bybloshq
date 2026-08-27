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
            className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[var(--byblos-bg,#000000)] px-6 text-[var(--byblos-text,#f5f5f5)] transition-colors duration-200"
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            {/* Animated Loading pill */}
            <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.06] backdrop-blur-md px-6 py-3.5 shadow-[0_18px_45px_rgba(0,0,0,0.08)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
                <span className="h-3 w-3 animate-ping rounded-full bg-yellow-400" />
                <span className="text-sm font-bold tracking-wide text-slate-800 dark:text-white/90">
                    {message}
                </span>
            </div>
        </div>
    );
}

export default LoadingScreen;
