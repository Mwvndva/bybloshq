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
    const { logout, isAuthenticated } = useGlobalAuth();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    React.useEffect(() => {
        document.body.classList.add('dashboard-active');
        return () => {
            document.body.classList.remove('dashboard-active');
        };
    }, []);

    // Check if current path matches navigation item
    const isActivePath = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    // Determine if logout button should be shown
    const authRoutes = ['/login', '/register', '/seller/login', '/seller/register'];
    const isAuthRoute = authRoutes.includes(location.pathname);
    const shouldShowLogout = isAuthenticated && !isAuthRoute;

    // Handle logout
    const handleLogout = () => {
        logout();
    };

    // Handle back navigation
    const handleBack = () => {
        navigate(backButtonPath);
    };

    return (
        <div className="dashboard-layout min-h-screen bg-slate-50 text-slate-950 flex">
            {/* Skip to Content for Accessibility */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-yellow-500 focus:text-black focus:font-bold focus:rounded-lg"
            >
                Skip to content
            </a>

            {/* Sidebar (if enabled) */}
            {showSidebar && (
                <>
                    {/* Mobile sidebar overlay */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                            aria-hidden="true"
                        />
                    )}

                    {/* Sidebar */}
                    <aside
                        className={cn(
                            'fixed lg:sticky top-0 left-0 h-screen w-64 bg-white/95 backdrop-blur-md border-r border-slate-200 z-50 transition-transform duration-300 ease-in-out',
                            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                        )}
                        aria-label={`${role} sidebar navigation`}
                    >
                        {/* Sidebar Header */}
                        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200">
                            {sidebarHeader || (
                                <h2 className="text-xl font-black text-slate-950 tracking-tight">
                                    {title}
                                </h2>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden text-slate-500 hover:text-slate-950 hover:bg-slate-100"
                                aria-label="Close sidebar"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Navigation Items */}
                        <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main sidebar navigation">
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
                                                ? 'bg-slate-100 text-slate-950 font-semibold'
                                                : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                                        )}
                                        aria-current={isActive ? 'page' : undefined}
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
                        <div className="p-4 border-t border-slate-200">
                            {shouldShowLogout && (
                                <Button
                                    variant="outline"
                                    onClick={handleLogout}
                                    className="w-full border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 rounded-xl"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Log out
                                </Button>
                            )}
                        </div>
                    </aside>
                </>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header
                    className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30"
                    role="banner"
                >
                    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="relative flex items-center justify-between h-20">
                            {/* Left: Menu/Back Button */}
                            <div className="flex-1 flex items-center gap-2">
                                {showSidebar && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSidebarOpen(true)}
                                        className="lg:hidden text-slate-500 hover:text-slate-950 hover:bg-slate-100 transition-all duration-200 rounded-xl px-3 py-2 -ml-3"
                                        aria-label="Open sidebar"
                                    >
                                        <Menu className="h-5 w-5" />
                                    </Button>
                                )}
                                {showBackButton && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleBack}
                                        className="text-slate-500 hover:text-slate-950 hover:bg-slate-100 transition-all duration-200 rounded-xl px-3 py-2 text-sm -ml-3"
                                        aria-label={backButtonLabel}
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        <span className="hidden sm:inline">{backButtonLabel}</span>
                                        <span className="sm:hidden">Back</span>
                                    </Button>
                                )}
                            </div>

                            {/* Center: Title */}
                            <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[50%]">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight truncate">
                                    {title}
                                </h1>
                                {subtitle && (
                                    <p className="hidden sm:block text-xs sm:text-sm text-slate-500 font-medium truncate">
                                        {subtitle}
                                    </p>
                                )}
                            </div>

                            {/* Right: Actions/Logout */}
                            <div className="flex-1 flex items-center justify-end gap-2">
                                {headerActions}
                                {!showSidebar && shouldShowLogout && (
                                    <Button
                                        variant="outline"
                                        onClick={handleLogout}
                                        className="inline-flex items-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 rounded-xl h-9 sm:h-10 px-3 sm:px-4 -mr-3"
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
                <main
                    id="main-content"
                    className="flex-1 relative overflow-y-auto focus:outline-none"
                    role="main"
                >
                    {children || <Outlet />}
                </main>
            </div>
        </div>
    );
}

// ============================================================================
// ROLE-SPECIFIC LAYOUT WRAPPERS
// ============================================================================

export function BuyerDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="buyer" {...props} />;
}

export function SellerDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="seller" {...props} />;
}

export function AdminDashboardLayout(props: Omit<BaseDashboardLayoutProps, 'role'>) {
    return <BaseDashboardLayout role="admin" {...props} />;
}
