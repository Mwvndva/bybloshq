import React, { Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { AppProtectedRoute } from '@/app/router/AppProtectedRoute';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';

const CreatorLogin = safeLazy(() => import('@/features/creator/pages/CreatorLogin'));
const CreatorRegister = safeLazy(() => import('@/features/creator/pages/CreatorRegister'));
const CreatorForgotPassword = safeLazy(() => import('@/features/creator/pages/CreatorForgotPassword'));
const CreatorResetPassword = safeLazy(() => import('@/features/creator/pages/CreatorResetPassword'));
const CreatorDashboard = safeLazy(() => import('@/features/creator/pages/CreatorDashboard'));

export const creatorRoutes: RouteObject[] = [
  {
    path: '/creator/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <CreatorLogin />
      </Suspense>
    ),
  },
  {
    path: '/creator/register',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <CreatorRegister />
      </Suspense>
    ),
  },
  {
    path: '/creator/forgot-password',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <CreatorForgotPassword />
      </Suspense>
    ),
  },
  {
    path: '/creator/reset-password',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <CreatorResetPassword />
      </Suspense>
    ),
  },
  {
    path: '/creator/dashboard',
    element: (
      <AppProtectedRoute allowedRoles={['creator', 'admin']}>
        <Suspense fallback={<RouteFallback />}>
          <CreatorDashboard />
        </Suspense>
      </AppProtectedRoute>
    ),
  },
];
