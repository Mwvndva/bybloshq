import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './src/test/msw/server';

// Network isolation: intercept all HTTP at the transport layer so no test
// reaches the real network. Unhandled requests fail loudly so tests stay
// deterministic — add per-test responses with `server.use(...)`.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom does not implement matchMedia.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Capacitor PushNotifications for jsdom test environment
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    register: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockImplementation((_event: string, _callback: (...args: unknown[]) => void) => {
      return Promise.resolve({ remove: vi.fn() });
    }),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
  },
}));

