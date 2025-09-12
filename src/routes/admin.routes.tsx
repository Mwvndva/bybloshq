import { RouteObject, createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import NewAdminDashboard from '@/pages/admin/NewDashboardPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Admin routes configuration
export const adminRoutes: RouteObject[] = [
  {
    path: 'login',
    element: <AdminLoginPage />,
  },
  {
    path: 'dashboard',
    element: <NewAdminDashboard />,
  },
  {
    path: '',
    element: <NewAdminDashboard />, // Default to new dashboard
  },
];

// Create admin layout with providers
const AdminLayout = () => (
  <AdminAuthProvider>
    <TooltipProvider>
      <Toaster />
      <Outlet />
    </TooltipProvider>
  </AdminAuthProvider>
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
  router: createBrowserRouter(adminRoutesWithLayout),
};
