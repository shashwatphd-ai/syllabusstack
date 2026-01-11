import { vi } from 'vitest';

// Mock user for authenticated requests
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

// Create mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: mockUser } }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  from: vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(),
  })),
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
    })),
  },
};

// Create a standard chain mock with all methods
function createChainMock<T>(data: T | null = null, error: Error | null = null) {
  const chainMock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn((resolve) => resolve({ data, error })),
  };
  return chainMock;
}

// Helper to set up mock response for a specific table query
export function mockTableQuery<T>(
  table: string,
  data: T | T[] | null,
  error: Error | null = null
) {
  const chainMock = createChainMock(Array.isArray(data) ? data[0] : data, error);
  // Override then to return the full data array
  chainMock.then = vi.fn((resolve) => resolve({ data, error }));

  // Override the default from mock for this specific table
  mockSupabaseClient.from.mockImplementation((t: string) => {
    if (t === table) {
      return chainMock;
    }
    // Return default chain for other tables
    return createChainMock(null, null);
  });

  return chainMock;
}

// Reset all mocks between tests
export function resetSupabaseMocks() {
  vi.clearAllMocks();
  mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
}
