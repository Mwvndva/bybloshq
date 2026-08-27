import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { router } from "@/app/router";
import { LoadingScreen } from "@/shared/components/LoadingScreen";
import { useAppTheme } from "@/shared/hooks/useAppTheme";
import { useAndroidBackHandler } from "@/shared/utils/modalBackHandler";

function App() {
  // Bootstrap app theme (light / dark / system) on mount.
  // This hook applies data-theme to <html> and keeps it in sync.
  useAppTheme();

  // Intercept Android hardware back button for active modals/sheets
  useAndroidBackHandler();

  return (
    <ErrorBoundary>
      <RouterProvider
        router={router}
        fallbackElement={<LoadingScreen />}
      />
    </ErrorBoundary>
  );
}

export default App;


