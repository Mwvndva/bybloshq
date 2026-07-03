import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { router, LoadingScreen } from "@/app/router";

function App() {
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
