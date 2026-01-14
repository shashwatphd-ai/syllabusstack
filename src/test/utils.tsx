import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): ReturnType<typeof render> {
  const { queryClient, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from testing-library
// Using `export * from` for full compatibility
export { 
  cleanup, 
  act,
  renderHook 
} from '@testing-library/react';

// Re-export from @testing-library/dom (where screen, fireEvent, waitFor, within live)
export { 
  screen, 
  fireEvent, 
  waitFor, 
  within,
} from '@testing-library/dom';

// Override render with our custom version
export { customRender as render };

// Export test query client creator
export { createTestQueryClient };

// Helper to wait for async updates
export async function waitForLoadingToFinish() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Helper to create a promise that resolves after a delay
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to mock a successful API response
export function mockApiSuccess<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

// Helper to mock an API error
export function mockApiError(message: string) {
  return Promise.resolve({ data: null, error: new Error(message) });
}
