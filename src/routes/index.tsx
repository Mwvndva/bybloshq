import { Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { organizerRoutes } from './organizer.routes';
import { eventRoutes } from './event.routes';
import { ticketRoutes } from './ticket.routes';
import { buyerRoutes } from './buyer.routes';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load pages
const IndexPage = safeLazy(() => import('@/pages/Index'));
const ShopPage = safeLazy(() => import('@/pages/ShopPage'));
const PaymentSuccessPage = safeLazy(() => import('@/pages/PaymentSuccess'));

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
  ...sellerRoutes,
  ...organizerRoutes,
  ...eventRoutes,
  ...ticketRoutes,
  ...buyerRoutes,
];
