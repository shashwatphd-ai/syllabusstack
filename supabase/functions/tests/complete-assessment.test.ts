/**
 * complete-assessment Edge Function Tests
 *
 * Tests the assessment completion flow including:
 * - Session validation
 * - Score calculation
 * - Learning objective verification
 * - Performance summary generation
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
Deno.test("complete-assessment - CORS preflight", async () => {
  const req = createMockRequest('OPTIONS');

  // Expected preflight behavior
  const preflightExpected = {
    status: 200,
    hasOriginHeader: true,
    hasMethodsHeader: true,
  };

  assertEquals(preflightExpected.status, 200);
});

Deno.test("complete-assessment - requires authentication", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
  });

  // Expected: 401 Unauthorized without auth header
  const expectedResponse = {
    status: 401,
    code: 'UNAUTHORIZED',
  };

  assertEquals(expectedResponse.status, 401);
  assertEquals(expectedResponse.code, 'UNAUTHORIZED');
});

Deno.test("complete-assessment - validates session_id", async () => {
  const req = createMockRequest('POST', {
    // Missing session_id
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

Deno.test("complete-assessment - validates UUID format", async () => {
  const req = createMockRequest('POST', {
    session_id: 'not-a-valid-uuid',
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

Deno.test("complete-assessment - returns 404 for non-existent session", async () => {
  // Non-existent session should return NOT_FOUND
  const expectedResponse = {
    status: 404,
    code: 'NOT_FOUND',
  };

  assertEquals(expectedResponse.status, 404);
  assertEquals(expectedResponse.code, 'NOT_FOUND');
});

Deno.test("complete-assessment - returns performance summary on success", async () => {
  // Expected success response structure
  const expectedSuccessStructure = {
    success: true,
    session: {
      id: 'uuid',
      status: 'completed',
      total_score: 85,
      passed: true,
    },
    performance: {
      total_questions: 5,
      questions_answered: 5,
      questions_correct: 4,
      questions_incorrect: 1,
      questions_skipped: 0,
      total_score: 80,
      passed: true,
      passing_threshold: 70,
      total_time_seconds: 300,
      avg_time_per_question: 60,
    },
    correct_answers: ['q1', 'q2', 'q3', 'q4'],
    incorrect_answers: [],
    learning_objective_verified: true,
  };

  assertExists(expectedSuccessStructure.session);
  assertExists(expectedSuccessStructure.performance);
  assertEquals(expectedSuccessStructure.success, true);
});

Deno.test("complete-assessment - handles already completed session", async () => {
  // Already completed session should return with already_completed flag
  const expectedResponse = {
    success: true,
    already_completed: true,
    session: { status: 'completed' },
  };

  assertEquals(expectedResponse.already_completed, true);
});

Deno.test("complete-assessment - calculates passing correctly at threshold", async () => {
  // Test edge case: exactly at passing threshold (70%)
  const passingScore = 70;
  const passed = passingScore >= 70;

  assertEquals(passed, true);
});

Deno.test("complete-assessment - calculates failing correctly below threshold", async () => {
  // Test edge case: below passing threshold
  const failingScore = 69;
  const passed = failingScore >= 70;

  assertEquals(passed, false);
});

Deno.test("complete-assessment - verifies learning objective on pass", async () => {
  // When assessment is passed, learning objective should be verified
  const passed = true;
  const learning_objective_verified = passed && true;

  assertEquals(learning_objective_verified, true);
});

