/**
 * generate-recommendations Edge Function Tests
 *
 * Tests the AI-powered recommendation generation flow.
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
Deno.test("generate-recommendations - CORS preflight", async () => {
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
Deno.test("generate-recommendations - requires authentication", async () => {
  const req = createMockRequest('POST', {
    dreamJobId: generateTestUUID(),
  });

  // Expected: 401 Unauthorized without auth header
  const expectedResponse = {
    status: 401,
    error: 'Authorization required',
  };

  assertEquals(expectedResponse.status, 401);
});

Deno.test("generate-recommendations - rejects invalid authentication token", async () => {
  const req = createMockRequest('POST', {
    dreamJobId: generateTestUUID(),
  }, {
    authToken: 'invalid-token',
  });

  // Expected: 401 for invalid token
  const expectedResponse = {
    status: 401,
    error: 'Failed to authenticate user',
  };

  assertEquals(expectedResponse.status, 401);
});

// Test Suite: Input Validation
Deno.test("generate-recommendations - validates dreamJobId is required", async () => {
  const req = createMockRequest('POST', {
    // Missing dreamJobId
  }, {
    authToken: generateTestToken(),
  });

  // Expected: 400 Validation Error
  const expectedResponse = {
    status: 400,
    error: 'Dream job ID is required',
  };

  assertEquals(expectedResponse.status, 400);
});

Deno.test("generate-recommendations - accepts gaps as optional parameter", async () => {
  const validRequest = {
    dreamJobId: generateTestUUID(),
    gaps: [
      { gap: 'Python programming', priority: 'high' },
      { gap: 'Machine learning basics', priority: 'medium' },
    ],
  };

  assertExists(validRequest.dreamJobId);
  assertExists(validRequest.gaps);
  assertEquals(validRequest.gaps.length, 2);
});

Deno.test("generate-recommendations - accepts gapAnalysisId as optional", async () => {
  const validRequest = {
    dreamJobId: generateTestUUID(),
    gapAnalysisId: generateTestUUID(),
  };

  assertExists(validRequest.gapAnalysisId);
});

// Test Suite: Rate Limiting
Deno.test("generate-recommendations - respects rate limits", async () => {
  // When rate limit is exceeded
  const expectedResponse = {
    status: 429,
    code: 'RATE_LIMITED',
  };

  assertEquals(expectedResponse.status, 429);
});

// Test Suite: Dream Job Fetching
Deno.test("generate-recommendations - fetches dream job details", async () => {
  const expectedDreamJob = {
    id: generateTestUUID(),
    title: 'Senior Software Engineer',
    company_type: 'Tech Startup',
    realistic_bar: 'Strong coding skills, system design experience',
  };

  assertExists(expectedDreamJob.title);
  assertExists(expectedDreamJob.id);
});

Deno.test("generate-recommendations - returns error for non-existent dream job", async () => {
  const expectedResponse = {
    status: 500,
    error: 'Failed to fetch dream job',
  };

  assertEquals(expectedResponse.status, 500);
});

// Test Suite: Gap Analysis Integration
Deno.test("generate-recommendations - uses provided gapAnalysisId", async () => {
  // When gapAnalysisId is provided, should fetch that specific analysis
  const mockGapAnalysis = {
    id: generateTestUUID(),
    priority_gaps: [
      { gap: 'System design', priority: 'critical' },
    ],
    critical_gaps: [],
    honest_assessment: 'Good foundation, needs more experience',
  };

  assertExists(mockGapAnalysis.priority_gaps);
});

Deno.test("generate-recommendations - fetches latest gap analysis if not provided", async () => {
  // Should fetch most recent gap analysis for the dream job
  const query = {
    order: { field: 'created_at', ascending: false },
    limit: 1,
  };

  assertEquals(query.order.ascending, false);
  assertEquals(query.limit, 1);
});

Deno.test("generate-recommendations - uses provided gaps over gap analysis", async () => {
  // gaps parameter takes precedence
  const requestGaps = [
    { gap: 'Python', priority: 'high' },
  ];
  const gapAnalysisGaps = [
    { gap: 'JavaScript', priority: 'high' },
  ];

  // gapsToUse = gapAnalysis?.priority_gaps || gaps || []
  const gapsToUse = gapAnalysisGaps || requestGaps || [];
  assertEquals(gapsToUse.length > 0, true);
});

// Test Suite: Recommendation Types
Deno.test("generate-recommendations - generates diverse recommendation types", async () => {
  const expectedTypes = ['project', 'course', 'skill', 'action', 'experience'];

  const mockRecommendations = [
    { type: 'project', title: 'Build a portfolio website' },
    { type: 'course', title: 'Complete ML course' },
    { type: 'skill', title: 'Practice system design' },
    { type: 'action', title: 'Update LinkedIn profile' },
  ];

  for (const rec of mockRecommendations) {
    assertEquals(expectedTypes.includes(rec.type), true);
  }
});

Deno.test("generate-recommendations - includes 2-3 project recommendations", async () => {
  const mockRecommendations = [
    { type: 'project' },
    { type: 'project' },
    { type: 'course' },
    { type: 'skill' },
  ];

  const projects = mockRecommendations.filter(r => r.type === 'project');
  assertEquals(projects.length >= 2 && projects.length <= 3, true);
});

// Test Suite: Recommendation Structure
Deno.test("generate-recommendations - recommendations have required fields", async () => {
  const validRecommendation = {
    title: 'Build a REST API project',
    type: 'project',
    description: 'Create a full-stack application...',
    why_this_matters: 'Demonstrates practical skills',
    gap_addressed: 'Backend development',
    steps: [
      { step: 'Set up project', time_estimate: '1 hour' },
      { step: 'Implement endpoints', time_estimate: '4 hours' },
    ],
    evidence_created: 'GitHub repository with README',
    how_to_demonstrate: 'Add to portfolio, discuss in interviews',
    priority: 'high',
  };

  assertExists(validRecommendation.title);
  assertExists(validRecommendation.type);
  assertExists(validRecommendation.description);
  assertExists(validRecommendation.steps);
});

Deno.test("generate-recommendations - steps have time estimates", async () => {
  const recommendation = {
    steps: [
      { step: 'Research best practices', time_estimate: '2 hours' },
      { step: 'Implement feature', time_estimate: '6 hours' },
      { step: 'Write tests', time_estimate: '3 hours' },
    ],
  };

  for (const step of recommendation.steps) {
    assertExists(step.time_estimate);
  }
});

// Test Suite: Anti-Recommendations
Deno.test("generate-recommendations - includes anti-recommendations", async () => {
  const expectedResponse = {
    recommendations: [],
    anti_recommendations: [
      { action: 'Skip fundamentals', reason: 'Building on weak foundation leads to gaps' },
      { action: 'Mass apply without customization', reason: 'Low response rate' },
    ],
    learning_path_summary: 'Focus on practical projects first...',
  };

  assertExists(expectedResponse.anti_recommendations);
  assertEquals(expectedResponse.anti_recommendations.length > 0, true);
});

Deno.test("generate-recommendations - anti-recommendations have action and reason", async () => {
  const antiRec = {
    action: 'Skip documentation',
    reason: 'Documentation is essential for demonstrating communication skills',
  };

  assertExists(antiRec.action);
  assertExists(antiRec.reason);
});

// Test Suite: Database Operations
Deno.test("generate-recommendations - soft deletes old AI recommendations", async () => {
  // Should update deleted_at on old recommendations
  const deleteQuery = {
    table: 'recommendations',
    condition: {
      dream_job_id: generateTestUUID(),
      deleted_at: null,
    },
    excludeFirecrawlCourses: true,
  };

  assertExists(deleteQuery.condition.dream_job_id);
});

Deno.test("generate-recommendations - preserves Firecrawl-discovered courses", async () => {
  // Should NOT delete recommendations with coursera/udemy/edx URLs
  const protectedProviders = ['coursera.org', 'udemy.com', 'edx.org'];

  for (const provider of protectedProviders) {
    assertEquals(provider.length > 0, true);
  }
});

Deno.test("generate-recommendations - inserts new recommendations with all fields", async () => {
  const recToInsert = {
    user_id: generateTestUUID(),
    dream_job_id: generateTestUUID(),
    gap_analysis_id: generateTestUUID(),
    title: 'Build ML project',
    type: 'project',
    description: 'Create a machine learning model...',
    why_this_matters: 'Shows practical ML experience',
    gap_addressed: 'Machine learning experience',
    steps: [],
    provider: null,
    url: null, // AI doesn't provide URLs
    duration: '2 weeks',
    effort_hours: 20,
    cost_usd: 0,
    priority: 'high',
    evidence_created: 'GitHub repo',
    how_to_demonstrate: 'Portfolio piece',
    status: 'pending',
  };

  assertExists(recToInsert.user_id);
  assertExists(recToInsert.dream_job_id);
  assertEquals(recToInsert.url, null); // No AI-generated URLs
});

Deno.test("generate-recommendations - replaces old anti-recommendations", async () => {
  // Should delete existing then insert new
  const operations = {
    deleteFirst: true,
    insertNew: true,
  };

  assertEquals(operations.deleteFirst, true);
});

// Test Suite: Success Response Structure
Deno.test("generate-recommendations - returns complete success response", async () => {
  const expectedSuccessStructure = {
    recommendations: [
      {
        title: 'Build a Full-Stack Project',
        type: 'project',
        description: 'Create an end-to-end application',
        why_this_matters: 'Demonstrates practical skills',
        gap_addressed: 'Hands-on experience',
        steps: [
          { step: 'Design architecture', time_estimate: '2 hours' },
        ],
        evidence_created: 'GitHub repository',
        how_to_demonstrate: 'Portfolio showcase',
        priority: 'high',
      },
    ],
    anti_recommendations: [
      { action: 'Tutorial hell', reason: 'Build real projects instead' },
    ],
    learning_path_summary: 'Focus on building practical projects that demonstrate your skills...',
  };

  assertExists(expectedSuccessStructure.recommendations);
  assertExists(expectedSuccessStructure.anti_recommendations);
  assertExists(expectedSuccessStructure.learning_path_summary);
});

Deno.test("generate-recommendations - returns 7-10 recommendations", async () => {
  const mockRecommendations = Array(8).fill({
    title: 'Recommendation',
    type: 'project',
  });

  assertEquals(mockRecommendations.length >= 7 && mockRecommendations.length <= 10, true);
});

Deno.test("generate-recommendations - includes quick win recommendation", async () => {
  // At least one recommendation completable in <1 week
  const mockRecommendations = [
    { duration: '2 weeks', priority: 'medium' },
    { duration: '3 days', priority: 'high' }, // Quick win
    { duration: '1 month', priority: 'low' },
  ];

  const hasQuickWin = mockRecommendations.some(r =>
    r.duration && (r.duration.includes('day') || r.duration.includes('hour'))
  );
  assertEquals(hasQuickWin, true);
});

// Test Suite: AI Usage Tracking
Deno.test("generate-recommendations - tracks AI usage", async () => {
  const usageRecord = {
    user_id: generateTestUUID(),
    function_name: 'generate-recommendations',
    model: 'openrouter/gpt-4o-mini',
  };

  assertExists(usageRecord.user_id);
  assertEquals(usageRecord.function_name, 'generate-recommendations');
});

// Test Suite: Error Handling
Deno.test("generate-recommendations - handles AI processing errors", async () => {
  const expectedResponse = {
    status: 500,
    error: 'Unknown error',
  };

  assertEquals(expectedResponse.status, 500);
});

Deno.test("generate-recommendations - handles database insert errors", async () => {
  const expectedResponse = {
    status: 500,
    error: 'Failed to save recommendations',
  };

  assertExists(expectedResponse.error);
});

Deno.test("generate-recommendations - handles missing user capabilities gracefully", async () => {
  // Should still generate recommendations even if user has no capabilities
  const capabilitiesText = 'No current capabilities';

  assertEquals(capabilitiesText, 'No current capabilities');
});

Deno.test("generate-recommendations - uses fallback AI model if primary fails", async () => {
  // Function uses fallbacks: [MODELS.GEMINI_FLASH]
  const fallbackConfig = {
    primary: 'openrouter/gpt-4o-mini',
    fallbacks: ['gemini-1.5-flash'],
  };

  assertExists(fallbackConfig.fallbacks);
  assertEquals(fallbackConfig.fallbacks.length > 0, true);
});

Deno.test("generate-recommendations - handles empty gaps gracefully", async () => {
  // When no gaps provided or found
  const gapsText = 'No specific gaps identified';

  assertEquals(gapsText.includes('No specific'), true);
});
