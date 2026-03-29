import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { buyerRoutes } from './buyer.routes';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load pages
const IndexPage = safeLazy(() => import('@/pages/Index'));
const ShopPage = safeLazy(() => import('@/pages/ShopPage'));
const PaymentSuccessPage = safeLazy(() => import('@/pages/PaymentSuccess'));
const MarketingLogin = safeLazy(() => import('@/pages/marketing/MarketingLogin'));
const MarketingDashboard = safeLazy(() => import('@/pages/marketing/MarketingDashboard'));

// Main routes configuration
export const routes = [
  {
    path: '/',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <IndexPage />
      </Suspense>
    ),
  },
  // Public shop page — no auth required
  {
    path: '/shop/:shopName',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <ShopPage />
      </Suspense>
    ),
  },
  {
    path: '/payment/success',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <PaymentSuccessPage />
      </Suspense>
    ),
  },
  {
    path: '/marketing/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <MarketingLogin />
      </Suspense>
    ),
  },
  {
    path: '/marketing/dashboard',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <MarketingDashboard />
      </Suspense>
    ),
  },
  ...sellerRoutes,
  ...buyerRoutes,
];
