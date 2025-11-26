import { lazy, Suspense } from 'react';

// Lazy load the ticket validation page
const TicketValidationPage = lazy(() => import('@/pages/tickets/validate/[ticketNumber]'));

// Create a simple loading component
const LoadingFallback = () => (
  <div className="flex justify-center items-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-floral-600"></div>
  </div>
);

// Create a wrapper component with Suspense
const withSuspense = (Component: React.ComponentType) => (props: any) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component {...props} />
  </Suspense>
);

export const ticketRoutes = [
  {
    path: '/tickets/validate/:ticketNumber',
    element: withSuspense(TicketValidationPage)({}),
  },
];
