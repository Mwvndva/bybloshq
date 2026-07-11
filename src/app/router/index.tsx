import { createBrowserRouter, Outlet } from "react-router-dom";

import { AppProviders } from "@/app/providers/AppProviders";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RootErrorElement } from "@/components/common/ErrorBoundary";
import NotFound from "@/pages/NotFound";
import { adminRouter } from "@/routes/admin.routes";
import { routes } from "@/routes";

export const router = createBrowserRouter([
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
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);




