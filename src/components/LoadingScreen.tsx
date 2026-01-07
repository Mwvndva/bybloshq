import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
            <div className="text-center space-y-6 p-8">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg animate-pulse">
                    <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-black mb-3">Byblos Atelier</h3>
                    <p className="text-gray-600 text-lg font-medium">Curating your experience...</p>
                </div>
            </div>
        </div>
    );
};
