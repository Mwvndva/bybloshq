import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useGlobalAuth, UserRole } from '@/contexts/GlobalAuthContext';
import { RouteFallback } from '@/components/common/RouteFallback';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AppProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    redirectTo?: string;
    fallback?: React.ReactNode;
}

// ─── Protected Route ──────────────────────────────────────────────────────────
export function AppProtectedRoute({
    children,
    allowedRoles,
    redirectTo,
    fallback,
}: AppProtectedRouteProps) {
    const { user, isAuthenticated, isLoading, role } = useGlobalAuth();
    const location = useLocation();

    // Show branded fallback while auth state is resolving
    if (isLoading) {
        return <>{fallback ?? <RouteFallback />}</>;
    }

    // Not authenticated → redirect to appropriate login page
    if (!isAuthenticated || !user) {
        const getLoginPath = (): string => {
            if (redirectTo) return redirectTo;
            const path = location.pathname;
            if (path.startsWith('/buyer')) return '/buyer/login';
            if (path.startsWith('/seller')) return '/seller/login';
            if (path.startsWith('/organizer')) return '/organizer/login';
            if (path.startsWith('/admin')) return '/admin/login';
            return '/buyer/login';
        };

        // Prevent redirect loop: if already on the login page, don't add `from` state
        const loginPath = getLoginPath();
        const isAlreadyOnLoginPage =
            location.pathname === loginPath ||
            location.pathname.includes('/login') ||
            location.pathname.includes('/register');

        return (
            <Navigate
                to={loginPath}
                state={isAlreadyOnLoginPage ? undefined : { from: location }}
                replace
            />
        );
    }

    // Wrong role → redirect to own dashboard
    if (role && !allowedRoles.includes(role)) {
        // Explicit cross-role check: a seller with a buyerProfile may access buyer routes
        const sellerAccessingBuyerRoute =
            role === 'seller' && allowedRoles.includes('buyer') && user.profile != null;

        if (sellerAccessingBuyerRoute) {
            return <>{children}</>;
        }

        return <Navigate to={`/${role}/dashboard`} replace />;
    }

    return <>{children}</>;
}

// ─── Convenience Wrappers ──────────────────────────────────────────────────────
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

export function MultiRoleProtectedRoute({
    children,
    roles,
}: {
    children: React.ReactNode;
    roles: UserRole[];
}) {
    return <AppProtectedRoute allowedRoles={roles}>{children}</AppProtectedRoute>;
}
