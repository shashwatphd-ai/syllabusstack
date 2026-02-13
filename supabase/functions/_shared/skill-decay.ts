/**
 * Weibull Decay Model for Skill Freshness
 *
 * Patent Claim: Category-specific Weibull decay parameters empirically calibrated
 * from student retest data, producing measurably more accurate skill proficiency
 * estimates than timestamp-only or fixed-rate decay models.
 *
 * The Weibull distribution models "time to failure" - in our case, time until
 * a skill has decayed to a fraction of its original proficiency.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// TYPES
// ============================================================================

export interface DecayParameters {
  lambda_scale: number;        // Characteristic lifetime in days
  k_shape: number;             // Shape parameter
  certification_bonus: number; // Multiplier for formal certifications
  self_reported_penalty: number; // Multiplier for self-reported skills
}

export interface SkillWithDecay {
  skill_name: string;
  base_proficiency: number;        // 0-1 scale (original)
  base_level: string;              // Original level string
  verified_at: Date;
  source_type: string;
  effective_proficiency: number;   // After decay (0-1)
  effective_level: string;         // Decayed level string
  survival_probability: number;    // 0-1
  days_since_verification: number;
  decay_category: string;
  needs_retest: boolean;
}

// ============================================================================
// DEFAULT PARAMETERS
// ============================================================================

const DEFAULT_DECAY_PARAMS: Record<string, DecayParameters> = {
  // Fast-changing tech (frameworks change ~annually)
  programming_frameworks: {
    lambda_scale: 365,   // ~1 year characteristic lifetime
    k_shape: 1.5,        // Accelerating decay (gets obsolete faster over time)
    certification_bonus: 1.4,
    self_reported_penalty: 0.7,
  },

  // Programming languages (more stable, ~2 years)
  programming_languages: {
    lambda_scale: 730,
    k_shape: 1.2,
    certification_bonus: 1.4,
    self_reported_penalty: 0.7,
  },

  // Cloud platforms (rapid change, ~1.5 years)
  cloud_platforms: {
    lambda_scale: 548,
    k_shape: 1.5,
    certification_bonus: 1.4,
    self_reported_penalty: 0.7,
  },

  // Data science (moderate change)
  data_science: {
    lambda_scale: 548,
    k_shape: 1.3,
    certification_bonus: 1.4,
    self_reported_penalty: 0.7,
  },

  // Core CS (fundamentals persist, ~5 years)
  core_cs_concepts: {
    lambda_scale: 1825,
    k_shape: 0.8,        // Decelerating decay (forget details, keep concepts)
    certification_bonus: 1.4,
    self_reported_penalty: 0.7,
  },

  // Mathematics (very stable, ~6 years)
  mathematics: {
    lambda_scale: 2190,
    k_shape: 0.8,
    certification_bonus: 1.4,
    self_reported_penalty: 0.7,
  },

  // Soft skills (very slow decay, ~10 years)
  soft_skills: {
    lambda_scale: 3650,
    k_shape: 0.6,
    certification_bonus: 1.2,
    self_reported_penalty: 0.8,
  },

  // Certifications (cliff effect at expiry, ~3 years)
  certifications: {
    lambda_scale: 1095,
    k_shape: 2.0,        // Cliff effect - valid then suddenly not
    certification_bonus: 1.0,
    self_reported_penalty: 1.0,
  },

  // Default fallback
  default: {
    lambda_scale: 730,   // ~2 years
    k_shape: 1.0,        // Exponential decay
    certification_bonus: 1.4,
    self_reported_penalty: 0.7,
  },
};

// ============================================================================
// SKILL CATEGORY CLASSIFICATION
// ============================================================================

const SKILL_CATEGORY_PATTERNS: Record<string, RegExp> = {
  programming_frameworks: /\b(react|angular|vue|next\.?js|nuxt|svelte|express|django|flask|fastapi|spring|rails|laravel|nest\.?js|tensorflow|pytorch|keras|scikit-?learn)\b/i,
  programming_languages: /\b(python|javascript|typescript|java|c\+\+|c#|csharp|golang|go\b|rust|ruby|php|swift|kotlin|scala|r\b|julia|perl|bash|shell)\b/i,
  cloud_platforms: /\b(aws|amazon web services|azure|gcp|google cloud|docker|kubernetes|k8s|terraform|ansible|jenkins|github actions|ci\/cd|devops)\b/i,
  data_science: /\b(machine learning|ml\b|data analysis|statistics|statistical|data visualization|pandas|numpy|scipy|matplotlib|seaborn|plotly|sql|tableau|power bi|looker|dbt)\b/i,
  core_cs_concepts: /\b(algorithm|data structure|system design|object.?oriented|oop\b|functional programming|design pattern|database|distributed systems|networking|operating system)\b/i,
  mathematics: /\b(linear algebra|calculus|probability|discrete math|optimization|numerical methods|differential equations|graph theory)\b/i,
  soft_skills: /\b(leadership|communication|project management|agile|scrum|teamwork|collaboration|problem solving|critical thinking|presentation|negotiation)\b/i,
  certifications: /\b(certified|certification|pmp|scrum master|csm|cissp|comptia|ccna|ccnp|cka|ckad|solutions architect)\b/i,
};

/**
 * Classify a skill into a decay category
 */
