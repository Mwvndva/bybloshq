import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LoadingScreen } from '../LoadingScreen';
import { useGlobalAuth } from '@/contexts/GlobalAuthContext';

/**
 * A layout for components that manage their own Header/Footer (like BuyerDashboard)
 * but still require authentication and basic app shell logic.
 */
const SimpleBuyerLayout = () => {
    const { isAuthenticated, isGuest, initializing } = useGlobalAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!initializing && (!isAuthenticated || isGuest)) {
            navigate('/');
        }
    }, [isAuthenticated, isGuest, initializing, navigate]);

    if (initializing || !isAuthenticated || isGuest) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            <main className="flex-1 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
};

export default SimpleBuyerLayout;
