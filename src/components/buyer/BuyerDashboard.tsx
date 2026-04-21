import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, Store, User, Settings, LayoutDashboard } from 'lucide-react';
import { BuyerDashboardLayout } from '@/layouts/BaseDashboardLayout';
import OrdersSection from '@/components/orders/OrdersSection';
import WishlistSection from './WishlistSection';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBuyerAuth } from '@/contexts/GlobalAuthContext';

const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/buyer/dashboard' },
    { id: 'orders', label: 'My Orders', icon: ShoppingBag, path: '/buyer/orders' },
    { id: 'shops', label: 'My Shops', icon: Store, path: '/buyer/shops' },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, path: '/buyer/wishlist' },
    { id: 'profile', label: 'Profile', icon: User, path: '/buyer/profile' },
];

const glassCardStyle: React.CSSProperties = {
    background: 'rgba(17, 17, 17, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)'
};

export default function BuyerDashboard() {
    const { user, isAuthenticated } = useBuyerAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Determine active tab based on path
    const activeTab = location.pathname.split('/').pop() || 'dashboard';

    const renderContent = () => {
        switch (activeTab) {
            case 'orders':
                return <OrdersSection />;
            case 'wishlist':
                return <WishlistSection />;
            case 'dashboard':
            default:
                return (
                    <div className="space-y-6">
                        {/* Welcome Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                    Hello, <span className="text-yellow-500">{user?.fullName?.split(' ')[0] || 'Buyer'}</span>!
                                </h1>
                                <p className="text-gray-400 text-sm sm:text-base mt-1">Welcome back to your dashboard.</p>
                            </div>
                            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-4 py-1.5 h-auto text-sm font-bold self-start md:self-center">
                                Buyer Account
                            </Badge>
                        </div>

                        {/* Summary Stats Placeholder or Quick Actions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Card className="border-0 overflow-hidden group cursor-pointer" style={glassCardStyle} onClick={() => navigate('/buyer/orders')}>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                                            <ShoppingBag className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-400 capitalize">Recent Orders</p>
                                            <h3 className="text-xl font-bold text-white mt-0.5">View Activity</h3>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-0 overflow-hidden group cursor-pointer" style={glassCardStyle} onClick={() => navigate('/buyer/wishlist')}>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform">
                                            <Heart className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-400 capitalize">Wishlist</p>
                                            <h3 className="text-xl font-bold text-white mt-0.5">Your Favorites</h3>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-0 overflow-hidden group cursor-pointer" style={glassCardStyle} onClick={() => navigate('/buyer/profile')}>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-400 capitalize">My Profile</p>
                                            <h3 className="text-xl font-bold text-white mt-0.5">Manage Account</h3>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Orders Section */}
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white">Recent Orders</h2>
                                <Button
                                    variant="link"
                                    className="text-yellow-500 hover:text-yellow-400 font-bold p-0 h-auto"
                                    onClick={() => navigate('/buyer/orders')}
                                >
                                    See all orders
                                </Button>
                            </div>
                            <OrdersSection />
                        </div>
                    </div>
                );
        }
    };

    return (
        <BuyerDashboardLayout
            activeTab={activeTab}
            menuItems={menuItems}
            user={{
                name: user?.fullName || 'Buyer',
                email: user?.email || '',
                avatar: undefined,
            }}
        >
            {renderContent()}
        </BuyerDashboardLayout>
    );
}
