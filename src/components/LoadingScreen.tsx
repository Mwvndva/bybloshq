import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen = () => {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-yellow-400" />
                <p className="text-sm font-medium text-gray-500 animate-pulse">Loading Byblos...</p>
            </div>
        </div>
    );
};
