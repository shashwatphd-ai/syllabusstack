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

export const matchCareersSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  filters: z.object({
    min_education_level: z.string().optional(),
    min_salary: positiveNumberSchema.optional(),
    job_outlook: z.string().optional(),
  }).optional(),
});

export const discoverDreamJobsSchema = z.object({
  interests: z.string().max(2000).optional(),
  skills: z.string().max(2000).optional(),
  major: z.string().max(200).optional(),
  careerGoals: z.string().max(2000).optional(),
  workStyle: z.string().max(500).optional(),
});

export const analyzeDreamJobSchema = z.object({
  jobTitle: z.string().min(1).max(200),
  companyType: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  dreamJobId: uuidSchema.optional(),
});

// ============================================================================
// COURSE & ENROLLMENT SCHEMAS
// ============================================================================

export const courseEnrollmentSchema = z.object({
  course_id: uuidSchema,
  payment_intent_id: z.string().optional(),
});

export const enrollInCourseSchema = z.object({
  access_code: z.string().min(1).max(50),
  promo_code: z.string().max(50).optional(),
  success_url: urlSchema.optional(),
  cancel_url: urlSchema.optional(),
});

export const generateCurriculumSchema = z.object({
  career_match_id: uuidSchema.optional(),
  dream_job_id: uuidSchema.optional(),
  customizations: z.object({
    hours_per_week: z.number().int().min(1).max(80).optional(),
    learning_style: z.enum(['visual', 'reading', 'hands_on']).optional(),
    priority_skills: z.array(z.string().min(1)).optional(),
    exclude_topics: z.array(z.string().min(1)).optional(),
  }).optional(),
}).refine(
  data => data.career_match_id || data.dream_job_id,
  { message: 'Either career_match_id or dream_job_id is required' }
);

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
// JOB SEARCH & SCRAPING SCHEMAS
// ============================================================================

export const searchJobsSchema = z.object({
  title: z.string().min(1, "Job title is required").max(200),
  location: z.string().max(200).optional(),
  skills: z.array(z.string().min(1)).max(20).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const scrapeJobPostingSchema = z.object({
  url: z.string().min(1, "URL is required").max(2000),
});

// ============================================================================
// INSTRUCTOR & STUDENT MESSAGE SCHEMAS
// ============================================================================

export const sendStudentMessageSchema = z.object({
  student_ids: z.array(uuidSchema).min(1, "At least one student ID is required"),
  course_id: uuidSchema,
  message: z.string().min(1, "Message is required").max(1000, "Message is too long (max 1000 characters)"),
  subject: z.string().max(200).optional(),
});

export const verifyInstructorEmailSchema = z.object({
  email: emailSchema.optional(),
  institution_name: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  linkedin_url: urlSchema.optional(),
  document_urls: z.array(urlSchema).max(10).optional(),
});

export const reviewInstructorVerificationSchema = z.object({
  verification_id: uuidSchema,
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().max(1000).optional(),
  trust_score_adjustment: z.number().int().min(-100).max(100).optional(),
});

export const useInviteCodeSchema = z.object({
  code: z.string().min(1, "Invite code is required").max(50),
});

// ============================================================================
// CONSUMPTION TRACKING SCHEMAS
// ============================================================================

const watchedSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
});

const consumptionEventSchema = z.object({
  type: z.enum(['play', 'pause', 'seek', 'speed_change', 'tab_focus_loss', 'complete']),
  timestamp: z.number(),
  video_time: z.number(),
  data: z.any().optional(),
});

const microCheckResultSchema = z.object({
  attempt_number: z.number().optional(),
  is_correct: z.boolean().optional(),
}).passthrough();

export const trackConsumptionSchema = z.object({
  content_id: z.string().min(1, "content_id is required"),
  learning_objective_id: uuidSchema.optional().nullable(),
  event: consumptionEventSchema.optional(),
  current_segments: z.array(watchedSegmentSchema).optional(),
  total_duration: z.number().positive().optional(),
  micro_check_results: z.array(microCheckResultSchema).optional(),
});

// ============================================================================
// ORGANIZATION MANAGEMENT SCHEMAS
// ============================================================================

export const removeOrgUserSchema = z.object({
  userId: uuidSchema,
});

// ============================================================================
// PROCTORING SCHEMAS
// ============================================================================

export const recordProctorEventSchema = z.object({
  assessment_session_id: uuidSchema,
  event_type: z.enum(['fullscreen_exit', 'tab_switch', 'copy_paste', 'keyboard_shortcut', 'focus_loss']),
  details: z.any().optional(),
});

// ============================================================================
// ASSESSMENT COMPLETION SCHEMAS
// ============================================================================

