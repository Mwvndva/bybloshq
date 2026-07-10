import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { buyerRoutes } from './buyer.routes';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load pages
import IndexPage from '@/pages/Index';
import { ShopPage } from '@/features/shop';
const marketingLogin = safeLazy(() => import('@/features/auth/pages/MarketingLogin'));
const marketingDashboard = safeLazy(() => import('@/pages/marketing/MarketingDashboard'));
const verifyEmail = safeLazy(() => import('@/features/auth/pages/VerifyEmail'));
const mzigoLogin = safeLazy(() => import('@/features/auth/pages/MzigoLoginPage'));
const mzigoDashboard = safeLazy(() => import('@/pages/logistics/MzigoDashboardPage'));
const trackingPage = safeLazy(() => import('@/pages/TrackingPage'));
const creatorLogin = safeLazy(() => import('@/features/auth/pages/CreatorLogin'));
const creatorRegister = safeLazy(() => import('@/features/auth/pages/CreatorRegister'));
const creatorDashboard = safeLazy(() => import('@/pages/creator/CreatorDashboard'));

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
    element: (() => {
      const Component = trackingPage;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
  },
  {
    path: '/admin/marketing/login',
    element: (() => {
      const Component = marketingLogin;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
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
    element: (() => {
      const Component = verifyEmail;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
  },
  {
    path: '/creator/login',
    element: (() => {
      const Component = creatorLogin;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
  },
  {
    path: '/creator/register',
    element: (() => {
      const Component = creatorRegister;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
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
    element: (() => {
      const Component = mzigoLogin;
      return (
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      );
    })(),
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


