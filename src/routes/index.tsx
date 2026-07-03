import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { buyerRoutes } from './buyer.routes';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load pages
import IndexPage from '@/pages/Index';
import { ShopPage } from '@/features/shop';
const MarketingLogin = safeLazy(() => import('@/pages/marketing/MarketingLogin'));
const MarketingDashboard = safeLazy(() => import('@/pages/marketing/MarketingDashboard'));
const VerifyEmail = safeLazy(() => import('@/pages/auth/VerifyEmail'));
const MzigoLogin = safeLazy(() => import('@/pages/logistics/MzigoLoginPage'));
const MzigoDashboard = safeLazy(() => import('@/pages/logistics/MzigoDashboardPage'));
const TrackingPage = safeLazy(() => import('@/pages/TrackingPage'));
const CreatorLogin = safeLazy(() => import('@/pages/creator/CreatorLogin'));
const CreatorRegister = safeLazy(() => import('@/pages/creator/CreatorRegister'));
const CreatorDashboard = safeLazy(() => import('@/pages/creator/CreatorDashboard'));

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
  // Standard public seller short link wildcard (must be matched after specific subpaths)
  {
    path: '/:shopName',
    element: <ShopPage />,
  },
];
