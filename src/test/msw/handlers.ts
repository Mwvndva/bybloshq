import { http, HttpResponse } from 'msw';

/**
 * Default MSW request handlers shared across the whole test suite.
 *
 * Keep this list small and cross-cutting: endpoints many components touch on
 * mount (CSRF bootstrap, lightweight session/profile probes) so that a test
 * which renders a real screen does not accidentally reach the network.
 *
 * Feature-specific responses belong in the test that needs them — add them
 * per-test with `server.use(...)` (see src/test/msw/server.ts). Anything not
 * handled here or overridden per-test is treated as an error by the setup
 * (`onUnhandledRequest: 'error'`), which keeps tests deterministic.
 */
export const handlers = [
  // CSRF bootstrap — the http client fetches this before state-changing calls.
  http.get('*/api/public/csrf-token', () =>
    HttpResponse.json({ status: 'success', data: { csrfToken: 'test-csrf-token' } })
  ),

  // Seller profile probe fired by the seller dashboard on mount.
  http.get('*/api/sellers/profile', () =>
    HttpResponse.json({ status: 'success', data: null })
  ),

  // Buyer profile probe fired by the buyer dashboard on mount.
  http.get('*/api/buyers/profile', () =>
    HttpResponse.json({ status: 'success', data: null })
  ),

  // Notification feed polled by the app shell on mount. The hook reads
  // res.data.data and expects an array (useNotifications.ts).
  http.get('*/api/notifications', () =>
    HttpResponse.json({ status: 'success', data: [] })
  ),

  // Buyer membership probe fired by the buyer dashboard on mount.
  http.get('*/api/buyers/membership', () =>
    HttpResponse.json({ status: 'success', data: null })
  ),
];
