import { Suspense } from 'react';
import { RouteObject, Outlet } from 'react-router-dom';
import { AdminProtectedRoute } from '@/app/router/AppProtectedRoute';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';

const newAdminDashboard = safeLazy(() => import('@/features/admin/pages/NewDashboardPage'));
const adminLoginPage = safeLazy(() => import('@/features/admin/pages/AdminLoginPage').then(m => m.AdminLoginPage));

// Admin routes configuration
export const adminRoutes: RouteObject[] = [
  {
    path: 'login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        {(() => { const Component = adminLoginPage; return <Component />; })()}
      </Suspense>
    ),
  },
  {
    path: 'dashboard',
    element: (
      <AdminProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          {(() => { const Component = newAdminDashboard; return <Component />; })()}
        </Suspense>
      </AdminProtectedRoute>
    ),
  },
  {
    path: '',
    element: (
      <AdminProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          {(() => { const Component = newAdminDashboard; return <Component />; })()}
        </Suspense>
      </AdminProtectedRoute>
    ),
  },
];

// Create admin layout (no auth provider needed - GlobalAuthProvider handles all roles)
const adminLayout = () => (
  <Outlet />
);

// Create admin routes with layout
const adminRoutesWithLayout: RouteObject[] = [
  {
    path: '/admin',
    element: {
      get $$typeof() { return Symbol.for('react.element'); },
      type: adminLayout,
      props: {},
      key: null,
      ref: null
    } as unknown as import('react').ReactElement,
    children: adminRoutes,
  },
];

// Create and export the admin router
export const adminRouter = {
  routes: adminRoutesWithLayout,
};


