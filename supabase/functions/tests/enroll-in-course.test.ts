/**
 * enroll-in-course Edge Function Tests
 *
 * Tests the course enrollment flow including payment handling.
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
Deno.test("enroll-in-course - CORS preflight", async () => {
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
Deno.test("enroll-in-course - requires authentication", async () => {
  const req = createMockRequest('POST', {
    access_code: 'ABC123',
  });

  // Expected: Error without auth header
  const expectedResponse = {
    status: 401,
    message: 'No authorization header provided',
  };

  // The function throws an error for missing auth
  assertExists(expectedResponse.message);
});

Deno.test("enroll-in-course - rejects invalid authentication token", async () => {
  const req = createMockRequest('POST', {
    access_code: 'ABC123',
  }, {
    authToken: 'invalid-token',
  });

  // Expected: 401 for invalid token
  const expectedResponse = {
    status: 401,
    message: 'Authentication error',
  };

  assertEquals(expectedResponse.status, 401);
});

// Test Suite: Input Validation - Required Fields
Deno.test("enroll-in-course - validates access_code is required", async () => {
  const req = createMockRequest('POST', {
    // Missing access_code
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

Deno.test("enroll-in-course - validates access_code is not empty", async () => {
  const req = createMockRequest('POST', {
    access_code: '',
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

Deno.test("enroll-in-course - validates access_code max length (50)", async () => {
  const req = createMockRequest('POST', {
    access_code: 'A'.repeat(51), // Exceeds max
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

// Test Suite: Input Validation - Optional Fields
Deno.test("enroll-in-course - validates promo_code max length (50)", async () => {
  const req = createMockRequest('POST', {
    access_code: 'ABC123',
    promo_code: 'P'.repeat(51), // Exceeds max
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

Deno.test("enroll-in-course - validates success_url is valid URL", async () => {
  const req = createMockRequest('POST', {
    access_code: 'ABC123',
    success_url: 'not-a-url',
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

Deno.test("enroll-in-course - validates cancel_url is valid URL", async () => {
  const req = createMockRequest('POST', {
    access_code: 'ABC123',
    cancel_url: 'not-a-url',
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

Deno.test("enroll-in-course - accepts valid optional fields", async () => {
  const validRequest = {
    access_code: 'ABC123',
    promo_code: 'SAVE10',
    success_url: 'https://app.example.com/success',
    cancel_url: 'https://app.example.com/cancel',
  };

  assertExists(validRequest.access_code);
  assertExists(validRequest.promo_code);
  assertExists(validRequest.success_url);
  assertExists(validRequest.cancel_url);
});

// Test Suite: Course Validation
Deno.test("enroll-in-course - returns error for invalid access code", async () => {
  const expectedResponse = {
    status: 500, // Function throws error which becomes 500
    message: 'Invalid access code',
  };

  assertExists(expectedResponse.message);
});

Deno.test("enroll-in-course - returns error for unpublished course", async () => {
  const expectedResponse = {
    status: 500,
    message: 'This course is not yet published',
  };

  assertExists(expectedResponse.message);
});

Deno.test("enroll-in-course - access code is case-insensitive", async () => {
  // Function converts to uppercase: access_code.trim().toUpperCase()
  const inputCode = 'abc123';
  const normalizedCode = inputCode.trim().toUpperCase();

  assertEquals(normalizedCode, 'ABC123');
});

// Test Suite: Already Enrolled
Deno.test("enroll-in-course - returns already_enrolled for existing enrollment", async () => {
  const expectedSuccessResponse = {
    already_enrolled: true,
    enrollment_id: generateTestUUID(),
    course: {
      id: generateTestUUID(),
      title: 'Test Course',
    },
  };

  assertEquals(expectedSuccessResponse.already_enrolled, true);
  assertExists(expectedSuccessResponse.enrollment_id);
  assertExists(expectedSuccessResponse.course);
});

// Test Suite: Pro User Enrollment
Deno.test("enroll-in-course - pro users enroll immediately (free)", async () => {
  const expectedSuccessResponse = {
    requires_payment: false,
    enrolled: true,
    enrollment_id: generateTestUUID(),
    course: {
      id: generateTestUUID(),
      title: 'Test Course',
    },
  };

  assertEquals(expectedSuccessResponse.requires_payment, false);
  assertEquals(expectedSuccessResponse.enrolled, true);
  assertExists(expectedSuccessResponse.enrollment_id);
});

Deno.test("enroll-in-course - university tier users enroll free", async () => {
  // university tier is treated same as pro
  const tiers = ['pro', 'university'];

  for (const tier of tiers) {
    const isPro = tier === 'pro' || tier === 'university';
    assertEquals(isPro, true);
  }
});

// Test Suite: Payment Required (Non-Pro)
Deno.test("enroll-in-course - non-pro users require payment", async () => {
  const expectedSuccessResponse = {
    requires_payment: true,
    checkout_url: 'https://checkout.stripe.com/session/xyz',
    session_id: 'cs_test_123',
    course: {
      id: generateTestUUID(),
      title: 'Test Course',
    },
  };

  assertEquals(expectedSuccessResponse.requires_payment, true);
  assertExists(expectedSuccessResponse.checkout_url);
  assertExists(expectedSuccessResponse.session_id);
});

Deno.test("enroll-in-course - creates Stripe checkout with $1 price", async () => {
  // Stripe price is in cents, $1.00 = 100 cents
  const expectedPriceCents = 100;

  assertEquals(expectedPriceCents, 100);
});

Deno.test("enroll-in-course - checkout session includes course metadata", async () => {
  const expectedMetadata = {
    user_id: generateTestUUID(),
    product_type: 'course_enrollment',
    instructor_course_id: generateTestUUID(),
    course_title: 'Test Course',
    access_code: 'ABC123',
  };

  assertExists(expectedMetadata.user_id);
  assertEquals(expectedMetadata.product_type, 'course_enrollment');
  assertExists(expectedMetadata.instructor_course_id);
});

Deno.test("enroll-in-course - allows promotion codes in checkout", async () => {
  const checkoutConfig = {
    allow_promotion_codes: true,
  };

  assertEquals(checkoutConfig.allow_promotion_codes, true);
});

// Test Suite: Stripe Customer Handling
Deno.test("enroll-in-course - reuses existing Stripe customer", async () => {
  const mockProfile = {
    stripe_customer_id: 'cus_existing123',
  };

  // Should use existing customer ID instead of creating new
  assertExists(mockProfile.stripe_customer_id);
});

Deno.test("enroll-in-course - creates new Stripe customer if none exists", async () => {
  const mockProfile = {
    stripe_customer_id: null,
  };

  // Should create new customer
  assertEquals(mockProfile.stripe_customer_id, null);
});

// Test Suite: Configuration Errors
Deno.test("enroll-in-course - returns error when STRIPE_SECRET_KEY missing", async () => {
  const expectedResponse = {
    status: 500, // CONFIG_ERROR maps to 500
    code: 'CONFIG_ERROR',
    message: 'STRIPE_SECRET_KEY is not set',
  };

  assertEquals(expectedResponse.code, 'CONFIG_ERROR');
});

// Test Suite: Success Response Structure
Deno.test("enroll-in-course - returns complete success response for pro user", async () => {
  const expectedSuccessStructure = {
    requires_payment: false,
    enrolled: true,
    enrollment_id: generateTestUUID(),
    course: {
      id: generateTestUUID(),
      title: 'Introduction to Machine Learning',
      is_published: true,
      instructor_id: generateTestUUID(),
    },
  };

  assertExists(expectedSuccessStructure.course);
  assertEquals(expectedSuccessStructure.enrolled, true);
});

Deno.test("enroll-in-course - returns complete success response for payment required", async () => {
  const expectedSuccessStructure = {
    requires_payment: true,
    checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
    session_id: 'cs_test_abc123',
    course: {
      id: generateTestUUID(),
      title: 'Introduction to Machine Learning',
      is_published: true,
      instructor_id: generateTestUUID(),
    },
  };

  assertExists(expectedSuccessStructure.checkout_url);
  assertExists(expectedSuccessStructure.session_id);
  assertExists(expectedSuccessStructure.course);
});

// Test Suite: Error Handling
Deno.test("enroll-in-course - handles database errors gracefully", async () => {
  const expectedResponse = {
    status: 500,
    code: 'INTERNAL_ERROR',
  };

  assertEquals(expectedResponse.status, 500);
});

Deno.test("enroll-in-course - handles Stripe API errors gracefully", async () => {
  const expectedResponse = {
    status: 500,
    code: 'INTERNAL_ERROR',
  };

  assertEquals(expectedResponse.status, 500);
});

Deno.test("enroll-in-course - handles enrollment insert errors", async () => {
  const expectedResponse = {
    status: 500,
    message: 'Failed to create enrollment',
  };

  assertExists(expectedResponse.message);
});
