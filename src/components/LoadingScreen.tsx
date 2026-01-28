import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen = ({ message = 'Loading Byblos...' }: LoadingScreenProps) => {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#000000]">
            <div className="flex flex-col items-center gap-6 p-8">
                <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
                </div>
                <p className="text-base font-semibold text-white animate-pulse">{message}</p>
            </div>
        </div>
    );
};
