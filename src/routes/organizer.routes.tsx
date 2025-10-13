import { Navigate } from 'react-router-dom';
import { OrganizerLayout } from '@/layouts/OrganizerLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardPage from '@/pages/organizer/dashboard/DashboardPage';
import EventsListPage from '@/pages/organizer/events/EventsListPage';
import CreateEventPage from '@/pages/organizer/events/CreateEventPage';
import EventDetailPage from '@/pages/organizer/events/EventDetailPage';
import EditEventPage from '@/pages/organizer/events/EditEventPage';
import TicketsListPage from '@/pages/organizer/tickets/TicketsListPage';
import SettingsPage from '@/pages/organizer/settings/SettingsPage';
import LoginPage from '@/pages/organizer/auth/LoginPage';
import RegisterPage from '@/pages/organizer/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/organizer/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/organizer/auth/ResetPasswordPage';
import TermsPage from '@/pages/organizer/terms/TermsPage';

// Define the routes array
export const organizerRoutes = [
  {
    path: '/organizer',
    element: (
      <ProtectedRoute>
        <OrganizerLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '',
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'events',
        children: [
          {
            index: true,
            element: <EventsListPage />,
          },
          {
            path: 'new',
            element: <CreateEventPage />,
          },
          {
            path: ':id',
            element: <EventDetailPage />,
          },
          {
            path: ':id/edit',
            element: <EditEventPage />,
          },
          {
            path: ':id/tickets',
            element: <TicketsListPage />,
          },
        ],
      },
      {
        path: 'tickets',
        element: <TicketsListPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'terms',
        element: <TermsPage />,
      },
    ],
  },
  // Auth routes (not protected)
  {
    path: '/organizer/login',
    element: <LoginPage />,
  },
  {
    path: '/organizer/register',
    element: <RegisterPage />,
  },
  {
    path: '/organizer/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/organizer/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/organizer/terms',
    element: <TermsPage />,
  },

];
