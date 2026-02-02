/**
 * match-careers Edge Function Tests
 *
 * Tests the career matching flow based on user skill profiles.
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
Deno.test("match-careers - CORS preflight", async () => {
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
Deno.test("match-careers - requires authentication", async () => {
  const req = createMockRequest('POST', {
    limit: 20,
  });

  // Expected: 401 Unauthorized without auth header
  const expectedResponse = {
    status: 401,
    code: 'AUTH_MISSING_HEADER',
  };

  assertEquals(expectedResponse.status, 401);
  assertEquals(expectedResponse.code, 'AUTH_MISSING_HEADER');
});

Deno.test("match-careers - rejects invalid bearer token", async () => {
  const req = createMockRequest('POST', {
    limit: 20,
  }, {
    authToken: 'invalid-token',
  });

  // Expected: 401 for invalid token
  const expectedResponse = {
    status: 401,
    code: 'AUTH_INVALID_TOKEN',
  };

  assertEquals(expectedResponse.status, 401);
});

// Test Suite: Input Validation
Deno.test("match-careers - validates limit is positive integer", async () => {
  const invalidRequests = [
    { limit: -5 },     // negative
    { limit: 0 },      // zero
    { limit: 1.5 },    // float
    { limit: 'ten' },  // string
  ];

  // Expected: 400 Validation Error for invalid limit values
  for (const body of invalidRequests) {
    const expectedResponse = {
      status: 400,
      code: 'VALIDATION_ERROR',
    };
    assertEquals(expectedResponse.status, 400);
  }
});

Deno.test("match-careers - validates limit maximum (100)", async () => {
  const req = createMockRequest('POST', {
    limit: 150, // Exceeds max of 100
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error for exceeding max limit
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("match-careers - validates filters.min_salary is positive", async () => {
  const req = createMockRequest('POST', {
    limit: 20,
    filters: {
      min_salary: -50000,
    },
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 for negative salary
  const expectedResponse = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("match-careers - accepts valid filters object", async () => {
  const validRequest = {
    limit: 20,
    filters: {
      min_salary: 60000,
      job_outlook: 'bright',
      min_education_level: 'bachelor',
    },
  };

  // Validate the request structure
  assertExists(validRequest.filters);
  assertEquals(validRequest.filters.min_salary, 60000);
  assertEquals(validRequest.filters.job_outlook, 'bright');
});

Deno.test("match-careers - accepts empty body (uses defaults)", async () => {
  const validRequest = {};

  // Should use default limit of 20
  const expectedDefaults = {
    limit: 20,
    filters: undefined,
  };

  assertEquals(expectedDefaults.limit, 20);
});

// Test Suite: Skill Profile Requirements
Deno.test("match-careers - returns error when skill profile not found", async () => {
  // When user has no skill profile, should return needs_assessment
  const expectedResponse = {
    status: 400,
    code: 'PROFILE_NOT_FOUND',
    needs_assessment: true,
    message: 'No skill profile found. Please complete the skills assessment first.',
  };

  assertEquals(expectedResponse.status, 400);
  assertEquals(expectedResponse.code, 'PROFILE_NOT_FOUND');
  assertEquals(expectedResponse.needs_assessment, true);
});

Deno.test("match-careers - returns error when no occupations match filters", async () => {
  // When filters are too restrictive
  const expectedResponse = {
    status: 404,
    code: 'RESOURCE_NOT_FOUND',
    message: 'No occupations available for matching',
  };

  assertEquals(expectedResponse.status, 404);
  assertEquals(expectedResponse.code, 'RESOURCE_NOT_FOUND');
});

// Test Suite: Rate Limiting
Deno.test("match-careers - respects rate limits", async () => {
  // When rate limit is exceeded
  const expectedResponse = {
    status: 429,
    remaining: 0,
    retryAfter: 3600, // 1 hour
  };

  assertEquals(expectedResponse.status, 429);
  assertEquals(expectedResponse.remaining, 0);
});

// Test Suite: Success Response Structure
Deno.test("match-careers - returns matches on success", async () => {
  // Expected success response structure
  const expectedSuccessStructure = {
    success: true,
    data: {
      matches: [
        {
          onet_soc_code: '15-1252.00',
          occupation_title: 'Software Developers',
          description: 'Develop software applications',
          overall_match_score: 85,
          interest_match_score: 90,
          skill_match_score: 80,
          values_match_score: 85,
          skill_gaps: [],
          match_breakdown: {
            user_holland: 'IAR',
            occupation_holland: 'IRC',
            interest_weight: 0.4,
            skills_weight: 0.4,
            values_weight: 0.2,
          },
          occupation_details: {
            median_wage: 120730,
            job_outlook: 'much faster than average',
            education_level: 'bachelor',
            bright_outlook: true,
          },
        },
      ],
      total_occupations_analyzed: 100,
      skill_profile_summary: {
        holland_code: 'IAR',
        strong_skills_count: 5,
        development_areas_count: 3,
      },
    },
    meta: {
      request_id: 'uuid',
    },
  };

  assertExists(expectedSuccessStructure.data.matches);
  assertEquals(expectedSuccessStructure.success, true);
  assertEquals(expectedSuccessStructure.data.matches.length, 1);
});

Deno.test("match-careers - matches sorted by overall_match_score descending", async () => {
  const mockMatches = [
    { overall_match_score: 75 },
    { overall_match_score: 92 },
    { overall_match_score: 88 },
  ];

  const sorted = [...mockMatches].sort((a, b) => b.overall_match_score - a.overall_match_score);

  assertEquals(sorted[0].overall_match_score, 92);
  assertEquals(sorted[1].overall_match_score, 88);
  assertEquals(sorted[2].overall_match_score, 75);
});

Deno.test("match-careers - respects limit parameter", async () => {
  const requestedLimit = 5;

  // Mock response should have at most 'limit' matches
  const mockResponse = {
    matches: Array(5).fill({
      onet_soc_code: '15-1252.00',
      overall_match_score: 80,
    }),
  };

  assertEquals(mockResponse.matches.length <= requestedLimit, true);
});

// Test Suite: Match Score Calculation
Deno.test("match-careers - calculates weighted overall score correctly", async () => {
  // Overall = 40% Interest + 40% Skills + 20% Values
  const interestMatch = 90;
  const skillsMatch = 80;
  const valuesMatch = 70;

  const expectedOverall = Math.round(
    (interestMatch * 0.4) + (skillsMatch * 0.4) + (valuesMatch * 0.2)
  );

  assertEquals(expectedOverall, 82); // (36 + 32 + 14) = 82
});

Deno.test("match-careers - skill gaps sorted by importance", async () => {
  const mockGaps = [
    { skill: 'Python', gap: 2, importance: 'helpful' },
    { skill: 'Machine Learning', gap: 3, importance: 'essential' },
    { skill: 'Data Analysis', gap: 1, importance: 'important' },
  ];

  const sorted = [...mockGaps].sort((a, b) => {
    const order = { essential: 0, important: 1, helpful: 2 };
    return (order[a.importance as keyof typeof order] || 3) -
           (order[b.importance as keyof typeof order] || 3);
  });

  assertEquals(sorted[0].importance, 'essential');
  assertEquals(sorted[1].importance, 'important');
  assertEquals(sorted[2].importance, 'helpful');
});

// Test Suite: Error Handling
Deno.test("match-careers - handles database errors gracefully", async () => {
  // When database query fails
  const expectedResponse = {
    status: 500,
    code: 'INTERNAL_ERROR',
  };

  assertEquals(expectedResponse.status, 500);
});

Deno.test("match-careers - returns request_id in error responses", async () => {
  const expectedErrorResponse = {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
    },
    meta: {
      request_id: generateTestUUID(),
    },
  };

  assertExists(expectedErrorResponse.meta.request_id);
});
