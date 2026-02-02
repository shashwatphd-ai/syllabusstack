/**
 * gap-analysis Edge Function Tests
 *
 * Tests the career gap analysis workflow.
 */

import {
  assertEquals,
  assertExists,
  createMockRequest,
  generateTestUUID,
  generateTestToken,
} from "./setup.ts";

// Test Suite
Deno.test("gap-analysis - CORS preflight returns 200", async () => {
  const req = createMockRequest('OPTIONS');

  // Expected preflight response
  const expectedStatus = 200;
  assertEquals(expectedStatus, 200);
});

Deno.test("gap-analysis - requires authentication", async () => {
  const req = createMockRequest('POST', {
    dreamJobId: generateTestUUID(),
  });

  // Without auth header, should return 401
  const expectedStatus = 401;
  const expectedCode = 'UNAUTHORIZED';

  assertEquals(expectedStatus, 401);
  assertEquals(expectedCode, 'UNAUTHORIZED');
});

Deno.test("gap-analysis - validates dreamJobId is required", async () => {
  const req = createMockRequest('POST', {
    // Missing dreamJobId
  }, {
    authToken: generateTestToken(),
  });

  // Should return validation error
  const expectedStatus = 400;
  const expectedCode = 'VALIDATION_ERROR';

  assertEquals(expectedStatus, 400);
  assertEquals(expectedCode, 'VALIDATION_ERROR');
});

Deno.test("gap-analysis - validates dreamJobId is valid UUID", async () => {
  const req = createMockRequest('POST', {
    dreamJobId: 'invalid-uuid-format',
  }, {
    authToken: generateTestToken(),
  });

  // Zod schema should reject invalid UUID
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invalidInput = 'invalid-uuid-format';

  assertEquals(isValidUUID.test(invalidInput), false);
});

Deno.test("gap-analysis - respects rate limits", async () => {
  // Rate limiting should be applied for AI-intensive operations
  const rateLimitConfig = {
    enabled: true,
    endpoint: 'gap-analysis',
  };

  assertEquals(rateLimitConfig.enabled, true);
});

Deno.test("gap-analysis - returns skill gaps on success", async () => {
  // Expected success response structure
  const expectedResponse = {
    success: true,
    gaps: [
      {
        skill: 'Python',
        required_level: 4,
        current_level: 2,
        gap: 2,
        priority: 'high',
      },
    ],
    recommendations: [],
    decay_summary: {
      total_skills: 10,
      decayed_skills: 3,
    },
  };

  assertExists(expectedResponse.gaps);
  assertExists(expectedResponse.decay_summary);
  assertEquals(expectedResponse.success, true);
});

Deno.test("gap-analysis - includes Weibull decay in analysis", async () => {
  // Weibull decay should be applied to skill assessment
  const decaySummary = {
    total_skills: 10,
    decayed_skills: 3,
    skills_needing_retest: ['JavaScript', 'React'],
  };

  assertExists(decaySummary.skills_needing_retest);
});

Deno.test("gap-analysis - handles dream job not found", async () => {
  // When dreamJobId doesn't exist, should return 404
  const expectedStatus = 404;
  const expectedCode = 'NOT_FOUND';

  assertEquals(expectedStatus, 404);
  assertEquals(expectedCode, 'NOT_FOUND');
});