export function classifySkillCategory(skillName: string): string {
  const lowerSkill = skillName.toLowerCase();

  for (const [category, pattern] of Object.entries(SKILL_CATEGORY_PATTERNS)) {
    if (pattern.test(lowerSkill)) {
      return category;
    }
  }

  return 'default';
}

// ============================================================================
// WEIBULL FUNCTIONS
// ============================================================================

/**
 * Weibull survival function: S(t) = e^(-(t/λ)^k)
 *
 * Returns the probability that the skill is still at its original proficiency
 * after t days.
 *
 * @param days - Days since verification
 * @param lambda - Scale parameter (characteristic lifetime in days)
 * @param k - Shape parameter (k < 1: decelerating, k = 1: constant, k > 1: accelerating)
 */
export function weibullSurvival(days: number, lambda: number, k: number): number {
  if (days <= 0) return 1.0;
  if (lambda <= 0) return 0.0;

  const ratio = days / lambda;
  const exponent = Math.pow(ratio, k);
  return Math.exp(-exponent);
}

/**
 * Weibull hazard rate: h(t) = (k/λ) * (t/λ)^(k-1)
 *
 * The instantaneous rate of decay at time t.
 */
export function weibullHazard(days: number, lambda: number, k: number): number {
  if (days <= 0 || lambda <= 0) return 0;

  return (k / lambda) * Math.pow(days / lambda, k - 1);
}

/**
 * Mean time to decay (expected lifetime)
 * E[T] = λ * Γ(1 + 1/k)
 */
export function meanTimeToDecay(lambda: number, k: number): number {
  // Gamma function approximation using Stirling's formula for 1 + 1/k
  const x = 1 + 1 / k;
  // Simple gamma approximation for x > 0
  const gamma = Math.sqrt(2 * Math.PI / x) * Math.pow((x / Math.E) * Math.sqrt(x * Math.sinh(1 / x) + 1 / (810 * Math.pow(x, 6))), x);
  return lambda * gamma;
}

// ============================================================================
// PROFICIENCY CONVERSION
// ============================================================================

const PROFICIENCY_TO_NUMBER: Record<string, number> = {
  beginner: 0.25,
  intermediate: 0.50,
  advanced: 0.75,
  expert: 1.0,
};

const NUMBER_TO_PROFICIENCY_THRESHOLDS = [
  { threshold: 0.875, level: 'expert' },
  { threshold: 0.625, level: 'advanced' },
  { threshold: 0.375, level: 'intermediate' },
  { threshold: 0, level: 'beginner' },
];

export function proficiencyToNumber(level: string): number {
  return PROFICIENCY_TO_NUMBER[level.toLowerCase()] || 0.5;
}

export function numberToProficiency(value: number): string {
  for (const { threshold, level } of NUMBER_TO_PROFICIENCY_THRESHOLDS) {
    if (value >= threshold) return level;
  }
  return 'beginner';
}

// ============================================================================
// MAIN DECAY CALCULATION
// ============================================================================

export interface DecayResult {
  effective_proficiency: number;
  survival_probability: number;
  days_since: number;
  adjusted_lambda: number;
}

/**
 * Calculate effective proficiency after decay
 */
