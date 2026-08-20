import React, { Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { AppProtectedRoute } from '@/app/router/AppProtectedRoute';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';

const MzigoLogin = safeLazy(() => import('@/features/logistics/pages/MzigoLoginPage'));
const MzigoDashboard = safeLazy(() => import('@/features/logistics/pages/MzigoDashboardPage'));

export const mzigoRoutes: RouteObject[] = [
  {
    path: '/mzigo/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <MzigoLogin />
      </Suspense>
    ),
  },
  {
    path: '/mzigo/dashboard',
    element: (
      <AppProtectedRoute allowedRoles={['logistics', 'admin']}>
        <Suspense fallback={<RouteFallback />}>
          <MzigoDashboard />
        </Suspense>
      </AppProtectedRoute>
    ),
  },
  {
    path: '/logistics/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <MzigoLogin />
      </Suspense>
    ),
  },
  {
    path: '/logistics/dashboard',
    element: (
      <AppProtectedRoute allowedRoles={['logistics', 'admin']}>
        <Suspense fallback={<RouteFallback />}>
          <MzigoDashboard />
        </Suspense>
      </AppProtectedRoute>
    ),
  },
];
