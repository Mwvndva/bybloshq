import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions } from '@testing-library/react';

/**
 * A QueryClient tuned for tests: no retries, no background refetching, so
 * assertions are deterministic and fast.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial history entry for the in-memory router. Defaults to '/'. */
  route?: string;
  /** Provide a shared client to assert cache reuse across renders. */
  queryClient?: QueryClient;
}

/**
 * Render a component inside the providers every screen needs (React Query +
 * Router), returning the testing-library result plus the QueryClient in use so
 * tests can inspect or share the cache.
 *
 * Network is already mocked globally by MSW (see vitest.setup.ts); pass
 * per-test responses with `server.use(...)` where a screen fetches on mount.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient = createTestQueryClient(), ...options }: ProvidersOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
