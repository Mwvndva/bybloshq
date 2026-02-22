import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { BuyerProtectedRoute } from '@/components/auth/AppProtectedRoute';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load components
const BuyerLogin = safeLazy(() => import('@/components/buyer/BuyerLogin').then(m => m.BuyerLogin));
const BuyerRegister = safeLazy(() => import('@/components/buyer/BuyerRegister').then(m => m.BuyerRegister));
const BuyerForgotPassword = safeLazy(() => import('@/components/buyer/BuyerForgotPassword').then(m => m.BuyerForgotPassword));
const BuyerResetPassword = safeLazy(() => import('@/components/buyer/BuyerResetPassword').then(m => m.BuyerResetPassword));
const BuyerDashboard = safeLazy(() => import('@/components/buyer/BuyerDashboard'));
const CheckoutPage = safeLazy(() => import('@/pages/checkout'));
const BuyerLayout = safeLazy(() => import('@/layouts/BuyerLayout'));

export const buyerRoutes = [
  // ─── Public routes ──────────────────────────────────────────────────────────
  {
    path: '/checkout',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <CheckoutPage />
      </Suspense>
    ),
  },
  {
    path: '/buyer/register',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <BuyerRegister />
      </Suspense>
    ),
  },
  {
    path: '/buyer/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <BuyerLogin />
      </Suspense>
    ),
  },
  {
    path: '/buyer/forgot-password',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <BuyerForgotPassword />
      </Suspense>
    ),
  },
  {
    path: '/buyer/reset-password',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <BuyerResetPassword />
      </Suspense>
    ),
  },

  // ─── Protected routes ────────────────────────────────────────────────────────
  {
    path: '/buyer',
    element: (
      <BuyerProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
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
          <Suspense fallback={<RouteFallback />}>
            <BuyerDashboard />
          </Suspense>
        ),
      },
    ],
  },

  // NOTE: /buyer/shop/:shopName has been removed.
  // Shop pages are publicly accessible at /shop/:shopName (defined in routes/index.tsx).
];
