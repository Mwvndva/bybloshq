import { createBrowserRouter, Outlet } from "react-router-dom";

import { AppProviders } from "@/app/providers/AppProviders";
import { ThemeManager } from "@/app/bootstrap/ThemeManager";
import { LoadingScreen } from "@/shared/components/LoadingScreen";
import { RootErrorElement } from "@/shared/components/ErrorBoundary";
import NotFound from "@/shared/components/NotFound";
import { adminRouter } from "@/app/router/admin.routes";
import { routes } from "@/app/router/routes.index";

export const router = createBrowserRouter([
  {
    element: (
      <AppProviders>
        <ThemeManager />
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




