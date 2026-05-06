import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { buyerRoutes } from './buyer.routes';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load pages
import IndexPage from '@/pages/Index';
import ShopPage from '@/pages/ShopPage';
const MarketingLogin = safeLazy(() => import('@/pages/marketing/MarketingLogin'));
const MarketingDashboard = safeLazy(() => import('@/pages/marketing/MarketingDashboard'));
const VerifyEmail = safeLazy(() => import('@/pages/auth/VerifyEmail'));

import PublicLayout from '@/components/layout/PublicLayout';

// Main routes configuration
export const routes = [
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <IndexPage />,
      },
      // Public shop page — no auth required
      {
        path: '/shop/:shopName',
        element: <ShopPage />,
      },
    ]
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
  ...sellerRoutes,
  ...buyerRoutes,
];
