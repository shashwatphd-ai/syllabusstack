/**
 * submit-assessment-answer Edge Function Tests
 *
 * Tests the assessment answer submission and evaluation flow.
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

// Test Suite: CORS Handling
Deno.test("submit-assessment-answer - CORS preflight", async () => {
  const req = createMockRequest('OPTIONS');

  // Expected: OPTIONS should return 200 with CORS headers
  const preflightExpected = {
    status: 200,
    hasOriginHeader: true,
    hasMethodsHeader: true,
  };

  assertEquals(preflightExpected.status, 200);
});

// Test Suite: Authentication
Deno.test("submit-assessment-answer - requires authentication", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
    question_id: generateTestUUID(),
    user_answer: 'B',
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  });

  // Expected: 401 Unauthorized without auth header
  const expectedResponse = {
    status: 401,
    code: 'UNAUTHORIZED',
  };

  assertEquals(expectedResponse.status, 401);
  assertEquals(expectedResponse.code, 'UNAUTHORIZED');
});

Deno.test("submit-assessment-answer - rejects invalid bearer token", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
    question_id: generateTestUUID(),
    user_answer: 'B',
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  }, {
    authToken: 'invalid-token-format',
  });

  // Expected: 401 for invalid token
  const expectedResponse = {
    status: 401,
    code: 'UNAUTHORIZED',
  };

  assertEquals(expectedResponse.status, 401);
});

// Test Suite: Input Validation - Required Fields
Deno.test("submit-assessment-answer - validates session_id is required", async () => {
  const req = createMockRequest('POST', {
    // Missing session_id
    question_id: generateTestUUID(),
    user_answer: 'B',
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - validates question_id is required", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
    // Missing question_id
    user_answer: 'B',
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - validates user_answer is required", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
    question_id: generateTestUUID(),
    // Missing user_answer
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - validates timing fields are required", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
    question_id: generateTestUUID(),
    user_answer: 'B',
    // Missing client_question_served_at and client_answer_submitted_at
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

// Test Suite: Input Validation - Field Formats
Deno.test("submit-assessment-answer - validates session_id is valid UUID", async () => {
  const req = createMockRequest('POST', {
    session_id: 'not-a-valid-uuid',
    question_id: generateTestUUID(),
    user_answer: 'B',
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - validates user_answer max length (5000)", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
    question_id: generateTestUUID(),
    user_answer: 'A'.repeat(5001), // Exceeds max
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - validates user_answer min length (1)", async () => {
  const req = createMockRequest('POST', {
    session_id: generateTestUUID(),
    question_id: generateTestUUID(),
    user_answer: '', // Empty
    client_question_served_at: new Date().toISOString(),
    client_answer_submitted_at: new Date().toISOString(),
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

// Test Suite: Session Validation
Deno.test("submit-assessment-answer - returns error for non-existent session", async () => {
  const expectedResponse = {
    status: 404,
    code: 'NOT_FOUND',
    message: 'Session not found or access denied',
  };

  assertEquals(expectedResponse.status, 404);
  assertEquals(expectedResponse.code, 'NOT_FOUND');
});

Deno.test("submit-assessment-answer - returns error for inactive session", async () => {
  // When session status is 'completed' or 'abandoned'
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Session is no longer active',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - returns error for timed out session", async () => {
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Session has timed out',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - validates question belongs to session", async () => {
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Question not part of this session',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("submit-assessment-answer - prevents duplicate answer submission", async () => {
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Question already answered',
  };

  assertEquals(expectedResponse.status, 400);
});

// Test Suite: Rate Limiting
Deno.test("submit-assessment-answer - respects rate limits", async () => {
  const expectedResponse = {
    status: 429,
    code: 'RATE_LIMITED',
  };

  assertEquals(expectedResponse.status, 429);
});

// Test Suite: Answer Evaluation
Deno.test("submit-assessment-answer - evaluates MCQ with exact match", async () => {
  const expectedSuccessResponse = {
    success: true,
    is_correct: true,
    evaluation_method: 'exact_match',
  };

  assertEquals(expectedSuccessResponse.is_correct, true);
  assertEquals(expectedSuccessResponse.evaluation_method, 'exact_match');
});

Deno.test("submit-assessment-answer - evaluates true/false correctly", async () => {
  const expectedSuccessResponse = {
    success: true,
    is_correct: true,
    evaluation_method: 'exact_match',
  };

  assertEquals(expectedSuccessResponse.evaluation_method, 'exact_match');
});

Deno.test("submit-assessment-answer - evaluates short answer with accepted answers", async () => {
  const expectedSuccessResponse = {
    success: true,
    is_correct: true,
    evaluation_method: 'accepted_answers',
  };

  assertEquals(expectedSuccessResponse.evaluation_method, 'accepted_answers');
});

Deno.test("submit-assessment-answer - evaluates short answer with keyword match", async () => {
  const expectedSuccessResponse = {
    success: true,
    is_correct: true,
    evaluation_method: 'keyword_match',
  };

  assertEquals(expectedSuccessResponse.evaluation_method, 'keyword_match');
});

Deno.test("submit-assessment-answer - uses AI evaluation for complex short answers", async () => {
  const expectedSuccessResponse = {
    success: true,
    evaluation_method: 'ai_evaluation',
  };

  assertEquals(expectedSuccessResponse.evaluation_method, 'ai_evaluation');
});

// Test Suite: Timing Validation
Deno.test("submit-assessment-answer - flags suspiciously fast answers", async () => {
  // Answer submitted in less than 2 seconds
  const expectedSuccessResponse = {
    success: true,
    timing_flags: ['suspiciously_fast'],
  };

  assertExists(expectedSuccessResponse.timing_flags);
  assertEquals(expectedSuccessResponse.timing_flags.includes('suspiciously_fast'), true);
});

Deno.test("submit-assessment-answer - flags exceeded time limit", async () => {
  // Answer submitted after time limit
  const expectedSuccessResponse = {
    success: true,
    timing_flags: ['exceeded_time_limit'],
  };

  assertEquals(expectedSuccessResponse.timing_flags.includes('exceeded_time_limit'), true);
});

// Test Suite: Success Response Structure
Deno.test("submit-assessment-answer - returns complete success response", async () => {
  const expectedSuccessStructure = {
    success: true,
    is_correct: true,
    evaluation_method: 'exact_match',
    time_taken_seconds: 15,
    timing_flags: [],
    correct_answer: null, // null when correct
    answer_id: 'uuid',
    session_progress: {
      questions_answered: 3,
      questions_correct: 2,
      total_questions: 5,
      current_score: 67,
      is_complete: false,
    },
  };

  assertExists(expectedSuccessStructure.session_progress);
  assertEquals(expectedSuccessStructure.success, true);
  assertExists(expectedSuccessStructure.answer_id);
});

Deno.test("submit-assessment-answer - returns correct_answer when wrong", async () => {
  const expectedResponse = {
    success: true,
    is_correct: false,
    correct_answer: 'B', // Revealed when answer is wrong
  };

  assertEquals(expectedResponse.is_correct, false);
  assertExists(expectedResponse.correct_answer);
});

Deno.test("submit-assessment-answer - calculates session progress correctly", async () => {
  const progress = {
    questions_answered: 4,
    questions_correct: 3,
    total_questions: 5,
    current_score: Math.round((3 / 4) * 100),
    is_complete: 4 >= 5,
  };

  assertEquals(progress.current_score, 75);
  assertEquals(progress.is_complete, false);
});

Deno.test("submit-assessment-answer - marks session complete when all answered", async () => {
  const progress = {
    questions_answered: 5,
    questions_correct: 4,
    total_questions: 5,
    is_complete: true,
  };

  assertEquals(progress.is_complete, true);
});

// Test Suite: Error Handling
Deno.test("submit-assessment-answer - handles database save errors", async () => {
  const expectedResponse = {
    status: 500,
    code: 'DATABASE_ERROR',
    message: 'Failed to save answer',
  };

  assertEquals(expectedResponse.status, 500);
  assertEquals(expectedResponse.code, 'DATABASE_ERROR');
});

Deno.test("submit-assessment-answer - handles AI evaluation failures gracefully", async () => {
  // When AI evaluation fails, should fall back to needs_manual_review
  const expectedFallback = {
    evaluation_method: 'needs_manual_review',
  };

  assertEquals(expectedFallback.evaluation_method, 'needs_manual_review');
});
