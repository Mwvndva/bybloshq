import React from 'react';

export interface LoadingScreenProps {
    message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
    return (
        <div className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-50 dark:bg-black px-6 text-slate-950 dark:text-white transition-colors duration-200">
            <div className="flex items-center gap-3 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] px-5 py-3 shadow-xl dark:shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-400" />
                <span className="text-sm font-semibold text-slate-800 dark:text-white/80">
                    {message}
                </span>
            </div>
        </div>
    );
}

export default LoadingScreen;
