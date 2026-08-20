import React, { Suspense } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { SellerProtectedRoute } from '@/app/router/AppProtectedRoute';
import { SellerLayout } from '@/app/layouts/SellerLayout';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';

const sellerDashboard = safeLazy(() => import('@/features/seller/pages/SellerDashboard'));
const sellerRegistration = safeLazy(() => import('@/features/seller/pages/SellerRegistration'));
const sellerLogin = safeLazy(() => import('@/features/seller/pages/SellerLogin').then(m => m.SellerLogin));

import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

// Create the seller routes
export const sellerRoutes: RouteObject[] = [
  // Public auth routes (completely independent of dashboard layout)
  {
    path: '/seller/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        {(() => { const Component = sellerLogin; return <Component />; })()}
      </Suspense>
    ),
  },
  {
    path: '/seller/register',
    element: (
      <Suspense fallback={<RouteFallback />}>
        {(() => { const Component = sellerRegistration; return <Component />; })()}
      </Suspense>
    ),
  },
  {
    path: '/join',
    element: (
      <Suspense fallback={<RouteFallback />}>
        {(() => { const Component = sellerRegistration; return <Component />; })()}
      </Suspense>
    ),
  },
  {
    path: '/seller/reset-password',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },

  // Protected seller routes with dashboard layout
  {
    path: '/seller',
    element: (
      <SellerProtectedRoute>
        <SellerLayout />
      </SellerProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<RouteFallback />}>
            {(() => { const Component = sellerDashboard; return <Component />; })()}
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Overview content will be rendered by SellerDashboard */}
                </div>
              </div>
            ),
          },
        ],
      },
      // Redirects for protected routes
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: '*',
        element: <Navigate to="dashboard" replace />,
      },
    ],
  },
];