export const completeAssessmentSchema = z.object({
  session_id: uuidSchema,
});

export const completeSkillsAssessmentSchema = z.object({
  session_id: uuidSchema,
});

export const generateAssessmentQuestionsSchema = z.object({
  learning_objective_id: uuidSchema,
  count: z.number().int().min(1).max(10).optional().default(5),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

// ============================================================================
// CONTENT STRATEGY & RECOMMENDATION SCHEMAS
// ============================================================================

export const generateContentStrategySchema = z.object({
  teaching_unit_id: uuidSchema,
  force_regenerate: z.boolean().optional().default(false),
});

export const generateRecommendationsSchema = z.object({
  dreamJobId: uuidSchema,
  gaps: z.array(z.object({
    gap: z.string().optional(),
    requirement: z.string().optional(),
    priority: z.string().optional(),
    reason: z.string().optional(),
    time_to_close: z.string().optional(),
  })).optional(),
  gapAnalysisId: uuidSchema.optional(),
});

export const generateSearchContextSchema = z.object({
  learning_objective_id: uuidSchema,
  learning_objective_text: z.string().max(500).optional(),
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

export const globalSearchSchema = z.object({
  query: z.string().min(2).max(200),
  categories: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const searchEducationalContentSchema = z.object({
  query: z.string().min(2).max(200),
  learning_objective_id: uuidSchema.optional(),
  sources: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const searchYoutubeManualSchema = z.object({
  query: z.string().min(2).max(200),
  maxResults: z.number().int().min(1).max(50).optional().default(10),
});

// ============================================================================
// SKILLS ASSESSMENT SCHEMAS
// ============================================================================

export const startSkillsAssessmentSchema = z.object({
  skill_names: z.array(z.string().min(1)).min(1).max(10),
  assessment_type: z.enum(['quick', 'comprehensive', 'adaptive']).optional().default('quick'),
});

export const submitSkillsResponseSchema = z.object({
  session_id: uuidSchema,
  question_id: uuidSchema,
  response: z.string().min(1).max(5000),
  time_taken_seconds: z.number().min(0).optional(),
});

// ============================================================================
// CERTIFICATE SCHEMAS
// ============================================================================

export const issueCertificateSchema = z.object({
  enrollment_id: uuidSchema,
  certificate_type: z.enum(['completion_badge', 'verified', 'assessed']),
  stripe_payment_intent_id: z.string().optional(),
  mastery_score: z.number().min(0).max(100).optional(),
  skill_breakdown: z.record(z.string(), z.number()).optional(),
});

export const verifyCertificateSchema = z.object({
  credential_id: uuidSchema.optional(),
  verification_code: z.string().optional(),
}).refine(
  data => data.credential_id || data.verification_code,
  { message: 'Either credential_id or verification_code is required' }
);

export const purchaseCertificateSchema = z.object({
  course_id: uuidSchema,
  certificate_type: z.enum(['standard', 'premium']).optional().default('standard'),
});

// ============================================================================
// BATCH PROCESSING SCHEMAS
// ============================================================================

export const submitBatchCurriculumSchema = z.object({
  career_match_id: uuidSchema.optional(),
  dream_job_id: uuidSchema.optional(),
  items: z.array(z.object({
    id: uuidSchema,
    type: z.string(),
  })).optional(),
});

export const submitBatchEvaluationSchema = z.object({
  batch_id: uuidSchema.optional(),
  content_ids: z.array(uuidSchema).optional(),
  evaluation_criteria: z.object({
    relevance_weight: z.number().min(0).max(1).optional(),
    quality_weight: z.number().min(0).max(1).optional(),
  }).optional(),
});

export const pollBatchStatusSchema = z.object({
  batch_id: uuidSchema,
});

export const cancelBatchJobSchema = z.object({
  batch_id: uuidSchema,
});

// ============================================================================
// EXTERNAL CONTENT SCHEMAS
// ============================================================================

export const addInstructorContentSchema = z.object({
  teaching_unit_id: uuidSchema,
  content_type: z.enum(['video', 'document', 'link', 'file']),
  url: urlSchema.optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const addManualContentSchema = z.object({
  learning_objective_id: uuidSchema,
  content_type: z.enum(['video', 'article', 'course', 'book', 'other']),
  url: urlSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  provider: z.string().max(100).optional(),
});

export const fetchVideoMetadataSchema = z.object({
  video_url: urlSchema,
  video_id: z.string().optional(),
});

// ============================================================================
// AUTO-LINKING SCHEMAS
// ============================================================================

export const autoLinkCoursesSchema = z.object({
  course_id: uuidSchema.optional(),
  user_id: uuidSchema.optional(),
  dry_run: z.boolean().optional().default(false),
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
