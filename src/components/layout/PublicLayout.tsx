import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../Header';
import Footer from '../Footer';
import { LoadingScreen } from '../LoadingScreen';
import { useGlobalAuth } from '@/contexts/GlobalAuthContext';

const PublicLayout = () => {
    const { initializing } = useGlobalAuth();

    if (initializing) {
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

export default PublicLayout;
