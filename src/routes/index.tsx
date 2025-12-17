import { lazy, Suspense } from 'react';
import { sellerRoutes } from './seller.routes';
import { organizerRoutes } from './organizer.routes';
import { eventRoutes } from './event.routes';
import { ticketRoutes } from './ticket.routes';
import { buyerRoutes } from './buyer.routes';

// Lazy load pages
const IndexPage = lazy(() => import('@/pages/Index'));
const ShopPage = lazy(() => import('@/pages/ShopPage'));
const PaymentSuccessPage = lazy(() => import('@/pages/PaymentSuccess'));

// Create a simple loading component
const LoadingFallback = () => (
  <div className="flex justify-center items-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-floral-600"></div>
  </div>
);

// Main routes configuration
export const routes = [
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <IndexPage />
      </Suspense>
    ),
  },
  {
    path: '/shop/:shopName',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ShopPage />
      </Suspense>
    ),
  },
  {
    path: '/payment/success',
    element: (
      <Suspense fallback={<LoadingFallback />}>
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