export function calculateDecay(
  baseProficiency: number,
  verifiedAt: Date,
  sourceType: string,
  params: DecayParameters,
  referenceDate: Date = new Date()
): DecayResult {
  const daysSince = Math.floor(
    (referenceDate.getTime() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Adjust lambda based on verification method
  let adjustedLambda = params.lambda_scale;
  if (sourceType === 'certification' || sourceType === 'third_party_verification') {
    adjustedLambda *= params.certification_bonus;
  } else if (sourceType === 'self_reported') {
    adjustedLambda *= params.self_reported_penalty;
  }

  const survivalProbability = weibullSurvival(daysSince, adjustedLambda, params.k_shape);
  const effectiveProficiency = baseProficiency * survivalProbability;

  return {
    effective_proficiency: effectiveProficiency,
    survival_probability: survivalProbability,
    days_since: daysSince,
    adjusted_lambda: adjustedLambda,
  };
}

// ============================================================================
// SKILL ARRAY PROCESSING
// ============================================================================

export interface RawSkill {
  skill_name: string;
  proficiency_level: string;
  verified_at: string;
  source_type: string;
}

/**
 * Apply decay to an array of skills
 */
export function applyDecayToSkills(
  skills: RawSkill[],
  customParams?: Record<string, DecayParameters>,
  referenceDate: Date = new Date()
): SkillWithDecay[] {
  const params = customParams || DEFAULT_DECAY_PARAMS;

  return skills.map(skill => {
    const category = classifySkillCategory(skill.skill_name);
    const categoryParams = params[category] || params.default || DEFAULT_DECAY_PARAMS.default;
    const baseProficiency = proficiencyToNumber(skill.proficiency_level);
    const verifiedAt = new Date(skill.verified_at);

    const decay = calculateDecay(
      baseProficiency,
      verifiedAt,
      skill.source_type,
      categoryParams,
      referenceDate
    );

    return {
      skill_name: skill.skill_name,
      base_proficiency: baseProficiency,
      base_level: skill.proficiency_level,
      verified_at: verifiedAt,
      source_type: skill.source_type,
      effective_proficiency: decay.effective_proficiency,
      effective_level: numberToProficiency(decay.effective_proficiency),
      survival_probability: decay.survival_probability,
      days_since_verification: decay.days_since,
      decay_category: category,
      needs_retest: decay.survival_probability < 0.5,
    };
  });
}

/**
 * Get skills that need retesting based on survival threshold
 */
export function getSkillsNeedingRetest(
  skills: SkillWithDecay[],
  survivalThreshold: number = 0.5
): SkillWithDecay[] {
  return skills
    .filter(s => s.survival_probability < survivalThreshold)
    .sort((a, b) => a.survival_probability - b.survival_probability);
}

/**
 * Get skills that have dropped a proficiency level due to decay
 */
export function getDowngradedSkills(skills: SkillWithDecay[]): SkillWithDecay[] {
  return skills.filter(s => s.effective_level !== s.base_level);
}

// ============================================================================
// DATABASE INTEGRATION
// ============================================================================

/**
 * Fetch decay parameters from database
 */
export async function fetchDecayParameters(
  supabase: SupabaseClient
): Promise<Record<string, DecayParameters>> {
  const { data, error } = await supabase
    .from('skill_decay_parameters')
    .select('skill_category, lambda_scale, k_shape, certification_bonus, self_reported_penalty');

  if (error || !data) {
    console.warn('[SkillDecay] Failed to fetch params, using defaults:', error?.message);
    return DEFAULT_DECAY_PARAMS;
  }

  const params: Record<string, DecayParameters> = { ...DEFAULT_DECAY_PARAMS };

  for (const row of data) {
    params[row.skill_category] = {
      lambda_scale: Number(row.lambda_scale),
      k_shape: Number(row.k_shape),
      certification_bonus: Number(row.certification_bonus),
      self_reported_penalty: Number(row.self_reported_penalty),
    };
  }

  return params;
}

/**
 * Get decayed skills for a user from database
 */
export async function getDecayedUserSkills(
  supabase: SupabaseClient,
  userId: string
): Promise<SkillWithDecay[]> {
  // Fetch verified skills
  const { data: skills, error } = await supabase
    .from('verified_skills')
    .select('skill_name, proficiency_level, verified_at, source_type')
    .eq('user_id', userId);

  if (error || !skills) {
    console.error('[SkillDecay] Failed to fetch skills:', error?.message);
    return [];
  }

  // Fetch decay parameters
  const params = await fetchDecayParameters(supabase);

  // Apply decay
  return applyDecayToSkills(skills, params);
}

/**
 * Generate decay summary for gap analysis prompt
 */
export function generateDecaySummary(skills: SkillWithDecay[]): string {
  const lines: string[] = [];

  const needsRetest = skills.filter(s => s.needs_retest);
  const downgraded = skills.filter(s => s.effective_level !== s.base_level);

  if (needsRetest.length > 0) {
    lines.push(`SKILLS NEEDING RETEST (${needsRetest.length}):`);
    for (const s of needsRetest.slice(0, 5)) {
      lines.push(`- ${s.skill_name}: ${Math.round(s.survival_probability * 100)}% retained, verified ${s.days_since_verification} days ago`);
    }
    if (needsRetest.length > 5) {
      lines.push(`  ... and ${needsRetest.length - 5} more`);
    }
  }

  if (downgraded.length > 0) {
    lines.push(`\nDECAYED SKILLS (${downgraded.length}):`);
    for (const s of downgraded.slice(0, 5)) {
      lines.push(`- ${s.skill_name}: ${s.base_level} → ${s.effective_level} (${s.decay_category})`);
    }
    if (downgraded.length > 5) {
      lines.push(`  ... and ${downgraded.length - 5} more`);
    }
  }

  return lines.join('\n');
}
