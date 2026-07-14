/* eslint-disable react-refresh/only-export-components -- route config module exports a route array, not a fast-refreshable component */
import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { buyerRoutes } from './buyer.routes';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Eager pages
import IndexPage from '@/pages/Index';
import { ShopPage } from '@/features/shop';

// Lazy-loaded pages
const MarketingLogin = safeLazy(() => import('@/features/auth/pages/MarketingLogin'));
const MarketingDashboard = safeLazy(() => import('@/pages/marketing/MarketingDashboard'));
const VerifyEmail = safeLazy(() => import('@/features/auth/pages/VerifyEmail'));
const MzigoLogin = safeLazy(() => import('@/features/auth/pages/MzigoLoginPage'));
const MzigoDashboard = safeLazy(() => import('@/pages/logistics/MzigoDashboardPage'));
const TrackingPage = safeLazy(() => import('@/pages/TrackingPage'));
const CreatorLogin = safeLazy(() => import('@/features/auth/pages/CreatorLogin'));
const CreatorRegister = safeLazy(() => import('@/features/auth/pages/CreatorRegister'));
const CreatorDashboard = safeLazy(() => import('@/pages/creator/CreatorDashboard'));
const LegalPage = safeLazy(() => import('@/pages/LegalPage'));
const DeleteAccountPage = safeLazy(() => import('@/pages/DeleteAccountPage'));

// Main routes configuration
export const routes = [
  {
    path: '/',
    element: <IndexPage />,
  },
  // Public shop page — no auth required
  {
    path: '/shop/:shopName',
    element: <ShopPage />,
  },
  {
    path: '/track/:token',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <TrackingPage />
      </Suspense>
    ),
  },
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
      <Suspense fallback={<RouteFallback />}>
        <MarketingDashboard />
      </Suspense>
    ),
  },
  {
    path: '/verify-email',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <VerifyEmail />
      </Suspense>
    ),
  },
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
    path: '/creator/dashboard',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <CreatorDashboard />
      </Suspense>
    ),
  },
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
      <Suspense fallback={<RouteFallback />}>
        <MzigoDashboard />
      </Suspense>
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
      <Suspense fallback={<RouteFallback />}>
        <MzigoDashboard />
      </Suspense>
    ),
  },
  ...sellerRoutes,
  ...buyerRoutes,
  // Public legal pages (stable URLs for the Play Console / app store listings)
  {
    path: '/delete-account',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <DeleteAccountPage />
      </Suspense>
    ),
  },
  {
    path: '/privacy',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <LegalPage />
      </Suspense>
    ),
  },
  {
    path: '/terms',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <LegalPage />
      </Suspense>
    ),
  },
  // Standard public seller short link wildcard (must be matched after specific subpaths)
  {
    path: '/:shopName',
    element: <ShopPage />,
  },
];
