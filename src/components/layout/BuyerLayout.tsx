import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Header from '../Header';
import Footer from '../Footer';
import { LoadingScreen } from '../LoadingScreen';
import { useGlobalAuth } from '@/contexts/GlobalAuthContext';

const BuyerLayout = () => {
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
        <div className="min-h-screen bg-[#0a0a0a]">
            <Header />
            <main className="flex-1">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

export default BuyerLayout;
