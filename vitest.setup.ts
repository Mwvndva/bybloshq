import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

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

