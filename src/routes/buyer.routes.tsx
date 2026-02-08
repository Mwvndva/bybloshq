import { lazy, Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { BuyerProtectedRoute } from '@/components/auth/AppProtectedRoute';
import { Loader2 } from 'lucide-react';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { safeLazy } from '@/utils/safeLazy';

// Lazy load components with default exports
const BuyerLogin = safeLazy(() => import('@/components/buyer/BuyerLogin').then(module => module.BuyerLogin));
const BuyerRegister = safeLazy(() => import('@/components/buyer/BuyerRegister').then(module => module.BuyerRegister));
const BuyerForgotPassword = safeLazy(() => import('@/components/buyer/BuyerForgotPassword').then(module => module.BuyerForgotPassword));
const BuyerResetPassword = safeLazy(() => import('@/components/buyer/BuyerResetPassword').then(module => module.BuyerResetPassword));
const BuyerDashboard = safeLazy(() => import('@/components/buyer/BuyerDashboard'));
const CheckoutPage = safeLazy(() => import('@/pages/checkout'));
const BuyerLayout = safeLazy(() => import('@/layouts/BuyerLayout'));
const ShopPage = safeLazy(() => import('@/pages/ShopPage'));

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
    path: '/checkout',
    element: (
      <Suspense fallback={<Loader />}>
        <CheckoutPage />
      </Suspense>
    ),
  },
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
    element: (
      <BuyerProtectedRoute>
        <Suspense fallback={<Loader />}>
          <BuyerLayout />
        </Suspense>
      </BuyerProtectedRoute>
    ),
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
  {
    path: '/buyer/shop/:shopName',
    element: (
      <BuyerProtectedRoute>
        <Suspense fallback={<Loader />}>
          <ShopPage />
        </Suspense>
      </BuyerProtectedRoute>
    ),
  },
];
