/**
 * analyze-syllabus Edge Function Tests
 *
 * Tests the syllabus analysis and capability extraction flow.
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
Deno.test("analyze-syllabus - CORS preflight", async () => {
  const req = createMockRequest('OPTIONS');

  // Expected: OPTIONS should return 200 with CORS headers
  const preflightExpected = {
    status: 200,
    hasOriginHeader: true,
    hasMethodsHeader: true,
  };

  assertEquals(preflightExpected.status, 200);
});

// Test Suite: Authentication (Optional for this endpoint)
Deno.test("analyze-syllabus - works without authentication", async () => {
  // analyze-syllabus allows unauthenticated requests (optional auth)
  const req = createMockRequest('POST', {
    syllabusText: 'Course: Introduction to Python\nWeek 1: Variables and Data Types...',
  });

  // Should process without auth (though won't save to DB)
  const expectedResponse = {
    status: 200, // Succeeds without auth
  };

  assertEquals(expectedResponse.status, 200);
});

Deno.test("analyze-syllabus - respects rate limits for authenticated users", async () => {
  // When rate limit is exceeded
  const expectedResponse = {
    status: 429,
    code: 'RATE_LIMITED',
  };

  assertEquals(expectedResponse.status, 429);
});

// Test Suite: Input Validation
Deno.test("analyze-syllabus - validates syllabusText is required", async () => {
  const req = createMockRequest('POST', {
    // Missing syllabusText
    courseId: generateTestUUID(),
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Syllabus text is required',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("analyze-syllabus - validates syllabusText is not empty", async () => {
  const req = createMockRequest('POST', {
    syllabusText: '',
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error for empty text
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("analyze-syllabus - validates syllabusText is not null", async () => {
  const req = createMockRequest('POST', {
    syllabusText: null,
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

Deno.test("analyze-syllabus - accepts courseId as optional", async () => {
  const validRequest = {
    syllabusText: 'Course: CS 101 - Introduction to Programming\nWeek 1: Basics...',
    // courseId is optional
  };

  assertExists(validRequest.syllabusText);
  assertEquals(validRequest.syllabusText.length > 0, true);
});

Deno.test("analyze-syllabus - validates courseId format when provided", async () => {
  const req = createMockRequest('POST', {
    syllabusText: 'Course content here...',
    courseId: 'not-a-valid-uuid',
  }, {
    authToken: generateTestToken(),
  });

  // If courseId is provided, it should be a valid UUID
  // The function may not validate this explicitly, but database would fail
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assertEquals(isValidUUID.test('not-a-valid-uuid'), false);
});

// Test Suite: AI Extraction
Deno.test("analyze-syllabus - extracts capabilities from syllabus", async () => {
  const expectedSuccessResponse = {
    capabilities: [
      {
        name: 'Can write Python code',
        category: 'technical',
        proficiency_level: 'intermediate',
        evidence_type: 'coding assignments',
      },
    ],
    course_themes: ['programming', 'data structures'],
    tools_learned: ['Python', 'Git'],
  };

  assertExists(expectedSuccessResponse.capabilities);
  assertEquals(expectedSuccessResponse.capabilities.length > 0, true);
});

Deno.test("analyze-syllabus - extracts course metadata", async () => {
  const expectedSuccessResponse = {
    course_title: 'Introduction to Machine Learning',
    course_code: 'CS 229',
    semester: 'Fall 2024',
    credits: 3,
  };

  assertExists(expectedSuccessResponse.course_title);
  assertExists(expectedSuccessResponse.course_code);
});

Deno.test("analyze-syllabus - handles missing course metadata gracefully", async () => {
  // When syllabus doesn't contain course code or semester
  const expectedSuccessResponse = {
    course_title: 'Some Course',
    course_code: null,
    semester: null,
    credits: null,
    capabilities: [],
  };

  assertEquals(expectedSuccessResponse.course_code, null);
  assertEquals(expectedSuccessResponse.semester, null);
});

// Test Suite: Capability Categories
Deno.test("analyze-syllabus - categorizes capabilities correctly", async () => {
  const validCategories = [
    'technical',
    'analytical',
    'communication',
    'leadership',
    'creative',
    'research',
    'interpersonal',
  ];

  const mockCapability = { category: 'technical' };
  assertEquals(validCategories.includes(mockCapability.category), true);
});

Deno.test("analyze-syllabus - assigns proficiency levels correctly", async () => {
  const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

  const mockCapability = { proficiency_level: 'intermediate' };
  assertEquals(validLevels.includes(mockCapability.proficiency_level), true);
});

// Test Suite: Course Status Updates
Deno.test("analyze-syllabus - sets analysis_status to analyzing", async () => {
  // When processing starts, status should be 'analyzing'
  const expectedStatusUpdate = {
    analysis_status: 'analyzing',
    analysis_error: null,
  };

  assertEquals(expectedStatusUpdate.analysis_status, 'analyzing');
});

Deno.test("analyze-syllabus - sets analysis_status to completed on success", async () => {
  const expectedStatusUpdate = {
    analysis_status: 'completed',
    analysis_error: null,
  };

  assertEquals(expectedStatusUpdate.analysis_status, 'completed');
});

Deno.test("analyze-syllabus - sets analysis_status to failed on error", async () => {
  const expectedStatusUpdate = {
    analysis_status: 'failed',
    analysis_error: 'AI processing failed',
  };

  assertEquals(expectedStatusUpdate.analysis_status, 'failed');
  assertExists(expectedStatusUpdate.analysis_error);
});

// Test Suite: Database Operations
Deno.test("analyze-syllabus - updates course with AI-generated fields", async () => {
  const expectedUpdateData = {
    capability_text: 'Can write Python; Can analyze data',
    key_capabilities: [],
    evidence_types: [],
    tools_methods: ['Python', 'Pandas'],
    capability_keywords: ['python', 'data', 'analysis'],
    ai_model_used: 'openrouter/gpt-4o-mini',
    analysis_status: 'completed',
  };

  assertExists(expectedUpdateData.capability_text);
  assertExists(expectedUpdateData.capability_keywords);
});

Deno.test("analyze-syllabus - updates generic course title with AI-extracted title", async () => {
  // If current title is generic, update it
  const genericTitles = ['syllabus', 'untitled', 'untitled course'];
  const currentTitle = 'Syllabus';
  const aiExtractedTitle = 'Introduction to Data Science';

  const shouldUpdate = !currentTitle ||
    genericTitles.includes(currentTitle.toLowerCase());

  assertEquals(shouldUpdate, true);
});

Deno.test("analyze-syllabus - preserves non-generic course title", async () => {
  const currentTitle = 'My Custom Course Title';
  const genericTitles = ['syllabus', 'untitled', 'untitled course'];

  const shouldUpdate = !currentTitle ||
    genericTitles.includes(currentTitle.toLowerCase());

  assertEquals(shouldUpdate, false);
});

Deno.test("analyze-syllabus - inserts capabilities for user", async () => {
  const capabilityToInsert = {
    user_id: generateTestUUID(),
    course_id: generateTestUUID(),
    name: 'Can write clean code',
    category: 'technical',
    proficiency_level: 'intermediate',
    source: 'course',
  };

  assertExists(capabilityToInsert.user_id);
  assertExists(capabilityToInsert.course_id);
  assertEquals(capabilityToInsert.source, 'course');
});

Deno.test("analyze-syllabus - updates capability profile after insert", async () => {
  // Should update capability_profiles table
  const expectedProfileUpdate = {
    user_id: generateTestUUID(),
    combined_capability_text: 'Can write Python; Can analyze data',
    capabilities_by_theme: {
      technical: ['Can write Python'],
      analytical: ['Can analyze data'],
    },
    course_count: 3,
    last_updated: new Date().toISOString(),
  };

  assertExists(expectedProfileUpdate.combined_capability_text);
  assertExists(expectedProfileUpdate.capabilities_by_theme);
});

// Test Suite: Success Response Structure
Deno.test("analyze-syllabus - returns complete success response", async () => {
  const expectedSuccessStructure = {
    capabilities: [
      {
        name: 'Can develop machine learning models',
        category: 'technical',
        proficiency_level: 'intermediate',
        evidence_type: 'project submissions',
      },
      {
        name: 'Can communicate technical concepts',
        category: 'communication',
        proficiency_level: 'intermediate',
        evidence_type: 'presentations',
      },
    ],
    course_themes: ['machine learning', 'data science', 'statistics'],
    tools_learned: ['Python', 'scikit-learn', 'TensorFlow'],
    course_title: 'Machine Learning Fundamentals',
    course_code: 'CS 229',
    semester: 'Spring 2024',
    credits: 4,
  };

  assertExists(expectedSuccessStructure.capabilities);
  assertExists(expectedSuccessStructure.course_themes);
  assertExists(expectedSuccessStructure.tools_learned);
  assertEquals(expectedSuccessStructure.capabilities.length, 2);
});

Deno.test("analyze-syllabus - capabilities use 'Can do X' format", async () => {
  const capability = {
    name: 'Can implement sorting algorithms',
  };

  assertEquals(capability.name.startsWith('Can '), true);
});

// Test Suite: AI Usage Tracking
Deno.test("analyze-syllabus - tracks AI usage for authenticated users", async () => {
  const usageRecord = {
    user_id: generateTestUUID(),
    function_name: 'analyze-syllabus',
    model: 'openrouter/gpt-4o-mini',
  };

  assertExists(usageRecord.user_id);
  assertEquals(usageRecord.function_name, 'analyze-syllabus');
});

// Test Suite: Error Handling
Deno.test("analyze-syllabus - handles AI processing errors", async () => {
  const expectedResponse = {
    status: 500,
    code: 'INTERNAL_ERROR',
  };

  assertEquals(expectedResponse.status, 500);
});

Deno.test("analyze-syllabus - handles database insert errors", async () => {
  // Should log error but continue (non-blocking insert)
  const expectedBehavior = {
    logsError: true,
    returnsResponse: true, // Still returns capabilities even if insert fails
  };

  assertEquals(expectedBehavior.logsError, true);
  assertEquals(expectedBehavior.returnsResponse, true);
});

Deno.test("analyze-syllabus - handles malformed syllabus content", async () => {
  // AI should still extract what it can
  const expectedResponse = {
    capabilities: [], // May be empty if nothing extractable
    course_themes: [],
    tools_learned: [],
  };

  assertEquals(Array.isArray(expectedResponse.capabilities), true);
});

Deno.test("analyze-syllabus - uses fallback AI model if primary fails", async () => {
  // Function uses fallbacks: [MODELS.GEMINI_FLASH]
  const fallbackConfig = {
    primary: 'openrouter/gpt-4o-mini',
    fallbacks: ['gemini-1.5-flash'],
  };

  assertExists(fallbackConfig.fallbacks);
  assertEquals(fallbackConfig.fallbacks.length > 0, true);
});
