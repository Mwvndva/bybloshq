import React, { Suspense } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { SellerProtectedRoute } from '@/components/auth/AppProtectedRoute';
import { SellerLayout } from '../layouts/SellerLayout';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

const sellerDashboard = safeLazy(() => import('../components/seller/SellerDashboard'));
const sellerRegistration = safeLazy(() => import('../components/seller/SellerRegistration'));
const sellerLogin = safeLazy(() => import('../components/seller/SellerLogin').then(m => m.SellerLogin));

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


