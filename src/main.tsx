import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/fonts.css';
import './index.css';

// Global error handler for dynamic import failures (ChunkLoadError)
// This usually happens when a new version is deployed and the user is on an old cached version
window.addEventListener('error', (event) => {
  const isChunkLoadError =
    event.message?.includes('ChunkLoadError') ||
    event.message?.includes('Failed to fetch dynamically imported module');

  if (isChunkLoadError) {
    console.error('Dynamic import failed, reloading page...', event);
    // Prevent infinite reload loops if the error persists
    const storageKey = 'chunk_load_error_reload';
    const lastReload = sessionStorage.getItem(storageKey);
    const now = Date.now();

    // Only reload if we haven't reloaded in the last 10 seconds
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem(storageKey, String(now));
      window.location.reload();
    }
  }
});

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
