import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The MSW request-mocking server used by the Node (jsdom) test environment.
 *
 * Wired into every test via vitest.setup.ts:
 *   - listen({ onUnhandledRequest: 'error' }) before the suite
 *   - resetHandlers() after each test (drops per-test overrides)
 *   - close() after the suite
 *
 * In a test, override or add a response with:
 *   import { server } from '@/test/msw/server';
 *   import { http, HttpResponse } from 'msw';
 *   server.use(http.get('*\/api/...', () => HttpResponse.json({ ... })));
 */
export const server = setupServer(...handlers);
