/**
 * Edge Function Test Setup
 *
 * Provides utilities for testing Supabase Edge Functions.
 * Includes mock request builders, response assertions, and test helpers.
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Re-export assertions for convenience
export { assertEquals, assertExists, assertStringIncludes };

/**
 * Create a mock HTTP request for testing
 */
export function createMockRequest(
  method: string,
  body?: unknown,
  options?: {
    authToken?: string;
    headers?: Record<string, string>;
    origin?: string;
  }
): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': options?.origin || 'http://localhost:5173',
    ...options?.headers,
  };

  if (options?.authToken) {
    headers['Authorization'] = `Bearer ${options.authToken}`;
  }

  return new Request('http://localhost', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Assert response is a successful JSON response
 */
export async function assertSuccessResponse(
  response: Response,
  expectedStatus: number = 200
): Promise<unknown> {
  assertEquals(response.status, expectedStatus, `Expected status ${expectedStatus}, got ${response.status}`);
  assertExists(response.headers.get('Content-Type'));
  assertStringIncludes(response.headers.get('Content-Type')!, 'application/json');

  const body = await response.json();
  return body;
}

/**
 * Assert response is an error response with specific code
 */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedCode?: string
): Promise<{ code: string; message: string; error: string }> {
  assertEquals(response.status, expectedStatus, `Expected status ${expectedStatus}, got ${response.status}`);

  const body = await response.json();

  if (expectedCode) {
    assertEquals(body.code, expectedCode, `Expected error code ${expectedCode}, got ${body.code}`);
  }

  assertExists(body.error || body.message, 'Error response should have error or message');
  return body;
}

/**
 * Assert CORS headers are present
 */
export function assertCorsHeaders(response: Response): void {
  assertExists(
    response.headers.get('Access-Control-Allow-Origin'),
    'Missing Access-Control-Allow-Origin header'
  );
  assertExists(
    response.headers.get('Access-Control-Allow-Headers'),
    'Missing Access-Control-Allow-Headers header'
  );
}

/**
 * Assert preflight response is correct
 */
export function assertPreflightResponse(response: Response): void {
  assertEquals(response.status, 200, 'Preflight should return 200');
  assertCorsHeaders(response);
}

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabaseClient(overrides?: {
  user?: { id: string; email: string };
  data?: unknown;
  error?: { message: string };
}) {
  const mockUser = overrides?.user || { id: 'test-user-id', email: 'test@example.com' };

  return {
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: null,
      }),
      getClaims: async () => ({
        data: { claims: { sub: mockUser.id } },
        error: null,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: overrides?.data || null,
            error: overrides?.error || null,
          }),
          maybeSingle: async () => ({
            data: overrides?.data || null,
            error: overrides?.error || null,
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: overrides?.data || { id: 'new-id' },
            error: overrides?.error || null,
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: overrides?.data || null,
              error: overrides?.error || null,
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: async () => ({
          error: overrides?.error || null,
        }),
      }),
    }),
  };
}

/**
 * Test helper: Generate a valid-looking UUID
 */
export function generateTestUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Test helper: Create a valid-looking JWT token (for testing only)
 */
export function generateTestToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: generateTestUUID(),
    email: 'test@example.com',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
}

/**
 * Environment setup for tests
 */
export function setupTestEnvironment(): void {
  // Set required environment variables for testing
  Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
  Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  Deno.env.set('ENVIRONMENT', 'test');
}

/**
 * Cleanup test environment
 */
export function cleanupTestEnvironment(): void {
  // Reset environment variables if needed
}

/**
 * Run a test with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
  message: string = 'Test timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

/**
 * Test suite configuration
 */
export interface TestConfig {
  name: string;
  fn: () => Promise<void> | void;
  only?: boolean;
  skip?: boolean;
  timeout?: number;
}

/**
 * Run a test suite with proper setup/teardown
 */
export async function runTestSuite(
  suiteName: string,
  tests: TestConfig[],
  options?: {
    beforeAll?: () => Promise<void> | void;
    afterAll?: () => Promise<void> | void;
    beforeEach?: () => Promise<void> | void;
    afterEach?: () => Promise<void> | void;
  }
): Promise<void> {
  console.log(`\n📦 ${suiteName}`);

  if (options?.beforeAll) {
    await options.beforeAll();
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const test of tests) {
    if (test.skip) {
      console.log(`  ⏭️  ${test.name} (skipped)`);
      skipped++;
      continue;
    }

    if (options?.beforeEach) {
      await options.beforeEach();
    }

    try {
      await withTimeout(Promise.resolve(test.fn()), test.timeout || 5000);
      console.log(`  ✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`  ❌ ${test.name}`);
      console.error(`     ${error instanceof Error ? error.message : error}`);
      failed++;
    }

    if (options?.afterEach) {
      await options.afterEach();
    }
  }

  if (options?.afterAll) {
    await options.afterAll();
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
}
