import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { buyerRoutes } from './buyer.routes';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load pages
import IndexPage from '@/pages/Index';
import ShopPage from '@/pages/ShopPage';
const PaymentSuccessPage = safeLazy(() => import('@/pages/PaymentSuccess'));
const MarketingLogin = safeLazy(() => import('@/pages/marketing/MarketingLogin'));
const MarketingDashboard = safeLazy(() => import('@/pages/marketing/MarketingDashboard'));

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
    path: '/payment/success',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <PaymentSuccessPage />
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
  ...sellerRoutes,
  ...buyerRoutes,
];
