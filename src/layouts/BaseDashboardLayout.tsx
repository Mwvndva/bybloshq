import React, { ReactNode } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalAuth, UserRole } from '@/contexts/GlobalAuthContext';

// ============================================================================
// TYPES
// ============================================================================

export interface NavigationItem {
    label: string;
    path: string;
    icon?: React.ComponentType<{ className?: string }>;
    badge?: string | number;
}

export interface BaseDashboardLayoutProps {
    role: UserRole;
    title: string;
    subtitle?: string;
    navigationItems?: NavigationItem[];
    showBackButton?: boolean;
    backButtonPath?: string;
    backButtonLabel?: string;
    showSidebar?: boolean;
    sidebarHeader?: ReactNode;
    headerActions?: ReactNode;
    children?: ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BaseDashboardLayout({
    role,
    title,
    subtitle,
    navigationItems = [],
    showBackButton = true,
    backButtonPath = '/',
    backButtonLabel = 'Back to Home',
    showSidebar = false,
    sidebarHeader,
    headerActions,
    children,
}: BaseDashboardLayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useGlobalAuth();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    // Check if current path matches navigation item
    const isActivePath = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    // Handle logout
    const handleLogout = () => {
        logout();
    };

    // Handle back navigation
    const handleBack = () => {
        navigate(backButtonPath);
    };

    return (
        <div className="min-h-screen bg-[#000000] flex">
            {/* Sidebar (if enabled) */}
            {showSidebar && (
                <>
                    {/* Mobile sidebar overlay */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* Sidebar */}
                    <aside
                        className={cn(
                            'fixed lg:sticky top-0 left-0 h-screen w-64 bg-black/80 backdrop-blur-md border-r border-white/10 z-50 transition-transform duration-300 ease-in-out',
                            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                        )}
                    >
                        {/* Sidebar Header */}
                        <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
                            {sidebarHeader || (
                                <h2 className="text-xl font-black text-white tracking-tight">
                                    {title}
                                </h2>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden text-gray-300 hover:text-white hover:bg-white/5"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                            {navigationItems.map((item, index) => {
                                const Icon = item.icon;
                                const isActive = isActivePath(item.path);

                                return (
                                    <Link
                                        key={index}
                                        to={item.path}
                                        onClick={() => setSidebarOpen(false)}
                                        className={cn(
                                            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                                            isActive
                                                ? 'bg-white/10 text-white font-semibold'
                                                : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        )}
                                    >
                                        {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
                                        <span className="flex-1">{item.label}</span>
                                        {item.badge && (
                                            <span className="px-2 py-0.5 text-xs font-bold bg-yellow-400 text-black rounded-full">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Sidebar Footer */}
                        <div className="p-4 border-t border-white/10">
                            <Button
                                variant="outline"
                                onClick={handleLogout}
                                className="w-full border-white/10 text-white hover:bg-white/5 hover:border-white/20 rounded-xl"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Log out
                            </Button>
                        </div>
                    </aside>
                </>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
                    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="relative flex items-center justify-between h-20">
                            {/* Left: Menu/Back Button */}
                            <div className="flex-1 flex items-center gap-2">
                                {showSidebar && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSidebarOpen(true)}
                                        className="lg:hidden text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-xl px-3 py-2 -ml-3"
                                    >
                                        <Menu className="h-5 w-5" />
                                    </Button>
                                )}
                                {showBackButton && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleBack}
                                        className="text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-xl px-3 py-2 text-sm -ml-3"
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        <span className="hidden sm:inline">{backButtonLabel}</span>
                                        <span className="sm:hidden">Back</span>
                                    </Button>
                                )}
                            </div>

                            {/* Center: Title */}
                            <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[50%]">
                                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                                    {title}
                                </h1>
                                {subtitle && (
                                    <p className="hidden sm:block text-xs sm:text-sm text-gray-300 font-medium truncate">
                                        {subtitle}
                                    </p>
                                )}
                            </div>

                            {/* Right: Actions/Logout */}
                            <div className="flex-1 flex items-center justify-end gap-2">
                                {headerActions}
                                {!showSidebar && (
                                    <Button
                                        variant="outline"
                                        onClick={handleLogout}
                                        className="inline-flex items-center gap-2 border-white/10 text-white hover:bg-white/5 hover:border-white/20 rounded-xl h-9 sm:h-10 px-3 sm:px-4 -mr-3"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span className="hidden sm:inline">Log out</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 relative overflow-y-auto focus:outline-none">
                    {children || <Outlet />}
                </main>
            </div>
        </div>
    );
}

// ============================================================================
// ROLE-SPECIFIC LAYOUT WRAPPERS (for convenience)
// ============================================================================

export function BuyerDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="buyer" {...props} />;
}

export function SellerDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="seller" {...props} />;
}

export function OrganizerDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="organizer" {...props} />;
}

export function AdminDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="admin" {...props} />;
}
