import React, { useEffect } from 'react';
import { RouterProvider, createBrowserRouter, Outlet } from "react-router-dom";
import { AppProviders } from "./components/AppProviders";
import { LoadingScreen } from "./components/LoadingScreen";
import { ErrorBoundary, RootErrorElement } from "./components/common/ErrorBoundary";
import { adminRouter } from "./routes/admin.routes";
import { routes } from "./routes";

// Create the main app router with both admin and main app routes
const router = createBrowserRouter([
  {
    element: (
      <AppProviders>
        <Outlet />
      </AppProviders>
    ),
    errorElement: <RootErrorElement />,
    children: [
      ...routes,
      ...adminRouter.routes,
      {
        path: '*',
        element: <div>Page not found</div>,
      }
    ],
  },
]);

function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} fallbackElement={<LoadingScreen />} />
    </ErrorBoundary>
  );
}

export default App;
