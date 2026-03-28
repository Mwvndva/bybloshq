import { Suspense } from 'react';
import { RouteObject, Outlet } from 'react-router-dom';
import { AdminProtectedRoute } from '@/components/auth/AppProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

const NewAdminDashboard = safeLazy(() => import('@/pages/admin/NewDashboardPage'));
const AdminLoginPage = safeLazy(() => import('@/pages/admin/AdminLoginPage').then(m => m.AdminLoginPage));

// Admin routes configuration
export const adminRoutes: RouteObject[] = [
  {
    path: 'login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <AdminLoginPage />
      </Suspense>
    ),
  },
  {
    path: 'dashboard',
    element: (
      <AdminProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <NewAdminDashboard />
        </Suspense>
      </AdminProtectedRoute>
    ),
  },
  {
    path: '',
    element: (
      <AdminProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <NewAdminDashboard />
        </Suspense>
      </AdminProtectedRoute>
    ),
  },
];

// Create admin layout (no auth provider needed - GlobalAuthProvider handles all roles)
const AdminLayout = () => (
  <TooltipProvider>
    <Toaster />
    <Outlet />
  </TooltipProvider>
);

// Create admin routes with layout
const adminRoutesWithLayout: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: adminRoutes,
  },
];

// Create and export the admin router
export const adminRouter = {
  routes: adminRoutesWithLayout,
};
