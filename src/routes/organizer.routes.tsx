import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { OrganizerLayout } from '@/layouts/OrganizerLayout';
import { OrganizerProtectedRoute } from '@/components/auth/AppProtectedRoute';
import { safeLazy } from '@/utils/safeLazy';
import { Loader2 } from 'lucide-react';

const DashboardPage = safeLazy(() => import('@/pages/organizer/dashboard/DashboardPage'));
const EventsListPage = safeLazy(() => import('@/pages/organizer/events/EventsListPage'));
const CreateEventPage = safeLazy(() => import('@/pages/organizer/events/CreateEventPage'));
const EventDetailPage = safeLazy(() => import('@/pages/organizer/events/EventDetailPage'));
const EditEventPage = safeLazy(() => import('@/pages/organizer/events/EditEventPage'));
const TicketsListPage = safeLazy(() => import('@/pages/organizer/tickets/TicketsListPage'));
const SettingsPage = safeLazy(() => import('@/pages/organizer/settings/SettingsPage'));
const LoginPage = safeLazy(() => import('@/pages/organizer/auth/LoginPage'));
const RegisterPage = safeLazy(() => import('@/pages/organizer/auth/RegisterPage'));
const ForgotPasswordPage = safeLazy(() => import('@/pages/organizer/auth/ForgotPasswordPage'));
const ResetPasswordPage = safeLazy(() => import('@/pages/organizer/auth/ResetPasswordPage'));
const TermsPage = safeLazy(() => import('@/pages/organizer/terms/TermsPage'));

// Define the routes array
export const organizerRoutes = [
  {
    path: '/organizer',
    element: (
      <OrganizerProtectedRoute>
        <OrganizerLayout />
      </OrganizerProtectedRoute>
    ),
    children: [
      {
        path: '',
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'events',
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                <EventsListPage />
              </Suspense>
            ),
          },
          {
            path: 'new',
            element: (
              <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                <CreateEventPage />
              </Suspense>
            ),
          },
          {
            path: ':id',
            element: (
              <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                <EventDetailPage />
              </Suspense>
            ),
          },
          {
            path: ':id/edit',
            element: (
              <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                <EditEventPage />
              </Suspense>
            ),
          },
          {
            path: ':id/tickets',
            element: (
              <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                <TicketsListPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'tickets',
        element: (
          <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
            <TicketsListPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'terms',
        element: (
          <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
            <TermsPage />
          </Suspense>
        ),
      },
    ],
  },
  // Auth routes (not protected)
  {
    path: '/organizer/login',
    element: (
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/organizer/register',
    element: (
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/organizer/forgot-password',
    element: (
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
        <ForgotPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/organizer/reset-password',
    element: (
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/organizer/terms',
    element: (
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
        <TermsPage />
      </Suspense>
    ),
  },

];
