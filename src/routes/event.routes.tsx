import { lazy, Suspense } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Lazy load the event pages
const EventsPage = lazy(() => import('@/pages/events/EventsPage'));
const EventBookingPage = lazy(() => import('@/pages/events/EventBookingPage'));

// Type definitions for the EventRouter props
interface EventRouterProps {
  type?: 'view' | 'purchase' | 'confirmation';
}

// Extend component props to include eventId
interface PageProps {
  eventId?: string;
  isEmbed?: boolean;
}

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

// Helper component to handle event ID extraction from different URL formats
const EventRouter: React.FC<{ type?: 'view' | 'purchase' | 'confirmation' }> = ({ type = 'view' }) => {
  const params = useParams<{ eventId: string; slug?: string }>();
  let eventId = params.eventId;
  
  // Extract ID from slug format (e.g., "123-event-name" -> "123")
  // This handles the legacy URL format with slugs
  if (eventId?.includes('-')) {
    eventId = eventId.split('-')[0];
  }
  
  switch (type) {
    case 'purchase':
      return <EventBookingPage eventId={eventId} />;
    case 'view':
    default:
      return <EventsPage eventId={eventId} isEmbed={false} />;
  }
};

export const eventRoutes = [
  // Old routes for backward compatibility
  {
    path: '/events',
    element: withSuspense(EventsPage)({}),
  },
  {
    path: '/events/:eventId',
    element: withSuspense(EventRouter)({ type: 'view' }),
  },
  {
    path: '/events/:eventId/purchase',
    element: withSuspense(EventRouter)({ type: 'purchase' }),
  },
  
  // New clean URL structure with just event ID (preferred format)
  {
    path: '/e/:eventId',
    element: withSuspense(EventRouter)({ type: 'view' }),
  },
  {
    path: '/e/:eventId/purchase',
    element: withSuspense(EventRouter)({ type: 'purchase' }),
  },
  {
    path: '/e/:eventId/confirmation',
    element: withSuspense(EventRouter)({ type: 'confirmation' }),
  },
  
  // Legacy slug-based URLs (kept for backward compatibility)
  {
    path: '/e/:eventId-:slug',
    element: withSuspense(EventRouter)({ type: 'view' }),
  },
  {
    path: '/e/:eventId-:slug/purchase',
    element: withSuspense(EventRouter)({ type: 'purchase' }),
  },
  {
    path: '/e/:eventId-:slug/confirmation',
    element: withSuspense(EventRouter)({ type: 'confirmation' }),
  },
  
  // Embed route
  {
    path: '/embed/event/:eventId',
    element: withSuspense(EventsPage)({ isEmbed: true }),
  },
  
  // 404 handler for event routes
  {
    path: '*',
    element: <Navigate to="/events" replace />,
  },
];
