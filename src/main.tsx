import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/fonts.css';
import './index.css';

// Dynamic Import Recovery: Global listener for chunk load failures
window.addEventListener('error', (event) => {
  // Check for the specific error message associated with missing chunks
  const isChunkError = event.message &&
    (event.message.includes('Failed to fetch dynamically imported module') ||
      event.message.includes('Importing a module script failed'));

  if (isChunkError) {
    event.preventDefault(); // Prevent default console error

    // Prevent infinite reload loops directly
    const storageKey = 'app_reload_recovery_timestamp';
    const lastReload = sessionStorage.getItem(storageKey);
    const now = Date.now();

    // Only reload if we haven't reloaded in the last 10 seconds
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem(storageKey, now.toString());
      console.warn('Chunk load failure detected. Tentatively reloading to recover...');
      window.location.reload();
    } else {
      console.error('Persistent chunk load failure detected. Reload limit reached.');
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
