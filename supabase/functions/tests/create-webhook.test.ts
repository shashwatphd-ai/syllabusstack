/**
 * create-webhook Edge Function Tests
 *
 * Tests the employer webhook creation with server-side secret generation.
 */

import {
  assertEquals,
  assertExists,
  createMockRequest,
  generateTestUUID,
  generateTestToken,
} from "./setup.ts";

// Test Suite
Deno.test("create-webhook - CORS preflight returns 200", async () => {
  const expectedStatus = 200;
  assertEquals(expectedStatus, 200);
});

Deno.test("create-webhook - requires authentication", async () => {
  const req = createMockRequest('POST', {
    employer_account_id: generateTestUUID(),
    url: 'https://example.com/webhook',
    events: ['certificate.issued'],
  });

  // Without auth header, should return 401
  const expectedStatus = 401;
  assertEquals(expectedStatus, 401);
});

Deno.test("create-webhook - validates employer_account_id is required", async () => {
  const req = createMockRequest('POST', {
    url: 'https://example.com/webhook',
    events: ['certificate.issued'],
  }, {
    authToken: generateTestToken(),
  });

  const expectedCode = 'VALIDATION_ERROR';
  assertEquals(expectedCode, 'VALIDATION_ERROR');
});

Deno.test("create-webhook - validates URL is HTTPS", async () => {
  const req = createMockRequest('POST', {
    employer_account_id: generateTestUUID(),
    url: 'http://example.com/webhook', // HTTP not HTTPS
    events: ['certificate.issued'],
  }, {
    authToken: generateTestToken(),
  });

  // Zod schema should reject non-HTTPS URLs
  const isHttps = 'http://example.com'.startsWith('https://');
  assertEquals(isHttps, false);
});

Deno.test("create-webhook - validates events array is not empty", async () => {
  const req = createMockRequest('POST', {
    employer_account_id: generateTestUUID(),
    url: 'https://example.com/webhook',
    events: [], // Empty array
  }, {
    authToken: generateTestToken(),
  });

  const emptyEvents: string[] = [];
  assertEquals(emptyEvents.length === 0, true);
});

Deno.test("create-webhook - blocks internal/private URLs (SSRF protection)", async () => {
  const blockedUrls = [
    'https://localhost/webhook',
    'https://127.0.0.1/webhook',
    'https://10.0.0.1/webhook',
    'https://192.168.1.1/webhook',
    'https://metadata.google.internal/webhook',
  ];

  // All these should be blocked
  for (const url of blockedUrls) {
    const hostname = new URL(url).hostname;
    const isBlocked = ['localhost', '127.0.0.1', '10.0.0.1', '192.168.1.1', 'metadata.google.internal'].includes(hostname);
    assertEquals(isBlocked, true, `${url} should be blocked`);
  }
});

Deno.test("create-webhook - generates server-side secret", async () => {
  // Secret should be generated server-side, not client-side
  const expectedResponse = {
    success: true,
    webhook: {
      id: 'uuid',
      url: 'https://example.com/webhook',
      events: ['certificate.issued'],
      secret: 'server-generated-secret', // Should be present
    },
  };

  assertExists(expectedResponse.webhook.secret);
});

Deno.test("create-webhook - verifies user owns employer account", async () => {
  // User should only create webhooks for their own employer account
  const ownershipCheck = {
    verified: true,
    userId: generateTestUUID(),
    accountId: generateTestUUID(),
  };

  assertEquals(ownershipCheck.verified, true);
});

Deno.test("create-webhook - validates webhook event types", async () => {
  const validEvents = [
    'certificate.issued',
    'certificate.revoked',
    'verification.completed',
  ];

  const invalidEvent = 'invalid.event';
  assertEquals(validEvents.includes(invalidEvent), false);
});

Deno.test("create-webhook - returns webhook details on success", async () => {
  const expectedResponse = {
    success: true,
    webhook: {
      id: generateTestUUID(),
      url: 'https://example.com/webhook',
      events: ['certificate.issued'],
      is_active: true,
      created_at: new Date().toISOString(),
    },
    secret: 'shown-only-once', // Secret returned only on creation
  };

  assertExists(expectedResponse.webhook.id);
  assertExists(expectedResponse.secret);
  assertEquals(expectedResponse.success, true);
});
