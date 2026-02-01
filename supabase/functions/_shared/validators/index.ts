/**
 * Zod Schema Validation Library
 *
 * Centralized input validation for all edge functions.
 * Uses Zod for runtime type safety and validation.
 *
 * USAGE:
 *   import { validateRequest, assessmentStartSchema } from "../_shared/validators/index.ts";
 *
 *   const body = await req.json();
 *   const validation = validateRequest(assessmentStartSchema, body);
 *   if (!validation.success) {
 *     return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
 *   }
 *   const { data } = validation;
 */

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================================
// COMMON FIELD VALIDATORS
// ============================================================================

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const dateSchema = z.string().datetime();

// Positive number validators
export const positiveIntSchema = z.number().int().positive();
export const positiveNumberSchema = z.number().positive();

// ============================================================================
// ASSESSMENT SCHEMAS
// ============================================================================

export const assessmentStartSchema = z.object({
  learning_objective_id: uuidSchema,
  num_questions: z.number().min(1).max(20).optional().default(5),
  difficulty_preference: z.enum(['easy', 'medium', 'hard', 'adaptive']).optional(),
});

export const assessmentAnswerSchema = z.object({
  session_id: uuidSchema,
  question_id: uuidSchema,
  user_answer: z.string().min(1).max(5000),
  client_question_served_at: z.string(),
  client_answer_submitted_at: z.string(),
});

export const skillsAssessmentSchema = z.object({
  skill_names: z.array(z.string().min(1)).min(1).max(10),
  assessment_type: z.enum(['quick', 'comprehensive', 'adaptive']).optional(),
});

// ============================================================================
// DREAM JOB & CAREER SCHEMAS
// ============================================================================

export const dreamJobSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  company_type: z.string().max(100).optional(),
  target_salary_min: positiveNumberSchema.optional(),
  target_salary_max: positiveNumberSchema.optional(),
  location_preference: z.string().max(100).optional(),
});

export const gapAnalysisSchema = z.object({
  dreamJobId: uuidSchema,
});

// ============================================================================
// COURSE & ENROLLMENT SCHEMAS
// ============================================================================

export const courseEnrollmentSchema = z.object({
  course_id: uuidSchema,
  payment_intent_id: z.string().optional(),
});

export const syllabusParseSchema = z.object({
  course_id: uuidSchema,
  syllabus_text: z.string().min(100).max(100000).optional(),
  file_url: urlSchema.optional(),
});

// ============================================================================
// CONTENT & SEARCH SCHEMAS
// ============================================================================

export const contentSearchSchema = z.object({
  query: z.string().min(2).max(200),
  filters: z.object({
    provider: z.array(z.string()).optional(),
    duration_max: positiveNumberSchema.optional(),
    free_only: z.boolean().optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  }).optional(),
  limit: z.number().min(1).max(50).optional().default(10),
  offset: z.number().min(0).optional().default(0),
});

export const youtubeSearchSchema = z.object({
  query: z.string().min(2).max(200),
  maxResults: z.number().min(1).max(50).optional().default(10),
  learning_objective_id: uuidSchema.optional(),
});

// ============================================================================
// LECTURE GENERATION SCHEMAS
// ============================================================================

export const lectureGenerationSchema = z.object({
  teaching_unit_id: uuidSchema,
  style: z.enum(['standard', 'detailed', 'concise']).optional().default('standard'),
  regenerate: z.boolean().optional().default(false),
  user_id: uuidSchema.optional(), // For queue-based calls
  _from_queue: z.boolean().optional(),
});

export const lectureAudioSchema = z.object({
  slideId: uuidSchema,
  voice: z.string().optional().default('en-US-Neural2-D'),
  enableSSML: z.boolean().optional().default(true),
  enableSegmentMapping: z.boolean().optional().default(true),
});

// ============================================================================
// WEBHOOK & EMPLOYER SCHEMAS
// ============================================================================

export const webhookCreateSchema = z.object({
  employer_account_id: uuidSchema,
  url: urlSchema.refine(url => url.startsWith('https://'), 'HTTPS required'),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(), // Auto-generated if not provided
});

export const employerVerificationSchema = z.object({
  credential_id: uuidSchema,
  student_email: emailSchema.optional(),
  verification_code: z.string().optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const checkoutSessionSchema = z.object({
  price_id: z.string().min(1),
  success_url: urlSchema,
  cancel_url: urlSchema,
  mode: z.enum(['subscription', 'payment']).optional().default('subscription'),
});

export const coursePaymentSchema = z.object({
  course_id: uuidSchema,
  price_cents: positiveIntSchema,
  currency: z.string().length(3).optional().default('usd'),
});

// ============================================================================
// ORGANIZATION SCHEMAS
// ============================================================================

export const inviteUsersSchema = z.object({
  emails: z.array(emailSchema).min(1).max(50),
  role: z.enum(['member', 'admin', 'instructor']).optional().default('member'),
  organization_id: uuidSchema.optional(),
});

export const ssoConfigSchema = z.object({
  organization_id: uuidSchema,
  provider: z.enum(['google', 'microsoft', 'okta', 'custom']),
  metadata_url: urlSchema.optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
});

// ============================================================================
// IDENTITY VERIFICATION SCHEMAS
// ============================================================================

export const idvInitiateSchema = z.object({
  return_url: urlSchema,
  purpose: z.enum(['instructor_verification', 'certificate_issuance', 'employer_verification']),
});

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export type ValidationSuccess<T> = { success: true; data: T };
export type ValidationFailure = { success: false; errors: string[] };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate request data against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate (usually from req.json())
 * @returns Validation result with typed data or error messages
 *
 * @example
 * const validation = validateRequest(assessmentStartSchema, body);
 * if (!validation.success) {
 *   return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
 * }
 * const { learning_objective_id, num_questions } = validation.data;
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Extract validation errors as a formatted string
 */
export function formatValidationErrors(errors: z.ZodError): string {
  return errors.errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
}

/**
 * Create a partial schema (all fields optional) for PATCH requests
 */
export function createPartialSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}
