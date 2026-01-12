/**
 * Gap Normalization Utilities
 * 
 * Provides consistent gap data handling across all components and services.
 * Ensures the same structure is used regardless of the data source.
 */

/**
 * Normalized gap structure used throughout the application.
 * This is the canonical format that all components should work with.
 */
export interface NormalizedGap {
  /** The skill or requirement text (primary identifier) */
  text: string;
  /** Priority level (1 = highest) */
  priority?: number;
  /** Severity classification */
  severity?: 'critical' | 'important' | 'nice_to_have';
  /** Additional context or reason */
  reason?: string;
  /** Current status of the student for this gap */
  studentStatus?: string;
  /** Impact of not addressing this gap */
  impact?: string;
  /** Estimated time to close */
  timeToClose?: string;
  /** Category of the gap */
  category?: 'technical' | 'soft_skill' | 'experience' | 'certification' | 'other';
}

/**
 * Raw critical gap structure from gap_analyses table
 */
export interface CriticalGapRaw {
  job_requirement?: string;
  student_status?: string;
  impact?: string;
  skill?: string;
  description?: string;
  severity?: string;
  importance?: string;
  category?: string;
  time_to_close?: string;
  estimatedTimeToClose?: string;
}

/**
 * Raw priority gap structure from gap_analyses table
 */
export interface PriorityGapRaw {
  gap?: string;
  priority?: number;
  reason?: string;
  requirement?: string;
  job_requirement?: string;
  text?: string;
  skill?: string;
}

/**
 * Union type for any raw gap input
 */
export type RawGapInput = string | CriticalGapRaw | PriorityGapRaw | Record<string, unknown>;

/**
 * Extract text from any gap format
 * Handles all known gap structures and returns a clean string
 */
