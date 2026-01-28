import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useGlobalAuth, UserRole } from '@/contexts/GlobalAuthContext';
import { Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface AppProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    redirectTo?: string;
    fallback?: React.ReactNode;
}

// ============================================================================
// LOADING COMPONENT
// ============================================================================

function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
    return (
        <div className="min-h-screen bg-[#000000] flex items-center justify-center">
            <div className="text-center space-y-6">
                <Loader2 className="h-16 w-16 text-yellow-400 animate-spin mx-auto" />
                <p className="text-white text-lg font-medium">{message}</p>
            </div>
        </div>
    );
}

// ============================================================================
// PROTECTED ROUTE COMPONENT
// ============================================================================

export function AppProtectedRoute({
    children,
    allowedRoles,
    redirectTo,
    fallback,
}: AppProtectedRouteProps) {
    const { user, isAuthenticated, isLoading, role } = useGlobalAuth();
    const location = useLocation();

    // Show loading state while checking authentication
    if (isLoading) {
        return fallback || <LoadingScreen message="Checking authentication..." />;
    }

    // Not authenticated - redirect to appropriate login page
    if (!isAuthenticated || !user) {
        // Determine which login page to redirect to based on the current path
        const getLoginPath = (): string => {
            if (redirectTo) return redirectTo;

            const path = location.pathname;
            if (path.startsWith('/buyer')) return '/buyer/login';
            if (path.startsWith('/seller')) return '/seller/login';
            if (path.startsWith('/organizer')) return '/organizer/login';
            if (path.startsWith('/admin')) return '/admin/login';

            // Default to buyer login
            return '/buyer/login';
        };

        return <Navigate to={getLoginPath()} state={{ from: location }} replace />;
    }

    // Authenticated but wrong role - redirect to their own dashboard
    if (role && !allowedRoles.includes(role)) {
        const dashboardPath = `/${role}/dashboard`;

        // Show unauthorized message (optional - could also just redirect silently)
        console.warn(`[AppProtectedRoute] User with role "${role}" attempted to access route requiring roles: ${allowedRoles.join(', ')}`);

        return <Navigate to={dashboardPath} replace />;
    }

    // Authenticated and authorized - render children
    return <>{children}</>;
}

// ============================================================================
// ROLE-SPECIFIC ROUTE WRAPPERS (for convenience)
// ============================================================================

export function BuyerProtectedRoute({ children }: { children: React.ReactNode }) {
    return <AppProtectedRoute allowedRoles={['buyer']}>{children}</AppProtectedRoute>;
}

export function SellerProtectedRoute({ children }: { children: React.ReactNode }) {
    return <AppProtectedRoute allowedRoles={['seller']}>{children}</AppProtectedRoute>;
}

export function OrganizerProtectedRoute({ children }: { children: React.ReactNode }) {
    return <AppProtectedRoute allowedRoles={['organizer']}>{children}</AppProtectedRoute>;
}

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
    return <AppProtectedRoute allowedRoles={['admin']}>{children}</AppProtectedRoute>;
}

// Multi-role protection (e.g., for shared admin/organizer pages)
export function MultiRoleProtectedRoute({
    children,
    roles,
}: {
    children: React.ReactNode;
    roles: UserRole[];
}) {
    return <AppProtectedRoute allowedRoles={roles}>{children}</AppProtectedRoute>;
}
