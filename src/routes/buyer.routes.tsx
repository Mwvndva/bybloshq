import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { BuyerRoute } from './BuyerRoute';
import { Loader2 } from 'lucide-react';

// Lazy load components with default exports
const BuyerLogin = lazy(() => import('@/components/buyer/BuyerLogin').then(module => ({ default: module.BuyerLogin })));
const BuyerRegister = lazy(() => import('@/components/buyer/BuyerRegister').then(module => ({ default: module.BuyerRegister })));
const BuyerForgotPassword = lazy(() => import('@/components/buyer/BuyerForgotPassword').then(module => ({ default: module.BuyerForgotPassword })));
const BuyerResetPassword = lazy(() => import('@/components/buyer/BuyerResetPassword').then(module => ({ default: module.BuyerResetPassword })));
const BuyerDashboard = lazy(() => import('@/components/buyer/BuyerDashboard').then(module => ({ default: module.BuyerDashboard })));

// Simple loading component
const Loader = () => (
  <div className="flex justify-center items-center min-h-screen">
    <Loader2 className="h-12 w-12 animate-spin text-primary" />
  </div>
);

// Buyer routes
export const buyerRoutes = [
  // Public routes - don't require authentication
  {
    path: '/buyer/register',
    element: (
      <Suspense fallback={<Loader />}>
        <BuyerRegister />
      </Suspense>
    ),
  },
  {
    path: '/buyer/login',
    element: (
      <Suspense fallback={<Loader />}>
        <BuyerLogin />
      </Suspense>
    ),
  },
  // Password reset routes
  // Password reset routes
  {
    path: '/buyer/forgot-password',
    element: (
      <Suspense fallback={<Loader />}>
        <BuyerForgotPassword />
      </Suspense>
    ),
  },
  {
    path: '/buyer/reset-password',
    element: (
      <Suspense fallback={<Loader />}>
        <BuyerResetPassword />
      </Suspense>
    ),
  },
  // Protected routes - require authentication
  {
    path: '/buyer',
    element: <BuyerRoute />,
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<Loader />}>
            <BuyerDashboard />
          </Suspense>
        ),
      },
    ],
  },
];