export function extractGapText(gap: RawGapInput): string {
  // Handle string input directly
  if (typeof gap === 'string') {
    return gap.trim();
  }

  // Handle null/undefined
  if (!gap || typeof gap !== 'object') {
    return '';
  }

  // Cast to record for property access
  const g = gap as Record<string, unknown>;

  // Try known property names in order of preference
  const propertyOrder = [
    'gap',              // priority_gaps primary field
    'job_requirement',  // critical_gaps primary field
    'requirement',      // alternative field
    'skill',            // another alternative
    'text',             // generic text field
    'description',      // fallback description
  ];

  for (const key of propertyOrder) {
    const value = g[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

/**
 * Normalize a single gap from any format to the canonical NormalizedGap structure
 */
export function normalizeGap(gap: RawGapInput, index = 0): NormalizedGap | null {
  const text = extractGapText(gap);
  
  if (!text) {
    console.warn('[gap-utils] Could not extract text from gap:', gap);
    return null;
  }

  // If it's just a string, return minimal structure
  if (typeof gap === 'string') {
    return { text };
  }

  // Extract additional properties from object
  const g = gap as Record<string, unknown>;

  return {
    text,
    priority: typeof g.priority === 'number' ? g.priority : index + 1,
    severity: normalizeSeverity(g.severity || g.importance),
    reason: typeof g.reason === 'string' ? g.reason : undefined,
    studentStatus: typeof g.student_status === 'string' ? g.student_status : undefined,
    impact: typeof g.impact === 'string' ? g.impact : undefined,
    timeToClose: typeof g.time_to_close === 'string' 
      ? g.time_to_close 
      : typeof g.estimatedTimeToClose === 'string' 
        ? g.estimatedTimeToClose 
        : undefined,
    category: normalizeCategory(g.category),
  };
}

/**
 * Normalize an array of gaps from any format
 * Filters out invalid gaps and returns a clean array
 */
export function normalizeGaps(gaps: RawGapInput[]): NormalizedGap[] {
  if (!Array.isArray(gaps)) {
    console.warn('[gap-utils] normalizeGaps received non-array:', typeof gaps);
    return [];
  }

  return gaps
    .map((gap, index) => normalizeGap(gap, index))
    .filter((gap): gap is NormalizedGap => gap !== null);
}

/**
 * Combine critical and priority gaps into a single normalized array
 * Critical gaps are sorted first, then priority gaps by their priority number
 */
export function combineAndNormalizeGaps(
  criticalGaps: RawGapInput[] = [],
  priorityGaps: RawGapInput[] = []
): NormalizedGap[] {
  // Normalize critical gaps with 'critical' severity
  const normalizedCritical = normalizeGaps(criticalGaps).map(gap => ({
    ...gap,
    severity: 'critical' as const,
  }));

  // Normalize priority gaps, preserving their priority
  const normalizedPriority = normalizeGaps(priorityGaps).map((gap, index) => ({
    ...gap,
    severity: gap.severity || 'important' as const,
    priority: gap.priority || index + 1,
  }));

  // Combine and sort: critical first, then by priority
  return [
    ...normalizedCritical,
    ...normalizedPriority.filter(pg => 
      // Avoid duplicates by checking text similarity
      !normalizedCritical.some(cg => 
        textSimilarity(cg.text, pg.text) > 0.8
      )
    ),
  ].sort((a, b) => {
    // Critical first
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    // Then by priority
    return (a.priority || 999) - (b.priority || 999);
  });
}

/**
 * Convert normalized gaps to the format expected by the edge function
 */
export function gapsToSearchFormat(gaps: NormalizedGap[]): Array<{ gap: string; priority?: number }> {
  return gaps.map(gap => ({
    gap: gap.text,
    priority: gap.priority,
  }));
}

/**
 * Validate that gaps array has valid content before API calls
 */
export function validateGapsForSearch(gaps: RawGapInput[]): { 
  valid: boolean; 
  error?: string;
  normalized: NormalizedGap[];
} {
  if (!Array.isArray(gaps)) {
    return { valid: false, error: 'Gaps must be an array', normalized: [] };
  }

  if (gaps.length === 0) {
    return { valid: false, error: 'No skill gaps provided', normalized: [] };
  }

  const normalized = normalizeGaps(gaps);

  if (normalized.length === 0) {
    return { 
      valid: false, 
      error: 'No valid skill gap text found in the provided data',
      normalized: [] 
    };
  }

  return { valid: true, normalized };
}

/**
 * Helper: Normalize severity string to canonical values
 */
function normalizeSeverity(value: unknown): 'critical' | 'important' | 'nice_to_have' | undefined {
  if (typeof value !== 'string') return undefined;
  
  const lower = value.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'important' || lower === 'high') return 'important';
  if (lower === 'nice_to_have' || lower === 'nice-to-have' || lower === 'low') return 'nice_to_have';
  
  return undefined;
}

/**
 * Helper: Normalize category string to canonical values
 */
function normalizeCategory(
  value: unknown
): 'technical' | 'soft_skill' | 'experience' | 'certification' | 'other' | undefined {
  if (typeof value !== 'string') return undefined;
  
  const lower = value.toLowerCase().replace(/-/g, '_');
  if (lower === 'technical') return 'technical';
  if (lower === 'soft_skill' || lower === 'soft-skill') return 'soft_skill';
  if (lower === 'experience') return 'experience';
  if (lower === 'certification') return 'certification';
  if (lower === 'other') return 'other';
  
  return undefined;
}

/**
 * Helper: Simple text similarity check (Jaccard similarity on words)
 */
function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Extract meaningful search keywords from gap text
 * Used by edge functions for web search queries
 */
export function extractSearchKeywords(gapText: string, maxKeywords = 4): string {
  const stopWords = new Set([
    'should', 'must', 'need', 'have', 'experience', 'with', 'and', 'or', 
    'the', 'a', 'an', 'in', 'for', 'to', 'of', 'ability', 'understanding',
    'knowledge', 'skills', 'proficiency', 'familiarity', 'strong', 'working',
    'demonstrated', 'proven', 'excellent', 'deep', 'solid', 'good', 'basic',
    'advanced', 'intermediate', 'beginner', 'that', 'this', 'will', 'can',
    'be', 'able', 'using', 'use', 'related', 'relevant', 'including',
    'years', 'year', 'months', 'month', 'days', 'day', 'from', 'into',
  ]);

  const words = gapText.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  const uniqueWords = [...new Set(words)];
  return uniqueWords.slice(0, maxKeywords).join(' ');
}
