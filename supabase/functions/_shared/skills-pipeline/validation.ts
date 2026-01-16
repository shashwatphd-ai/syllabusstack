// Enterprise-grade validation utilities for Skills Assessment Pipeline
// Provides input validation, schema enforcement, and error standardization

export interface ValidationError {
  code: string;
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// Standard error codes for the pipeline
export const ErrorCodes = {
  // Authentication errors (1xxx)
  AUTH_MISSING_HEADER: 'E1001',
  AUTH_INVALID_TOKEN: 'E1002',
  AUTH_EXPIRED_TOKEN: 'E1003',
  
  // Validation errors (2xxx)
  VALIDATION_REQUIRED_FIELD: 'E2001',
  VALIDATION_INVALID_FORMAT: 'E2002',
  VALIDATION_OUT_OF_RANGE: 'E2003',
  VALIDATION_INVALID_ENUM: 'E2004',
  
  // Resource errors (3xxx)
  RESOURCE_NOT_FOUND: 'E3001',
  RESOURCE_ALREADY_EXISTS: 'E3002',
  RESOURCE_ACCESS_DENIED: 'E3003',
  
  // Business logic errors (4xxx)
  SESSION_NOT_IN_PROGRESS: 'E4001',
  SESSION_EXPIRED: 'E4002',
  SESSION_ALREADY_COMPLETED: 'E4003',
  ASSESSMENT_INCOMPLETE: 'E4004',
  PROFILE_NOT_FOUND: 'E4005',
  
  // Rate limiting errors (5xxx)
  RATE_LIMIT_EXCEEDED: 'E5001',
  DAILY_LIMIT_EXCEEDED: 'E5002',
  COST_LIMIT_EXCEEDED: 'E5003',
  
  // External service errors (6xxx)
  AI_SERVICE_ERROR: 'E6001',
  AI_RATE_LIMITED: 'E6002',
  AI_CREDITS_EXHAUSTED: 'E6003',
  
  // Internal errors (9xxx)
  INTERNAL_ERROR: 'E9001',
  DATABASE_ERROR: 'E9002',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Validation functions
export function validateUUID(value: unknown, field: string): ValidationResult<string> {
  if (!value || typeof value !== 'string') {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
        field,
        message: `${field} is required`,
      }],
    };
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_INVALID_FORMAT,
        field,
        message: `${field} must be a valid UUID`,
      }],
    };
  }
  
  return { success: true, data: value };
}

export function validateEnum<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[]
): ValidationResult<T> {
  if (!value || typeof value !== 'string') {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
        field,
        message: `${field} is required`,
      }],
    };
  }
  
  if (!allowedValues.includes(value as T)) {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_INVALID_ENUM,
        field,
        message: `${field} must be one of: ${allowedValues.join(', ')}`,
      }],
    };
  }
  
  return { success: true, data: value as T };
}

export function validateNumber(
  value: unknown,
  field: string,
  options?: { min?: number; max?: number; required?: boolean }
): ValidationResult<number> {
  const { min, max, required = true } = options || {};
  
  if (value === undefined || value === null) {
    if (required) {
      return {
        success: false,
        errors: [{
          code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
          field,
          message: `${field} is required`,
        }],
      };
    }
    return { success: true };
  }
  
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_INVALID_FORMAT,
        field,
        message: `${field} must be a valid number`,
      }],
    };
  }
  
  if (min !== undefined && num < min) {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_OUT_OF_RANGE,
        field,
        message: `${field} must be at least ${min}`,
      }],
    };
  }
  
  if (max !== undefined && num > max) {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_OUT_OF_RANGE,
        field,
        message: `${field} must be at most ${max}`,
      }],
    };
  }
  
  return { success: true, data: num };
}

// Request validation for start-skills-assessment
export interface StartAssessmentInput {
  session_type: 'standard' | 'quick';
}

export function validateStartAssessmentRequest(body: unknown): ValidationResult<StartAssessmentInput> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
        field: 'body',
        message: 'Request body is required',
      }],
    };
  }
  
  const { session_type = 'standard' } = body as Record<string, unknown>;
  
  const sessionTypeResult = validateEnum<'standard' | 'quick'>(
    session_type,
    'session_type',
    ['standard', 'quick'] as const
  );
  
  if (!sessionTypeResult.success) {
    return {
      success: false,
      errors: sessionTypeResult.errors,
    };
  }
  
  return {
    success: true,
    data: {
      session_type: sessionTypeResult.data!,
    },
  };
}

