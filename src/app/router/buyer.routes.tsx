/* eslint-disable react-refresh/only-export-components -- route config module exports a route array, not a fast-refreshable component */
import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { BuyerProtectedRoute } from '@/app/router/AppProtectedRoute';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';
import BuyerLayout from '@/app/layouts/BuyerLayout';

// Lazy load components
const BuyerLogin = safeLazy(() => import('@/features/buyer/pages/BuyerLogin').then(m => m.BuyerLogin));
const BuyerRegister = safeLazy(() => import('@/features/buyer/pages/BuyerRegister').then(m => m.BuyerRegister));
const BuyerForgotPassword = safeLazy(() => import('@/features/buyer/pages/BuyerForgotPassword').then(m => m.BuyerForgotPassword));
const BuyerResetPassword = safeLazy(() => import('@/features/buyer/pages/BuyerResetPassword').then(m => m.BuyerResetPassword));
const BuyerDashboard = safeLazy(() => import('@/features/buyer/pages/BuyerDashboard'));
const ShopPage = safeLazy(() => import('@/features/shop/pages/ShopPage'));

export const buyerRoutes = [
  // ─── Public routes ──────────────────────────────────────────────────────────
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
        element: (
          <Suspense fallback={<RouteFallback />}>
            <BuyerDashboard />
          </Suspense>
        ),
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
        path: 'notifications',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <BuyerDashboard />
          </Suspense>
        ),
      },
      {
        // "My Shops" was removed (spec §5); keep the old path working by redirecting.
        path: 'shops',
        element: <Navigate to="/buyer/dashboard" replace />,
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
