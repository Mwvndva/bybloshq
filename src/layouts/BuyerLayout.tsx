import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Heart, ShoppingBag, User, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BuyerLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { key: 'home', label: 'Home', Icon: Home, path: '/' },
        { key: 'shop', label: 'Shop', Icon: Store, path: '/buyer/dashboard' },
        { key: 'wishlist', label: 'Wishlist', Icon: Heart, path: '/buyer/wishlist' },
        { key: 'orders', label: 'Orders', Icon: ShoppingBag, path: '/buyer/orders' },
        { key: 'profile', label: 'Profile', Icon: User, path: '/buyer/profile' },
    ];

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="flex flex-col min-h-screen bg-black">
            <main className="flex-1 pb-20">
                <Outlet />
            </main>

            {/* Global Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-lg border-t border-white/5 flex items-stretch z-50 px-2 lg:hidden">
                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <button
                            key={item.key}
                            onClick={() => navigate(item.path)}
                            className={cn(
                                "flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200",
                                active ? "text-yellow-400" : "text-white/40 hover:text-white"
                            )}
                        >
                            <item.Icon className={cn("h-5 w-5", active && "animate-scale-in")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Desktop Navigation (Internal to Layout) */}
            <div className="hidden lg:block">
                {/* We can decide if we want a top nav or side nav for desktop later, 
                   but the user specifically asked for bottom nav. */}
            </div>
        </div>
    );
}

export default BuyerLayout;