// Request validation for submit-skills-response
export interface SubmitResponseInput {
  session_id: string;
  question_id: string;
  response_value: number;
  response_time_ms?: number;
}

export function validateSubmitResponseRequest(body: unknown): ValidationResult<SubmitResponseInput> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
        field: 'body',
        message: 'Request body is required',
      }],
    };
  }
  
  const errors: ValidationError[] = [];
  const obj = body as Record<string, unknown>;
  
  const sessionIdResult = validateUUID(obj.session_id, 'session_id');
  if (!sessionIdResult.success) errors.push(...(sessionIdResult.errors || []));
  
  const questionIdResult = validateUUID(obj.question_id, 'question_id');
  if (!questionIdResult.success) errors.push(...(questionIdResult.errors || []));
  
  const responseValueResult = validateNumber(obj.response_value, 'response_value', { min: 1, max: 100 });
  if (!responseValueResult.success) errors.push(...(responseValueResult.errors || []));
  
  const responseTimeMsResult = validateNumber(obj.response_time_ms, 'response_time_ms', { min: 0, required: false });
  if (!responseTimeMsResult.success) errors.push(...(responseTimeMsResult.errors || []));
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    data: {
      session_id: sessionIdResult.data!,
      question_id: questionIdResult.data!,
      response_value: responseValueResult.data!,
      response_time_ms: responseTimeMsResult.data,
    },
  };
}

// Request validation for complete-skills-assessment
export interface CompleteAssessmentInput {
  session_id: string;
}

export function validateCompleteAssessmentRequest(body: unknown): ValidationResult<CompleteAssessmentInput> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
        field: 'body',
        message: 'Request body is required',
      }],
    };
  }
  
  const sessionIdResult = validateUUID((body as Record<string, unknown>).session_id, 'session_id');
  
  if (!sessionIdResult.success) {
    return {
      success: false,
      errors: sessionIdResult.errors,
    };
  }
  
  return {
    success: true,
    data: {
      session_id: sessionIdResult.data!,
    },
  };
}

// Request validation for match-careers
export interface MatchCareersInput {
  limit?: number;
  filters?: {
    min_education_level?: string;
    min_salary?: number;
    job_outlook?: string;
  };
}

export function validateMatchCareersRequest(body: unknown): ValidationResult<MatchCareersInput> {
  if (!body || typeof body !== 'object') {
    // Empty body is valid - use defaults
    return {
      success: true,
      data: { limit: 20 },
    };
  }
  
  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];
  
  let limit = 20;
  if (obj.limit !== undefined) {
    const limitResult = validateNumber(obj.limit, 'limit', { min: 1, max: 100, required: false });
    if (!limitResult.success) {
      errors.push(...(limitResult.errors || []));
    } else if (limitResult.data !== undefined) {
      limit = limitResult.data;
    }
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    data: {
      limit,
      filters: obj.filters as MatchCareersInput['filters'],
    },
  };
}

// Request validation for generate-curriculum
export interface GenerateCurriculumInput {
  career_match_id?: string;
  dream_job_id?: string;
  customizations?: {
    hours_per_week?: number;
    learning_style?: 'visual' | 'reading' | 'hands_on';
    priority_skills?: string[];
    exclude_topics?: string[];
  };
}

export function validateGenerateCurriculumRequest(body: unknown): ValidationResult<GenerateCurriculumInput> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      errors: [{
        code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
        field: 'body',
        message: 'Request body is required',
      }],
    };
  }
  
  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];
  
  // At least one of career_match_id or dream_job_id is required
  if (!obj.career_match_id && !obj.dream_job_id) {
    errors.push({
      code: ErrorCodes.VALIDATION_REQUIRED_FIELD,
      field: 'career_match_id|dream_job_id',
      message: 'Either career_match_id or dream_job_id is required',
    });
  }
  
  if (obj.career_match_id) {
    const result = validateUUID(obj.career_match_id, 'career_match_id');
    if (!result.success) errors.push(...(result.errors || []));
  }
  
  if (obj.dream_job_id) {
    const result = validateUUID(obj.dream_job_id, 'dream_job_id');
    if (!result.success) errors.push(...(result.errors || []));
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    data: {
      career_match_id: obj.career_match_id as string | undefined,
      dream_job_id: obj.dream_job_id as string | undefined,
      customizations: obj.customizations as GenerateCurriculumInput['customizations'],
    },
  };
}
