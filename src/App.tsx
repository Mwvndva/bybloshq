import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { router } from "@/app/router";
import { LoadingScreen } from "@/components/LoadingScreen";

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


