import React, { Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { AppProtectedRoute } from '@/app/router/AppProtectedRoute';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';

const MarketingLogin = safeLazy(() => import('@/features/marketing/pages/MarketingLogin'));
const MarketingDashboard = safeLazy(() => import('@/features/marketing/pages/MarketingDashboard'));

export const marketingRoutes: RouteObject[] = [
  {
    path: '/admin/marketing/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <MarketingLogin />
      </Suspense>
    ),
  },
  {
    path: '/admin/marketing',
    element: (
      <AppProtectedRoute allowedRoles={['marketing', 'admin']}>
        <Suspense fallback={<RouteFallback />}>
          <MarketingDashboard />
        </Suspense>
      </AppProtectedRoute>
    ),
  },
];
