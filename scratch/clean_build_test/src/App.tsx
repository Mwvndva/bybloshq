import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { router } from "@/app/router";
import { LoadingScreen } from "@/shared/components/LoadingScreen";
import { useAppTheme } from "@/shared/hooks/useAppTheme";

function App() {
  // Bootstrap app theme (light / dark / system) on mount.
  // This hook applies data-theme to <html> and keeps it in sync.
  useAppTheme();

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


