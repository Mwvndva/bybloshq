import React, { useEffect } from 'react';
import { RouterProvider, createBrowserRouter, Outlet } from "react-router-dom";
import { AppProviders } from "./components/AppProviders";
import { LoadingScreen } from "./components/LoadingScreen";
import { ErrorBoundary, RootErrorElement } from "./components/common/ErrorBoundary";
import { adminRouter } from "./routes/admin.routes";
import { routes } from "./routes";
import FileLaunchHandler from "./components/FileLaunchHandler";
import { useBybx } from './contexts/BybxContext';

const AppContentInner = () => {
  const { onFileLoaded, decryptedFile } = useBybx();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
          console.log('SW registered: ', registration);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }
  }, []);

  return (
    <>
      <FileLaunchHandler onFileLoaded={onFileLoaded} />
      {decryptedFile && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white p-4 rounded-xl border border-white/20 shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Unlocked Content</h3>
          <p className="text-xs opacity-70">{decryptedFile.name}</p>
        </div>
      )}
      <Outlet />
    </>
  );
};

// Create the main app router with both admin and main app routes
const router = createBrowserRouter([
  {
    element: (
      <AppProviders>
        <AppContentInner />
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
