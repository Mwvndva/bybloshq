import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { BuyerProtectedRoute } from '@/components/auth/AppProtectedRoute';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';
import BuyerLayout from '@/layouts/BuyerLayout';

// Lazy load components
const buyerLogin = safeLazy(() => import('@/components/buyer/BuyerLogin').then(m => m.BuyerLogin));
const buyerRegister = safeLazy(() => import('@/components/buyer/BuyerRegister').then(m => m.BuyerRegister));
const buyerForgotPassword = safeLazy(() => import('@/components/buyer/BuyerForgotPassword').then(m => m.BuyerForgotPassword));
const buyerResetPassword = safeLazy(() => import('@/components/buyer/BuyerResetPassword').then(m => m.BuyerResetPassword));
const buyerDashboard = safeLazy(() => import('@/components/buyer/BuyerDashboard'));
const shopPage = safeLazy(() => import('@/features/shop/pages/ShopPage'));

export const buyerRoutes = [
  // ─── Public routes ──────────────────────────────────────────────────────────
  {
    path: '/buyer/register',
    element: (() => {
      const Component = buyerRegister;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
  },
  {
    path: '/buyer/login',
    element: (() => {
      const Component = buyerLogin;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
  },
  {
    path: '/buyer/forgot-password',
    element: (() => {
      const Component = buyerForgotPassword;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
  },
  {
    path: '/buyer/reset-password',
    element: (() => {
      const Component = buyerResetPassword;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
  },

  // ─── Protected routes ────────────────────────────────────────────────────────
  {
    path: '/buyer',
    element: (
      <BuyerProtectedRoute>
        <BuyerLayout />
      </BuyerProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (() => {
          const Component = buyerDashboard;
          return (
            <Suspense fallback={<RouteFallback />}>
              <Component />
            </Suspense>
          );
        })(),
      },
      {
        path: 'orders',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <BuyerDashboard />
          </Suspense>
        ),
      },
      {
        path: 'shops',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <BuyerDashboard />
          </Suspense>
        ),
      },
      {
        path: 'wishlist',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <BuyerDashboard />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <BuyerDashboard />
          </Suspense>
        ),
      },
    ],
  },

  // ─── Buyer shop page (protected — buyer-only with wishlist + back button) ────
  {
    path: '/buyer/shop/:shopName',
    element: (
      <BuyerProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <ShopPage />
        </Suspense>
      </BuyerProtectedRoute>
    ),
  },
];


