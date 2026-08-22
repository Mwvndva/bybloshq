/* eslint-disable react-refresh/only-export-components -- route config module exports a route array, not a fast-refreshable component */
import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { buyerRoutes } from './buyer.routes';
import { adminRoutes } from './admin.routes';
import { creatorRoutes } from './creator.routes';
import { marketingRoutes } from './marketing.routes';
import { mzigoRoutes } from './mzigo.routes';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';

// Eager pages
import IndexPage from '@/features/shop/pages/MarketplaceIndex';
import { ShopPage } from '@/features/shop';

// Lazy-loaded public & auth pages
const VerifyEmail = safeLazy(() => import('@/features/auth/pages/VerifyEmail'));
const TrackingPage = safeLazy(() => import('@/features/shop/pages/TrackingPage'));
const LegalPage = safeLazy(() => import('@/shared/components/LegalPage'));
const DeleteAccountPage = safeLazy(() => import('@/shared/components/DeleteAccountPage'));

// Master routes aggregator
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
    path: '/verify-email',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <VerifyEmail />
      </Suspense>
    ),
  },

  // Role-specific route modules
  ...sellerRoutes,
  ...buyerRoutes,
  ...adminRoutes,
  ...creatorRoutes,
  ...marketingRoutes,
  ...mzigoRoutes,

  // Public legal & account management pages (stable URLs for app store listings)
  {
    path: '/delete-account',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <DeleteAccountPage />
      </Suspense>
    ),
  },
  {
    path: '/legal',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <LegalPage />
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
    path: '/privacy-policy',
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
