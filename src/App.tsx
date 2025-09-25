import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createBrowserRouter, Outlet } from "react-router-dom";
import { OrganizerAuthProvider } from "./contexts/OrganizerAuthContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { BuyerAuthProvider } from "./contexts/BuyerAuthContext";
import { WishlistProvider } from "./contexts/WishlistContext";
import { adminRouter } from "./routes/admin.routes";
import { routes } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Create a wrapper component for the main app
const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>
    <Toaster />
    <QueryClientProvider client={queryClient}>
      <BuyerAuthProvider>
        <WishlistProvider>
          <OrganizerAuthProvider>
            <AdminAuthProvider>
              {children}
            </AdminAuthProvider>
          </OrganizerAuthProvider>
        </WishlistProvider>
      </BuyerAuthProvider>
    </QueryClientProvider>
  </TooltipProvider>
);

// Create the main app router with both admin and main app routes
const router = createBrowserRouter([
  // Main app routes
  {
    element: (
      <AppWrapper>
        <Outlet />
      </AppWrapper>
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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} fallbackElement={<div>Loading...</div>} />
    </QueryClientProvider>
  );
}

export default App;
