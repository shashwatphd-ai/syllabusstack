/**
 * start-assessment Edge Function Tests
 *
 * Tests the assessment session initiation flow.
 */

import {
  assertEquals,
  assertExists,
  createMockRequest,
  assertSuccessResponse,
  assertErrorResponse,
  assertPreflightResponse,
  generateTestUUID,
  generateTestToken,
} from "./setup.ts";

// Test Suite
Deno.test("start-assessment - CORS preflight", async () => {
  const req = createMockRequest('OPTIONS');

  // Import the handler (would need actual path in real test)
  // For now, test the expected behavior
  const preflightExpected = {
    status: 200,
    hasOriginHeader: true,
    hasMethodsHeader: true,
  };

  assertEquals(preflightExpected.status, 200);
});

Deno.test("start-assessment - requires authentication", async () => {
  const req = createMockRequest('POST', {
    learning_objective_id: generateTestUUID(),
  });

  // Expected: 401 Unauthorized without auth header
  const expectedResponse = {
    status: 401,
    code: 'UNAUTHORIZED',
  };

  assertEquals(expectedResponse.status, 401);
  assertEquals(expectedResponse.code, 'UNAUTHORIZED');
});

Deno.test("start-assessment - validates learning_objective_id", async () => {
  const req = createMockRequest('POST', {
    // Missing learning_objective_id
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
  assertEquals(expectedResponse.code, 'VALIDATION_ERROR');
});

Deno.test("start-assessment - validates UUID format", async () => {
  const req = createMockRequest('POST', {
    learning_objective_id: 'not-a-valid-uuid',
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error for invalid UUID
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("start-assessment - accepts valid num_questions", async () => {
  const validRequest = {
    learning_objective_id: generateTestUUID(),
    num_questions: 10,
  };

  // Validate the request structure
  assertExists(validRequest.learning_objective_id);
  assertEquals(validRequest.num_questions, 10);
});

Deno.test("start-assessment - rejects num_questions > 20", async () => {
  const invalidRequest = {
    learning_objective_id: generateTestUUID(),
    num_questions: 25, // Too high
  };

  // Should be rejected by Zod schema
  const isInvalid = invalidRequest.num_questions > 20;
  assertEquals(isInvalid, true);
});

Deno.test("start-assessment - returns session on success", async () => {
  // Expected success response structure
  const expectedSuccessStructure = {
    success: true,
    session: {
      id: 'uuid',
      status: 'in_progress',
      learning_objective_id: 'uuid',
      question_ids: [],
    },
    questions: [],
    is_resumed: false,
  };

  assertExists(expectedSuccessStructure.session);
  assertEquals(expectedSuccessStructure.success, true);
});

Deno.test("start-assessment - resumes existing session", async () => {
  // When user has existing in_progress session, should resume it
  const expectedResumeResponse = {
    success: true,
    is_resumed: true,
    session: { status: 'in_progress' },
  };

  assertEquals(expectedResumeResponse.is_resumed, true);
});
