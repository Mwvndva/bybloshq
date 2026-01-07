import React from 'react';
import { RouterProvider, createBrowserRouter, Outlet } from "react-router-dom";
import { AppProviders } from "./components/AppProviders";
import { LoadingScreen } from "./components/LoadingScreen";
import { adminRouter } from "./routes/admin.routes";
import { routes } from "./routes";

// Create the main app router with both admin and main app routes
const router = createBrowserRouter([
  // Main app routes
  {
    element: (
      <AppProviders>
        <Outlet />
      </AppProviders>
    ),
    children: [
      ...routes,
      // Include admin routes as children to ensure they have access to all providers
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
    <RouterProvider router={router} fallbackElement={<LoadingScreen />} />
  );
}

export default App;
