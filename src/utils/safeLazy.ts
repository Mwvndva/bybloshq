import { lazy, ComponentType } from 'react';

/**
 * A robust version of React.lazy that handles chunk loading errors by forcing a page reload.
 * This is essential for SPAs during deployments when old entry chunks are removed from the server.
 * 
 * @param importFn The dynamic import function, e.g., () => import('./MyComponent')
 * @returns A lazy-loaded component that automatically recovers from chunk errors
 */
export const safeLazy = <T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T } | T>
) => {
    return lazy(async () => {
        try {
            const component = await importFn();

            // Handle both default and non-default exports
            // Some routes use .then(m => ({ default: m.ComponentName }))
            if ('default' in component) {
                return { default: component.default as T };
            }

            return { default: component as T };
        } catch (error: any) {
            console.error('safeLazy caught a chunk loading error:', error);

            // Check if it's a dynamic import failure
            const isChunkError =
                error.name === 'ChunkLoadError' ||
                error.message?.includes('Failed to fetch dynamically imported module') ||
                error.message?.includes('Importing a module script failed') ||
                error.message?.includes('Loading chunk');

            if (isChunkError) {
                // Prevent infinite reload loops by checking session storage
                const lastReload = sessionStorage.getItem('last_chunk_reload');
                const now = Date.now();

                // Only auto-reload if we haven't reloaded in the last 10 seconds
                if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                    sessionStorage.setItem('last_chunk_reload', now.toString());
                    console.warn('Chunk loading failed. Forcing page reload to get latest version...');
                    window.location.reload();

                    // Return a placeholder promise that never resolves/rejects 
                    // while the page is reloading to avoid further errors
                    return new Promise(() => { }) as Promise<{ default: T }>;
                } else {
                    console.error('Chunk loading failed repeatedly. Not reloading again to avoid loop.');
                }
            }

            // If it's not a chunk error or we already reloaded, throw it to be caught by ErrorBoundary
            throw error;
        }
    });
};
