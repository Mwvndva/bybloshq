import { Suspense } from 'react';
import { safeLazy } from '@/utils/safeLazy';
import { RouteFallback } from '@/components/common/RouteFallback';

// Lazy load the ticket validation page
const TicketValidationPage = safeLazy(() => import('@/pages/tickets/validate/[ticketNumber]'));

// Create a wrapper component with Suspense
const withSuspense = (Component: React.ComponentType) => (props: any) => (
  <Suspense fallback={<RouteFallback />}>
    <Component {...props} />
  </Suspense>
);

export const ticketRoutes = [
  {
    path: '/tickets/validate/:ticketNumber',
    element: withSuspense(TicketValidationPage)({}),
  },
];
