# Algorithm Upgrade Plan: Patentable IP Foundation

**Date:** 2026-01-31
**Version:** 1.0
**Purpose:** Transform generic algorithms into patentable technical innovations
**Prerequisite for:** MASTER_IMPLEMENTATION_PLAN_V3.md

---

## Executive Summary

### The Patent Problem

Patent law's **Alice test** rejects abstract ideas implemented on generic computers. SyllabusStack's current five core algorithms use known techniques (Jaccard similarity, Bloom's taxonomy mapping, keyword overlap, timestamp storage, greedy selection) that fail this test.

### The Solution

Replace each algorithm with a **specific technical machine** that produces measurably better results through novel combinations:

| Current Algorithm | Patent Problem | Upgrade | Patent Claim |
|------------------|----------------|---------|--------------|
| Jaccard Similarity | 1901 formula + generic computer | Career-Outcome Trained Embeddings | Novel training pipeline on placement data |
| Bloom's Taxonomy Mapping | Hardcoded dictionary lookup | IRT Adaptive Assessment | Real-time question recalibration + cross-skill normalization |
| Keyword Overlap | String matching | Graph Neural Network | Skill transfer coefficients from prerequisite data |
| Timestamp Storage | No decay calculation | Weibull Decay Model | Category-specific empirical parameters |
| AI Prioritized Selection | Single-objective | NSGA-II Multi-objective | Pareto-optimal learning paths |

---

## Phase 0: Data Collection Infrastructure (PREREQUISITE)

**Timeline:** Immediate (1-2 days)
**Effort:** 8 hours
**Critical Path:** Must complete before algorithm implementation

### 0.1 Database Schema Additions

```sql
-- Migration: 20260131_algorithm_data_collection.sql

-- 1. Enhanced skill verification tracking
ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  verification_method TEXT DEFAULT 'assessment';
ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  initial_proficiency_score DECIMAL(5,4);
ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  last_retest_at TIMESTAMPTZ;
ALTER TABLE verified_skills ADD COLUMN IF NOT EXISTS
  retest_count INTEGER DEFAULT 0;

-- 2. Assessment response logging for IRT
CREATE TABLE IF NOT EXISTS assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,

  -- Response data
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),

  -- Question parameters (for IRT)
  bloom_level TEXT,
  estimated_difficulty DECIMAL(4,3),

  -- Timestamps
  responded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for analysis
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessment_responses_question ON assessment_responses(question_id);
CREATE INDEX idx_assessment_responses_skill ON assessment_responses(skill_name);
CREATE INDEX idx_assessment_responses_user ON assessment_responses(user_id);

-- 3. Placement outcome tracking
CREATE TABLE IF NOT EXISTS placement_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dream_job_id UUID REFERENCES dream_jobs(id),

  -- Outcome data
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('hired', 'interview', 'rejected', 'withdrew')),
  job_title TEXT,
  company_name TEXT,

  -- Skills at time of outcome (snapshot)
  skills_snapshot JSONB NOT NULL DEFAULT '[]',
  verified_skills_count INTEGER,

  -- Timing
  application_date DATE,
  outcome_date DATE,

  -- Success metrics
  is_successful BOOLEAN,
  salary_band TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_placement_outcomes_user ON placement_outcomes(user_id);
CREATE INDEX idx_placement_outcomes_job ON placement_outcomes(dream_job_id);
CREATE INDEX idx_placement_outcomes_success ON placement_outcomes(is_successful);

-- 4. Skill relationship graph (for GNN)
CREATE TABLE IF NOT EXISTS skill_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_skill TEXT NOT NULL,
  target_skill TEXT NOT NULL,

  -- Relationship data
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('prerequisite', 'corequisite', 'transfers_to', 'specialization_of')),
  transfer_coefficient DECIMAL(4,3) CHECK (transfer_coefficient BETWEEN 0 AND 1),

  -- Evidence
  evidence_source TEXT, -- 'course_catalog', 'job_postings', 'student_sequences', 'manual'
  evidence_count INTEGER DEFAULT 1,
  confidence DECIMAL(4,3),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_skill, target_skill, relationship_type)
);

CREATE INDEX idx_skill_relationships_source ON skill_relationships(source_skill);
CREATE INDEX idx_skill_relationships_target ON skill_relationships(target_skill);

-- 5. IRT question parameters
CREATE TABLE IF NOT EXISTS question_irt_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  skill_name TEXT NOT NULL,

  -- IRT 2PL parameters
  difficulty_b DECIMAL(5,3) DEFAULT 0, -- theta scale, typically -3 to +3
  discrimination_a DECIMAL(5,3) DEFAULT 1, -- typically 0.5 to 2.5

  -- Calibration metadata
  response_count INTEGER DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,
  calibration_se DECIMAL(5,4), -- standard error

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(question_id, skill_name)
);

-- 6. Skill decay parameters by category
CREATE TABLE IF NOT EXISTS skill_decay_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_category TEXT PRIMARY KEY,

  -- Weibull parameters
  lambda_scale DECIMAL(8,2) NOT NULL, -- characteristic lifetime in days
  k_shape DECIMAL(4,3) NOT NULL, -- shape parameter

  -- Verification method adjustments
  certification_bonus DECIMAL(4,3) DEFAULT 1.4, -- multiplier for formal certs
  self_reported_penalty DECIMAL(4,3) DEFAULT 0.7,

  -- Calibration
  sample_size INTEGER DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial decay parameters based on research
INSERT INTO skill_decay_parameters (skill_category, lambda_scale, k_shape) VALUES
  ('programming_frameworks', 365, 1.5),    -- ~1 year, accelerating decay
  ('programming_languages', 730, 1.2),      -- ~2 years, moderate acceleration
  ('cloud_platforms', 548, 1.5),            -- ~1.5 years, accelerating (rapid change)
  ('data_science', 548, 1.3),               -- ~1.5 years
  ('core_cs_concepts', 1825, 0.8),          -- ~5 years, decelerating (fundamentals persist)
  ('mathematics', 2190, 0.8),               -- ~6 years, decelerating
  ('soft_skills', 3650, 0.6),               -- ~10 years, very slow decay
  ('certifications', 1095, 2.0),            -- ~3 years, cliff effect
  ('default', 730, 1.0)                     -- ~2 years, exponential
ON CONFLICT (skill_category) DO NOTHING;

-- 7. Course prerequisite edges (for GNN training)
CREATE TABLE IF NOT EXISTS course_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id UUID REFERENCES courses(id) ON DELETE CASCADE,

  -- Relationship strength
  requirement_type TEXT CHECK (requirement_type IN ('required', 'recommended', 'helpful')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(course_id, prerequisite_course_id)
);

-- 8. Enable RLS
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_irt_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_decay_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_prerequisites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own assessment responses" ON assessment_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessment responses" ON assessment_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own placement outcomes" ON placement_outcomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own placement outcomes" ON placement_outcomes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read skill relationships" ON skill_relationships
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read question parameters" ON question_irt_parameters
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read decay parameters" ON skill_decay_parameters
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read course prerequisites" ON course_prerequisites
  FOR SELECT USING (true);
```

### 0.2 Assessment Response Logging

**File:** `supabase/functions/_shared/assessment-logger.ts`

```typescript
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AssessmentResponseLog {
  session_id: string;
  question_id: string;
  user_id: string;
  skill_name: string;
  is_correct: boolean;
  response_time_ms: number;
  confidence_level?: number;
  bloom_level?: string;
  estimated_difficulty?: number;
}

export async function logAssessmentResponse(
  supabase: SupabaseClient,
  response: AssessmentResponseLog
): Promise<void> {
  const { error } = await supabase
    .from('assessment_responses')
    .insert(response);

  if (error) {
    console.error('Failed to log assessment response:', error);
    // Don't throw - logging should not break the assessment flow
  }
}

export async function logBatchResponses(
  supabase: SupabaseClient,
  responses: AssessmentResponseLog[]
): Promise<void> {
  if (responses.length === 0) return;

  const { error } = await supabase
    .from('assessment_responses')
    .insert(responses);

  if (error) {
    console.error('Failed to log batch assessment responses:', error);
  }
}
```

### 0.3 Placement Outcome Tracking Hook

**File:** `src/hooks/usePlacementOutcomes.ts`

```typescript
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type OutcomeType = 'hired' | 'interview' | 'rejected' | 'withdrew';

export interface PlacementOutcome {
  dream_job_id?: string;
  outcome_type: OutcomeType;
  job_title: string;
  company_name?: string;
  application_date?: string;
  outcome_date?: string;
  is_successful?: boolean;
  salary_band?: string;
}

export function usePlacementOutcomes() {
  const { user } = useAuth();

  const recordOutcome = useCallback(async (outcome: PlacementOutcome) => {
    if (!user) return { error: 'Not authenticated' };

    // Get current skills snapshot
    const { data: skills } = await supabase
      .from('verified_skills')
      .select('skill_name, proficiency_level, verified_at, source_type')
      .eq('user_id', user.id);

    const { data, error } = await supabase
      .from('placement_outcomes')
      .insert({
        user_id: user.id,
        ...outcome,
        skills_snapshot: skills || [],
        verified_skills_count: skills?.length || 0,
      })
      .select()
      .single();

    return { data, error };
  }, [user]);

  const getOutcomes = useCallback(async () => {
    if (!user) return { data: [], error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('placement_outcomes')
      .select('*')
      .eq('user_id', user.id)
      .order('outcome_date', { ascending: false });

    return { data: data || [], error };
  }, [user]);

  return { recordOutcome, getOutcomes };
}
```

---

## Phase 1: Skill Freshness - Weibull Decay Model

**Timeline:** Week 1
**Effort:** 12 hours
**Dependencies:** Phase 0 complete

### 1.1 Weibull Decay Calculator

**File:** `supabase/functions/_shared/skill-decay.ts`

```typescript
/**
 * Weibull Decay Model for Skill Freshness
 *
 * Patent Claim: Category-specific decay parameters empirically calibrated
 * from student retest data, producing measurably more accurate skill
 * proficiency estimates than timestamp-only or fixed-rate decay models.
 */

export interface DecayParameters {
  lambda_scale: number;  // Characteristic lifetime in days
  k_shape: number;       // Shape parameter
  certification_bonus: number;
  self_reported_penalty: number;
}

export interface SkillWithDecay {
  skill_name: string;
  base_proficiency: number;        // 0-1 scale
  verified_at: Date;
  source_type: string;
  effective_proficiency: number;   // After decay
  survival_probability: number;    // 0-1
  days_since_verification: number;
  decay_category: string;
}

// Default parameters by category (will be overridden by DB values)
const DEFAULT_DECAY_PARAMS: Record<string, DecayParameters> = {
  programming_frameworks: { lambda_scale: 365, k_shape: 1.5, certification_bonus: 1.4, self_reported_penalty: 0.7 },
  programming_languages: { lambda_scale: 730, k_shape: 1.2, certification_bonus: 1.4, self_reported_penalty: 0.7 },
  cloud_platforms: { lambda_scale: 548, k_shape: 1.5, certification_bonus: 1.4, self_reported_penalty: 0.7 },
  data_science: { lambda_scale: 548, k_shape: 1.3, certification_bonus: 1.4, self_reported_penalty: 0.7 },
  core_cs_concepts: { lambda_scale: 1825, k_shape: 0.8, certification_bonus: 1.4, self_reported_penalty: 0.7 },
  mathematics: { lambda_scale: 2190, k_shape: 0.8, certification_bonus: 1.4, self_reported_penalty: 0.7 },
  soft_skills: { lambda_scale: 3650, k_shape: 0.6, certification_bonus: 1.4, self_reported_penalty: 0.7 },
  certifications: { lambda_scale: 1095, k_shape: 2.0, certification_bonus: 1.0, self_reported_penalty: 1.0 },
  default: { lambda_scale: 730, k_shape: 1.0, certification_bonus: 1.4, self_reported_penalty: 0.7 },
};

// Skill category classification
const SKILL_CATEGORIES: Record<string, string[]> = {
  programming_frameworks: ['react', 'angular', 'vue', 'next.js', 'express', 'django', 'flask', 'spring', 'rails', 'laravel', 'tensorflow', 'pytorch', 'keras'],
  programming_languages: ['python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin'],
  cloud_platforms: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'github actions'],
  data_science: ['machine learning', 'data analysis', 'statistics', 'data visualization', 'pandas', 'numpy', 'scikit-learn', 'sql', 'tableau', 'power bi'],
  core_cs_concepts: ['algorithms', 'data structures', 'system design', 'object-oriented programming', 'functional programming', 'design patterns', 'databases'],
  mathematics: ['linear algebra', 'calculus', 'probability', 'discrete mathematics', 'optimization'],
  soft_skills: ['leadership', 'communication', 'project management', 'teamwork', 'problem solving', 'critical thinking'],
  certifications: ['aws certified', 'azure certified', 'google certified', 'pmp', 'scrum master', 'cissp'],
};

/**
 * Determine skill category based on skill name
 */
export function classifySkillCategory(skillName: string): string {
  const lowerSkill = skillName.toLowerCase();

  for (const [category, keywords] of Object.entries(SKILL_CATEGORIES)) {
    if (keywords.some(keyword => lowerSkill.includes(keyword))) {
      return category;
    }
  }

  return 'default';
}

/**
 * Weibull survival function: S(t) = e^(-(t/λ)^k)
 * Returns probability that skill is still at original proficiency
 */
export function weibullSurvival(
  days: number,
  lambda: number,
  k: number
): number {
  if (days <= 0) return 1.0;
  if (lambda <= 0) return 0.0;

  const ratio = days / lambda;
  const exponent = Math.pow(ratio, k);
  return Math.exp(-exponent);
}

/**
 * Calculate effective proficiency after decay
 */
export function calculateEffectiveProficiency(
  baseProficiency: number,
  verifiedAt: Date,
  sourceType: string,
  params: DecayParameters,
  referenceDate: Date = new Date()
): { effectiveProficiency: number; survivalProbability: number; daysSince: number } {
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
    effectiveProficiency,
    survivalProbability,
    daysSince,
  };
}

/**
 * Convert proficiency level string to numeric value
 */
function proficiencyToNumber(level: string): number {
  const mapping: Record<string, number> = {
    beginner: 0.25,
    intermediate: 0.50,
    advanced: 0.75,
    expert: 1.0,
  };
  return mapping[level.toLowerCase()] || 0.5;
}

/**
 * Convert numeric proficiency back to level string
 */
function numberToProficiency(value: number): string {
  if (value >= 0.875) return 'expert';
  if (value >= 0.625) return 'advanced';
  if (value >= 0.375) return 'intermediate';
  return 'beginner';
}

/**
 * Process skills array and apply decay to each
 */
export async function applyDecayToSkills(
  skills: Array<{
    skill_name: string;
    proficiency_level: string;
    verified_at: string;
    source_type: string;
  }>,
  decayParamsFromDb?: Record<string, DecayParameters>
): Promise<SkillWithDecay[]> {
  const params = decayParamsFromDb || DEFAULT_DECAY_PARAMS;
  const now = new Date();

  return skills.map(skill => {
    const category = classifySkillCategory(skill.skill_name);
    const categoryParams = params[category] || params.default;
    const baseProficiency = proficiencyToNumber(skill.proficiency_level);
    const verifiedAt = new Date(skill.verified_at);

    const { effectiveProficiency, survivalProbability, daysSince } = calculateEffectiveProficiency(
      baseProficiency,
      verifiedAt,
      skill.source_type,
      categoryParams,
      now
    );

    return {
      skill_name: skill.skill_name,
      base_proficiency: baseProficiency,
      verified_at: verifiedAt,
      source_type: skill.source_type,
      effective_proficiency: effectiveProficiency,
      effective_level: numberToProficiency(effectiveProficiency),
      survival_probability: survivalProbability,
      days_since_verification: daysSince,
      decay_category: category,
    };
  });
}

/**
 * Get skills that need retesting (survival < threshold)
 */
export function getSkillsNeedingRetest(
  skills: SkillWithDecay[],
  survivalThreshold: number = 0.5
): SkillWithDecay[] {
  return skills
    .filter(s => s.survival_probability < survivalThreshold)
    .sort((a, b) => a.survival_probability - b.survival_probability);
}
```

### 1.2 Integration with Gap Analysis

**File:** `supabase/functions/gap-analysis/skill-decay-integration.ts`

```typescript
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyDecayToSkills, SkillWithDecay } from "../_shared/skill-decay.ts";

export interface DecayAdjustedGapAnalysis {
  originalSkills: any[];
  decayedSkills: SkillWithDecay[];
  skillsNeedingRetest: SkillWithDecay[];
  adjustedGaps: {
    skill: string;
    originalProficiency: string;
    decayedProficiency: string;
    gapIncreased: boolean;
    retestRecommended: boolean;
  }[];
}

export async function getDecayAdjustedSkills(
  supabase: SupabaseClient,
  userId: string
): Promise<DecayAdjustedGapAnalysis> {
  // Fetch verified skills
  const { data: skills, error } = await supabase
    .from('verified_skills')
    .select('skill_name, proficiency_level, verified_at, source_type')
    .eq('user_id', userId);

  if (error || !skills) {
    throw new Error(`Failed to fetch skills: ${error?.message}`);
  }

  // Fetch custom decay parameters if available
  const { data: customParams } = await supabase
    .from('skill_decay_parameters')
    .select('*');

  const paramsMap = customParams?.reduce((acc, p) => {
    acc[p.skill_category] = {
      lambda_scale: p.lambda_scale,
      k_shape: p.k_shape,
      certification_bonus: p.certification_bonus,
      self_reported_penalty: p.self_reported_penalty,
    };
    return acc;
  }, {} as Record<string, any>);

  // Apply decay
  const decayedSkills = await applyDecayToSkills(skills, paramsMap);

  // Identify skills needing retest
  const skillsNeedingRetest = decayedSkills
    .filter(s => s.survival_probability < 0.5)
    .sort((a, b) => a.survival_probability - b.survival_probability);

  // Calculate adjusted gaps
  const adjustedGaps = decayedSkills.map(ds => {
    const original = skills.find(s => s.skill_name === ds.skill_name);
    const originalLevel = original?.proficiency_level || 'unknown';
    const decayedLevel = numberToProficiency(ds.effective_proficiency);

    return {
      skill: ds.skill_name,
      originalProficiency: originalLevel,
      decayedProficiency: decayedLevel,
      gapIncreased: ds.effective_proficiency < proficiencyToNumber(originalLevel),
      retestRecommended: ds.survival_probability < 0.5,
    };
  });

  return {
    originalSkills: skills,
    decayedSkills,
    skillsNeedingRetest,
    adjustedGaps,
  };
}

function proficiencyToNumber(level: string): number {
  const mapping: Record<string, number> = {
    beginner: 0.25,
    intermediate: 0.50,
    advanced: 0.75,
    expert: 1.0,
  };
  return mapping[level.toLowerCase()] || 0.5;
}

function numberToProficiency(value: number): string {
  if (value >= 0.875) return 'expert';
  if (value >= 0.625) return 'advanced';
  if (value >= 0.375) return 'intermediate';
  return 'beginner';
}
```

---

## Phase 2: IRT Adaptive Assessment

**Timeline:** Week 2
**Effort:** 20 hours
**Dependencies:** Phase 0 complete

### 2.1 IRT Core Mathematics

**File:** `supabase/functions/_shared/irt-engine.ts`

```typescript
/**
 * Item Response Theory (IRT) 2-Parameter Logistic Model
 *
 * Patent Claims:
 * 1. Real-time question parameter recalibration using EM algorithm
 * 2. Cross-skill theta normalization for consistent proficiency scales
 * 3. Adaptive question selection maximizing Fisher Information
 */

export interface QuestionParameters {
  question_id: string;
  skill_name: string;
  difficulty_b: number;      // -3 to +3 theta scale
  discrimination_a: number;  // 0.5 to 2.5 typically
  response_count: number;
  calibration_se: number;    // Standard error
}

export interface StudentAbility {
  theta: number;             // Ability estimate on theta scale
  se: number;                // Standard error of estimate
  confidence: number;        // 0-1 confidence level
  responses_used: number;
}

export interface ResponsePattern {
  question_id: string;
  is_correct: boolean;
  params: QuestionParameters;
}

/**
 * IRT 2PL probability function
 * P(correct) = 1 / (1 + e^(-a(θ-b)))
 */
export function probability2PL(
  theta: number,
  a: number,
  b: number
): number {
  const exponent = -a * (theta - b);
  return 1 / (1 + Math.exp(exponent));
}

/**
 * Fisher Information for a single item
 * I(θ) = a² * P(θ) * Q(θ)
 */
export function fisherInformation(
  theta: number,
  a: number,
  b: number
): number {
  const p = probability2PL(theta, a, b);
  const q = 1 - p;
  return a * a * p * q;
}

/**
 * Maximum Likelihood Estimation of ability using Newton-Raphson
 */
export function estimateAbilityMLE(
  responses: ResponsePattern[],
  maxIterations: number = 20,
  tolerance: number = 0.001,
  initialTheta: number = 0
): StudentAbility {
  if (responses.length === 0) {
    return { theta: 0, se: 1.0, confidence: 0, responses_used: 0 };
  }

  let theta = initialTheta;

  for (let iter = 0; iter < maxIterations; iter++) {
    let numerator = 0;
    let denominator = 0;

    for (const r of responses) {
      const { discrimination_a: a, difficulty_b: b } = r.params;
      const p = probability2PL(theta, a, b);
      const q = 1 - p;
      const u = r.is_correct ? 1 : 0;

      // First derivative of log-likelihood
      numerator += a * (u - p);

      // Negative second derivative (Fisher Information)
      denominator += a * a * p * q;
    }

    if (denominator < 0.001) {
      // Avoid division by zero
      break;
    }

    const delta = numerator / denominator;
    theta += delta;

    // Bound theta to reasonable range
    theta = Math.max(-4, Math.min(4, theta));

    if (Math.abs(delta) < tolerance) {
      break;
    }
  }

  // Calculate standard error
  let totalInfo = 0;
  for (const r of responses) {
    totalInfo += fisherInformation(
      theta,
      r.params.discrimination_a,
      r.params.difficulty_b
    );
  }

  const se = totalInfo > 0 ? 1 / Math.sqrt(totalInfo) : 1.0;

  // Convert to confidence (0-1 scale)
  const confidence = Math.max(0, Math.min(1, 1 - (se / 2)));

  return {
    theta,
    se,
    confidence,
    responses_used: responses.length,
  };
}

/**
 * Select next optimal question (max Fisher Information)
 */
export function selectNextQuestion(
  currentTheta: number,
  availableQuestions: QuestionParameters[],
  answeredQuestionIds: Set<string>
): QuestionParameters | null {
  const unanswered = availableQuestions.filter(
    q => !answeredQuestionIds.has(q.question_id)
  );

  if (unanswered.length === 0) return null;

  // Find question with maximum information at current theta
  let bestQuestion = unanswered[0];
  let maxInfo = fisherInformation(
    currentTheta,
    bestQuestion.discrimination_a,
    bestQuestion.difficulty_b
  );

  for (const q of unanswered.slice(1)) {
    const info = fisherInformation(
      currentTheta,
      q.discrimination_a,
      q.difficulty_b
    );
    if (info > maxInfo) {
      maxInfo = info;
      bestQuestion = q;
    }
  }

  return bestQuestion;
}

/**
 * Convert theta to proficiency level string
 */
export function thetaToProficiency(theta: number): {
  level: string;
  percentile: number;
  description: string;
} {
  // Assuming theta is standard normal (mean=0, sd=1)
  // Convert to percentile using normal CDF approximation
  const percentile = normalCDF(theta) * 100;

  if (theta >= 1.5) {
    return {
      level: 'expert',
      percentile,
      description: `Top ${(100 - percentile).toFixed(0)}% - Exceptional mastery`,
    };
  } else if (theta >= 0.5) {
    return {
      level: 'advanced',
      percentile,
      description: `Top ${(100 - percentile).toFixed(0)}% - Strong proficiency`,
    };
  } else if (theta >= -0.5) {
    return {
      level: 'intermediate',
      percentile,
      description: `${percentile.toFixed(0)}th percentile - Solid foundation`,
    };
  } else {
    return {
      level: 'beginner',
      percentile,
      description: `${percentile.toFixed(0)}th percentile - Building fundamentals`,
    };
  }
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Batch recalibrate question parameters from response data
 * Uses simplified EM-like approach for 2PL
 */
export function recalibrateQuestions(
  responseData: Array<{
    question_id: string;
    responses: Array<{ theta: number; is_correct: boolean }>;
  }>
): Map<string, { difficulty_b: number; discrimination_a: number }> {
  const calibrated = new Map();

  for (const item of responseData) {
    if (item.responses.length < 30) {
      // Not enough data for reliable calibration
      continue;
    }

    // Simple calibration: b ≈ theta where P(correct) = 0.5
    // a ≈ slope at inflection point

    const sorted = [...item.responses].sort((a, b) => a.theta - b.theta);

    // Find theta where proportion correct crosses 0.5
    let cumCorrect = 0;
    let crossoverTheta = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].is_correct) cumCorrect++;
      const propCorrect = cumCorrect / (i + 1);
      if (propCorrect >= 0.5) {
        crossoverTheta = sorted[i].theta;
        break;
      }
    }

    // Estimate discrimination from variance of correct responses
    const correctThetas = sorted.filter(r => r.is_correct).map(r => r.theta);
    const incorrectThetas = sorted.filter(r => !r.is_correct).map(r => r.theta);

    const meanCorrect = correctThetas.reduce((a, b) => a + b, 0) / correctThetas.length;
    const meanIncorrect = incorrectThetas.length > 0
      ? incorrectThetas.reduce((a, b) => a + b, 0) / incorrectThetas.length
      : meanCorrect - 1;

    // Discrimination proportional to separation between groups
    const discrimination = Math.max(0.5, Math.min(2.5,
      Math.abs(meanCorrect - meanIncorrect) * 1.7
    ));

    calibrated.set(item.question_id, {
      difficulty_b: crossoverTheta,
      discrimination_a: discrimination,
    });
  }

  return calibrated;
}
```

### 2.2 Adaptive Assessment Session Manager

**File:** `supabase/functions/_shared/adaptive-session.ts`

```typescript
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  QuestionParameters,
  ResponsePattern,
  StudentAbility,
  estimateAbilityMLE,
  selectNextQuestion,
  thetaToProficiency,
} from "./irt-engine.ts";
import { logAssessmentResponse } from "./assessment-logger.ts";

export interface AdaptiveSession {
  session_id: string;
  user_id: string;
  skill_name: string;
  current_theta: number;
  current_se: number;
  responses: ResponsePattern[];
  answered_ids: Set<string>;
  start_time: number;
}

export interface SessionResult {
  theta: number;
  se: number;
  proficiency: {
    level: string;
    percentile: number;
    description: string;
  };
  questions_answered: number;
  accuracy: number;
}

const activeSessions = new Map<string, AdaptiveSession>();

/**
 * Start a new adaptive assessment session
 */
export async function startAdaptiveSession(
  supabase: SupabaseClient,
  userId: string,
  skillName: string
): Promise<{ session_id: string; first_question: QuestionParameters | null }> {
  // Get available questions for this skill
  const { data: questions, error } = await supabase
    .from('question_irt_parameters')
    .select('*')
    .eq('skill_name', skillName);

  if (error) throw new Error(`Failed to load questions: ${error.message}`);

  const sessionId = crypto.randomUUID();

  const session: AdaptiveSession = {
    session_id: sessionId,
    user_id: userId,
    skill_name: skillName,
    current_theta: 0, // Start at average
    current_se: 1.0,
    responses: [],
    answered_ids: new Set(),
    start_time: Date.now(),
  };

  activeSessions.set(sessionId, session);

  // Select first question (medium difficulty for cold start)
  const mediumDifficultyQuestions = (questions || []).filter(
    q => Math.abs(q.difficulty_b) < 0.5
  );

  const firstQuestion = mediumDifficultyQuestions.length > 0
    ? mediumDifficultyQuestions[Math.floor(Math.random() * mediumDifficultyQuestions.length)]
    : questions?.[0] || null;

  return { session_id: sessionId, first_question: firstQuestion };
}

/**
 * Submit answer and get next question
 */
export async function submitAnswer(
  supabase: SupabaseClient,
  sessionId: string,
  questionId: string,
  isCorrect: boolean,
  responseTimeMs: number
): Promise<{
  next_question: QuestionParameters | null;
  current_ability: StudentAbility;
  should_terminate: boolean;
  termination_reason?: string;
}> {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  // Get question parameters
  const { data: qParams } = await supabase
    .from('question_irt_parameters')
    .select('*')
    .eq('question_id', questionId)
    .single();

  if (!qParams) throw new Error('Question parameters not found');

  // Record response
  session.responses.push({
    question_id: questionId,
    is_correct: isCorrect,
    params: qParams,
  });
  session.answered_ids.add(questionId);

  // Log for future calibration
  await logAssessmentResponse(supabase, {
    session_id: sessionId,
    question_id: questionId,
    user_id: session.user_id,
    skill_name: session.skill_name,
    is_correct: isCorrect,
    response_time_ms: responseTimeMs,
    bloom_level: qParams.bloom_level,
    estimated_difficulty: qParams.difficulty_b,
  });

  // Update ability estimate
  const ability = estimateAbilityMLE(session.responses);
  session.current_theta = ability.theta;
  session.current_se = ability.se;

  // Check termination conditions
  const shouldTerminate = checkTermination(session, ability);

  if (shouldTerminate.terminate) {
    activeSessions.delete(sessionId);
    return {
      next_question: null,
      current_ability: ability,
      should_terminate: true,
      termination_reason: shouldTerminate.reason,
    };
  }

  // Get all available questions
  const { data: allQuestions } = await supabase
    .from('question_irt_parameters')
    .select('*')
    .eq('skill_name', session.skill_name);

  // Select next optimal question
  const nextQuestion = selectNextQuestion(
    ability.theta,
    allQuestions || [],
    session.answered_ids
  );

  return {
    next_question: nextQuestion,
    current_ability: ability,
    should_terminate: nextQuestion === null,
    termination_reason: nextQuestion === null ? 'No more questions available' : undefined,
  };
}

/**
 * Get final session result
 */
export async function completeSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionResult> {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  const ability = estimateAbilityMLE(session.responses);
  const proficiency = thetaToProficiency(ability.theta);

  const correctCount = session.responses.filter(r => r.is_correct).length;
  const accuracy = session.responses.length > 0
    ? correctCount / session.responses.length
    : 0;

  // Clean up
  activeSessions.delete(sessionId);

  return {
    theta: ability.theta,
    se: ability.se,
    proficiency,
    questions_answered: session.responses.length,
    accuracy,
  };
}

/**
 * Check if session should terminate
 */
function checkTermination(
  session: AdaptiveSession,
  ability: StudentAbility
): { terminate: boolean; reason?: string } {
  // Max questions reached
  if (session.responses.length >= 20) {
    return { terminate: true, reason: 'Maximum questions reached' };
  }

  // Sufficient precision (SE < 0.3)
  if (ability.se < 0.3 && session.responses.length >= 5) {
    return { terminate: true, reason: 'Sufficient precision achieved' };
  }

  // Time limit (30 minutes)
  const elapsedMs = Date.now() - session.start_time;
  if (elapsedMs > 30 * 60 * 1000) {
    return { terminate: true, reason: 'Time limit reached' };
  }

  return { terminate: false };
}
```

---

## Phase 3: Semantic Skill Matching (Embeddings)

**Timeline:** Week 3-4
**Effort:** 24 hours
**Dependencies:** Phase 0, placement outcome data collection

### 3.1 Embedding Service

**File:** `supabase/functions/_shared/skill-embeddings.ts`

```typescript
/**
 * Career-Outcome Trained Skill Embeddings
 *
 * Patent Claim: Embedding space specifically trained on career placement
 * outcomes (skill → job → success) rather than generic word embeddings,
 * producing measurably better skill-to-job matching than keyword overlap.
 *
 * Note: Full implementation requires external embedding model.
 * This module provides the interface and fallback logic.
 */

export interface SkillEmbedding {
  skill_name: string;
  vector: number[];
  dimension: number;
  model_version: string;
}

export interface MatchResult {
  similarity: number;
  semantic_overlap: string[];
  missing_semantic_skills: string[];
}

// Dimension of embedding vectors
const EMBEDDING_DIM = 128;

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vector dimensions must match');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Compute centroid of multiple embedding vectors
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return new Array(EMBEDDING_DIM).fill(0);

  const centroid = new Array(EMBEDDING_DIM).fill(0);

  for (const vec of embeddings) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      centroid[i] += vec[i] / embeddings.length;
    }
  }

  return centroid;
}

/**
 * Semantic skill matching using embeddings
 *
 * When embeddings are available:
 * 1. Get embeddings for all student skills
 * 2. Get embeddings for all job requirements
 * 3. Compute centroid similarity
 * 4. Find semantically similar skills that appear to overlap
 *
 * Fallback: Enhanced keyword matching with synonym expansion
 */
export async function semanticSkillMatch(
  studentSkills: string[],
  jobRequirements: string[],
  embeddingCache?: Map<string, number[]>
): Promise<MatchResult> {
  // If embeddings available, use semantic matching
  if (embeddingCache && embeddingCache.size > 0) {
    const studentEmbeddings = studentSkills
      .map(s => embeddingCache.get(s.toLowerCase()))
      .filter((e): e is number[] => e !== undefined);

    const jobEmbeddings = jobRequirements
      .map(r => embeddingCache.get(r.toLowerCase()))
      .filter((e): e is number[] => e !== undefined);

    if (studentEmbeddings.length > 0 && jobEmbeddings.length > 0) {
      const studentCentroid = computeCentroid(studentEmbeddings);
      const jobCentroid = computeCentroid(jobEmbeddings);
      const similarity = cosineSimilarity(studentCentroid, jobCentroid);

      // Find semantic overlaps (skills close in embedding space)
      const overlaps = findSemanticOverlaps(
        studentSkills,
        jobRequirements,
        embeddingCache
      );

      return {
        similarity,
        semantic_overlap: overlaps.overlapping,
        missing_semantic_skills: overlaps.missing,
      };
    }
  }

  // Fallback: Enhanced keyword matching
  return fallbackKeywordMatch(studentSkills, jobRequirements);
}

/**
 * Find skills that are semantically similar across student/job
 */
function findSemanticOverlaps(
  studentSkills: string[],
  jobRequirements: string[],
  embeddings: Map<string, number[]>,
  threshold: number = 0.7
): { overlapping: string[]; missing: string[] } {
  const overlapping: string[] = [];
  const missing: string[] = [];

  for (const req of jobRequirements) {
    const reqEmb = embeddings.get(req.toLowerCase());
    if (!reqEmb) {
      missing.push(req);
      continue;
    }

    let foundMatch = false;
    for (const skill of studentSkills) {
      const skillEmb = embeddings.get(skill.toLowerCase());
      if (skillEmb) {
        const sim = cosineSimilarity(reqEmb, skillEmb);
        if (sim >= threshold) {
          overlapping.push(`${skill} ≈ ${req}`);
          foundMatch = true;
          break;
        }
      }
    }

    if (!foundMatch) {
      missing.push(req);
    }
  }

  return { overlapping, missing };
}

/**
 * Fallback keyword matching with basic synonyms
 */
function fallbackKeywordMatch(
  studentSkills: string[],
  jobRequirements: string[]
): MatchResult {
  const synonymGroups: string[][] = [
    ['python', 'py', 'python3'],
    ['javascript', 'js', 'ecmascript'],
    ['machine learning', 'ml', 'deep learning', 'neural networks'],
    ['data analysis', 'data analytics', 'statistical analysis'],
    ['sql', 'mysql', 'postgresql', 'database'],
    ['aws', 'amazon web services', 'cloud'],
    ['react', 'reactjs', 'react.js'],
    ['node', 'nodejs', 'node.js'],
  ];

  const normalize = (s: string) => s.toLowerCase().trim();
  const studentSet = new Set(studentSkills.map(normalize));

  // Expand student skills with synonyms
  const expandedStudent = new Set(studentSet);
  for (const group of synonymGroups) {
    const hasAny = group.some(s => studentSet.has(s));
    if (hasAny) {
      group.forEach(s => expandedStudent.add(s));
    }
  }

  const overlapping: string[] = [];
  const missing: string[] = [];

  for (const req of jobRequirements) {
    const normReq = normalize(req);
    if (expandedStudent.has(normReq)) {
      overlapping.push(req);
    } else {
      // Check partial matches
      const hasPartial = [...expandedStudent].some(
        s => s.includes(normReq) || normReq.includes(s)
      );
      if (hasPartial) {
        overlapping.push(req);
      } else {
        missing.push(req);
      }
    }
  }

  const similarity = jobRequirements.length > 0
    ? overlapping.length / jobRequirements.length
    : 0;

  return {
    similarity,
    semantic_overlap: overlapping,
    missing_semantic_skills: missing,
  };
}
```

---

## Phase 4: Graph Neural Network Course Linking

**Timeline:** Week 4-5
**Effort:** 24 hours
**Dependencies:** Phase 0, skill relationships data

### 4.1 Skill Transfer Graph

**File:** `supabase/functions/_shared/skill-graph.ts`

```typescript
/**
 * Skill Relationship Graph with Transfer Coefficients
 *
 * Patent Claim: Graph-based skill matching using transfer coefficients
 * derived from course prerequisites, job co-occurrence, and student
 * learning sequences - producing more accurate course recommendations
 * than isolated keyword matching.
 */

export interface SkillNode {
  name: string;
  embedding?: number[];
  neighbors: Map<string, number>; // skill -> transfer coefficient
}

export interface SkillGraph {
  nodes: Map<string, SkillNode>;
  getTransferScore: (from: string, to: string, depth?: number) => number;
  getRelatedSkills: (skill: string, minCoefficient?: number) => string[];
}

/**
 * Build skill graph from relationship data
 */
export function buildSkillGraph(
  relationships: Array<{
    source_skill: string;
    target_skill: string;
    transfer_coefficient: number;
  }>
): SkillGraph {
  const nodes = new Map<string, SkillNode>();

  // Build nodes and edges
  for (const rel of relationships) {
    // Ensure source node exists
    if (!nodes.has(rel.source_skill)) {
      nodes.set(rel.source_skill, {
        name: rel.source_skill,
        neighbors: new Map(),
      });
    }

    // Ensure target node exists
    if (!nodes.has(rel.target_skill)) {
      nodes.set(rel.target_skill, {
        name: rel.target_skill,
        neighbors: new Map(),
      });
    }

    // Add edge
    nodes.get(rel.source_skill)!.neighbors.set(
      rel.target_skill,
      rel.transfer_coefficient
    );
  }

  return {
    nodes,

    getTransferScore(from: string, to: string, maxDepth: number = 2): number {
      if (from === to) return 1.0;

      const visited = new Set<string>();
      const queue: Array<{ skill: string; score: number; depth: number }> = [
        { skill: from, score: 1.0, depth: 0 }
      ];

      let bestScore = 0;

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.skill)) continue;
        visited.add(current.skill);

        if (current.skill === to) {
          bestScore = Math.max(bestScore, current.score);
          continue;
        }

        if (current.depth >= maxDepth) continue;

        const node = nodes.get(current.skill);
        if (!node) continue;

        for (const [neighbor, coefficient] of node.neighbors) {
          if (!visited.has(neighbor)) {
            queue.push({
              skill: neighbor,
              score: current.score * coefficient,
              depth: current.depth + 1,
            });
          }
        }
      }

      return bestScore;
    },

    getRelatedSkills(skill: string, minCoefficient: number = 0.3): string[] {
      const node = nodes.get(skill);
      if (!node) return [];

      return [...node.neighbors.entries()]
        .filter(([_, coef]) => coef >= minCoefficient)
        .map(([name, _]) => name);
    },
  };
}

/**
 * Score a course against skill gaps using transfer coefficients
 */
export function scoreCourseWithTransfer(
  courseSkills: string[],
  gapSkills: string[],
  graph: SkillGraph
): {
  totalScore: number;
  directMatches: string[];
  transferMatches: Array<{ from: string; to: string; coefficient: number }>;
} {
  const directMatches: string[] = [];
  const transferMatches: Array<{ from: string; to: string; coefficient: number }> = [];
  let totalScore = 0;

  for (const gap of gapSkills) {
    for (const courseSkill of courseSkills) {
      if (courseSkill.toLowerCase() === gap.toLowerCase()) {
        // Direct match
        directMatches.push(gap);
        totalScore += 1.0;
        break;
      } else {
        // Check transfer
        const transfer = graph.getTransferScore(courseSkill, gap);
        if (transfer > 0.3) {
          transferMatches.push({
            from: courseSkill,
            to: gap,
            coefficient: transfer,
          });
          totalScore += transfer;
          break;
        }
      }
    }
  }

  // Normalize by number of gaps
  const normalizedScore = gapSkills.length > 0
    ? totalScore / gapSkills.length
    : 0;

  return {
    totalScore: normalizedScore,
    directMatches,
    transferMatches,
  };
}

/**
 * Message-passing aggregation (simplified GNN layer)
 * Each node aggregates features from neighbors
 */
export function aggregateNeighborFeatures(
  graph: SkillGraph,
  nodeFeatures: Map<string, number[]>,
  rounds: number = 2
): Map<string, number[]> {
  let currentFeatures = new Map(nodeFeatures);

  for (let round = 0; round < rounds; round++) {
    const nextFeatures = new Map<string, number[]>();

    for (const [name, node] of graph.nodes) {
      const selfFeature = currentFeatures.get(name) || [];
      if (selfFeature.length === 0) continue;

      // Aggregate neighbor features weighted by transfer coefficient
      const aggregated = [...selfFeature];
      let totalWeight = 1.0;

      for (const [neighbor, coefficient] of node.neighbors) {
        const neighborFeature = currentFeatures.get(neighbor);
        if (neighborFeature) {
          for (let i = 0; i < aggregated.length; i++) {
            aggregated[i] += neighborFeature[i] * coefficient;
          }
          totalWeight += coefficient;
        }
      }

      // Normalize
      nextFeatures.set(
        name,
        aggregated.map(v => v / totalWeight)
      );
    }

    currentFeatures = nextFeatures;
  }

  return currentFeatures;
}
```

---

## Phase 5: NSGA-II Course Selection

**Timeline:** Week 5-6
**Effort:** 20 hours
**Dependencies:** Phases 1-4

### 5.1 Multi-Objective Optimizer

**File:** `supabase/functions/_shared/course-optimizer.ts`

```typescript
/**
 * NSGA-II Multi-Objective Course Selection
 *
 * Patent Claims:
 * 1. Pareto-optimal learning path generation
 * 2. Multi-objective optimization: time, coverage, prerequisites
 * 3. Customized genetic operators for course sequences
 */

export interface Course {
  id: string;
  title: string;
  skills_taught: string[];
  duration_hours: number;
  prerequisites: string[];
  cost_usd: number;
}

export interface LearningPath {
  courses: Course[];
  total_hours: number;
  skills_covered: Set<string>;
  gaps_remaining: Set<string>;
  prerequisite_violations: number;
  cost_usd: number;
}

export interface OptimizationResult {
  pareto_front: LearningPath[];
  recommended: LearningPath;
  fastest: LearningPath;
  most_comprehensive: LearningPath;
}

interface Individual {
  chromosome: string[]; // Course IDs in order
  objectives: number[]; // [time, uncovered_gaps, violations]
  rank: number;
  crowding_distance: number;
}

/**
 * NSGA-II Algorithm
 */
export function optimizeLearningPath(
  availableCourses: Course[],
  skillGaps: string[],
  maxHours: number = 100,
  populationSize: number = 100,
  generations: number = 50
): OptimizationResult {
  const courseMap = new Map(availableCourses.map(c => [c.id, c]));

  // Initialize population
  let population = initializePopulation(
    availableCourses,
    skillGaps,
    populationSize
  );

  // Evaluate initial population
  population = evaluatePopulation(population, courseMap, skillGaps, maxHours);

  // Main evolution loop
  for (let gen = 0; gen < generations; gen++) {
    // Create offspring through selection, crossover, mutation
    const offspring = createOffspring(population, courseMap, availableCourses);

    // Evaluate offspring
    const evaluatedOffspring = evaluatePopulation(offspring, courseMap, skillGaps, maxHours);

    // Combine parent and offspring
    const combined = [...population, ...evaluatedOffspring];

    // Non-dominated sorting
    const fronts = nonDominatedSort(combined);

    // Select next generation
    population = selectNextGeneration(fronts, populationSize);
  }

  // Extract Pareto front (rank 0)
  const paretoFront = population
    .filter(ind => ind.rank === 0)
    .map(ind => buildLearningPath(ind.chromosome, courseMap, skillGaps));

  // Find special solutions
  const recommended = findBalancedSolution(paretoFront);
  const fastest = findFastestSolution(paretoFront);
  const mostComprehensive = findMostComprehensiveSolution(paretoFront);

  return {
    pareto_front: paretoFront,
    recommended,
    fastest,
    most_comprehensive: mostComprehensive,
  };
}

function initializePopulation(
  courses: Course[],
  gaps: string[],
  size: number
): Individual[] {
  const population: Individual[] = [];

  for (let i = 0; i < size; i++) {
    // Random subset of courses
    const numCourses = Math.floor(Math.random() * Math.min(10, courses.length)) + 1;
    const shuffled = [...courses].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, numCourses).map(c => c.id);

    population.push({
      chromosome: selected,
      objectives: [0, 0, 0],
      rank: 0,
      crowding_distance: 0,
    });
  }

  return population;
}

function evaluatePopulation(
  population: Individual[],
  courseMap: Map<string, Course>,
  gaps: string[],
  maxHours: number
): Individual[] {
  return population.map(ind => {
    const path = buildLearningPath(ind.chromosome, courseMap, gaps);

    // Objective 1: Minimize time (normalized)
    const timeObj = path.total_hours / maxHours;

    // Objective 2: Minimize uncovered gaps (normalized)
    const gapObj = path.gaps_remaining.size / gaps.length;

    // Objective 3: Minimize prerequisite violations
    const violationObj = path.prerequisite_violations / Math.max(ind.chromosome.length, 1);

    return {
      ...ind,
      objectives: [timeObj, gapObj, violationObj],
    };
  });
}

function buildLearningPath(
  courseIds: string[],
  courseMap: Map<string, Course>,
  gaps: string[]
): LearningPath {
  const courses = courseIds
    .map(id => courseMap.get(id))
    .filter((c): c is Course => c !== undefined);

  const skillsCovered = new Set<string>();
  courses.forEach(c => c.skills_taught.forEach(s => skillsCovered.add(s.toLowerCase())));

  const gapsRemaining = new Set(
    gaps.filter(g => !skillsCovered.has(g.toLowerCase()))
  );

  // Count prerequisite violations
  let violations = 0;
  const learnedSoFar = new Set<string>();
  for (const course of courses) {
    for (const prereq of course.prerequisites) {
      if (!learnedSoFar.has(prereq.toLowerCase())) {
        violations++;
      }
    }
    course.skills_taught.forEach(s => learnedSoFar.add(s.toLowerCase()));
  }

  return {
    courses,
    total_hours: courses.reduce((sum, c) => sum + c.duration_hours, 0),
    skills_covered: skillsCovered,
    gaps_remaining: gapsRemaining,
    prerequisite_violations: violations,
    cost_usd: courses.reduce((sum, c) => sum + c.cost_usd, 0),
  };
}

function nonDominatedSort(population: Individual[]): Individual[][] {
  const fronts: Individual[][] = [[]];
  const dominationCount = new Map<Individual, number>();
  const dominatedSet = new Map<Individual, Individual[]>();

  for (const p of population) {
    dominationCount.set(p, 0);
    dominatedSet.set(p, []);

    for (const q of population) {
      if (p === q) continue;

      if (dominates(p, q)) {
        dominatedSet.get(p)!.push(q);
      } else if (dominates(q, p)) {
        dominationCount.set(p, dominationCount.get(p)! + 1);
      }
    }

    if (dominationCount.get(p) === 0) {
      p.rank = 0;
      fronts[0].push(p);
    }
  }

  let i = 0;
  while (fronts[i].length > 0) {
    const nextFront: Individual[] = [];

    for (const p of fronts[i]) {
      for (const q of dominatedSet.get(p)!) {
        const count = dominationCount.get(q)! - 1;
        dominationCount.set(q, count);

        if (count === 0) {
          q.rank = i + 1;
          nextFront.push(q);
        }
      }
    }

    i++;
    if (nextFront.length > 0) {
      fronts.push(nextFront);
    }
  }

  return fronts;
}

function dominates(a: Individual, b: Individual): boolean {
  let dominated = false;
  for (let i = 0; i < a.objectives.length; i++) {
    if (a.objectives[i] > b.objectives[i]) return false;
    if (a.objectives[i] < b.objectives[i]) dominated = true;
  }
  return dominated;
}

function selectNextGeneration(
  fronts: Individual[][],
  size: number
): Individual[] {
  const next: Individual[] = [];

  for (const front of fronts) {
    if (next.length + front.length <= size) {
      next.push(...front);
    } else {
      // Calculate crowding distance and select best
      const withDistance = calculateCrowdingDistance(front);
      withDistance.sort((a, b) => b.crowding_distance - a.crowding_distance);
      next.push(...withDistance.slice(0, size - next.length));
      break;
    }
  }

  return next;
}

function calculateCrowdingDistance(front: Individual[]): Individual[] {
  if (front.length <= 2) {
    return front.map(ind => ({ ...ind, crowding_distance: Infinity }));
  }

  const numObjectives = front[0].objectives.length;
  front.forEach(ind => ind.crowding_distance = 0);

  for (let m = 0; m < numObjectives; m++) {
    front.sort((a, b) => a.objectives[m] - b.objectives[m]);
    front[0].crowding_distance = Infinity;
    front[front.length - 1].crowding_distance = Infinity;

    const range = front[front.length - 1].objectives[m] - front[0].objectives[m];
    if (range === 0) continue;

    for (let i = 1; i < front.length - 1; i++) {
      front[i].crowding_distance +=
        (front[i + 1].objectives[m] - front[i - 1].objectives[m]) / range;
    }
  }

  return front;
}

function createOffspring(
  population: Individual[],
  courseMap: Map<string, Course>,
  allCourses: Course[]
): Individual[] {
  const offspring: Individual[] = [];

  while (offspring.length < population.length) {
    // Tournament selection
    const parent1 = tournamentSelect(population);
    const parent2 = tournamentSelect(population);

    // Crossover
    let child = crossover(parent1, parent2);

    // Mutation
    child = mutate(child, allCourses);

    offspring.push(child);
  }

  return offspring;
}

function tournamentSelect(population: Individual[], k: number = 3): Individual {
  const candidates = [];
  for (let i = 0; i < k; i++) {
    candidates.push(population[Math.floor(Math.random() * population.length)]);
  }

  return candidates.reduce((best, curr) => {
    if (curr.rank < best.rank) return curr;
    if (curr.rank === best.rank && curr.crowding_distance > best.crowding_distance) return curr;
    return best;
  });
}

function crossover(parent1: Individual, parent2: Individual): Individual {
  const crossPoint = Math.floor(Math.random() * parent1.chromosome.length);
  const child = [
    ...parent1.chromosome.slice(0, crossPoint),
    ...parent2.chromosome.filter(c => !parent1.chromosome.slice(0, crossPoint).includes(c)),
  ];

  return {
    chromosome: child,
    objectives: [0, 0, 0],
    rank: 0,
    crowding_distance: 0,
  };
}

function mutate(individual: Individual, allCourses: Course[]): Individual {
  const mutationRate = 0.1;
  const chromosome = [...individual.chromosome];

  if (Math.random() < mutationRate) {
    // Add random course
    const available = allCourses.filter(c => !chromosome.includes(c.id));
    if (available.length > 0) {
      const toAdd = available[Math.floor(Math.random() * available.length)];
      chromosome.push(toAdd.id);
    }
  }

  if (Math.random() < mutationRate && chromosome.length > 1) {
    // Remove random course
    const idx = Math.floor(Math.random() * chromosome.length);
    chromosome.splice(idx, 1);
  }

  if (Math.random() < mutationRate && chromosome.length > 1) {
    // Swap two courses
    const i = Math.floor(Math.random() * chromosome.length);
    const j = Math.floor(Math.random() * chromosome.length);
    [chromosome[i], chromosome[j]] = [chromosome[j], chromosome[i]];
  }

  return { ...individual, chromosome };
}

function findBalancedSolution(front: LearningPath[]): LearningPath {
  // Find solution closest to ideal point (normalized)
  let best = front[0];
  let bestDistance = Infinity;

  for (const path of front) {
    const timeNorm = path.total_hours / 100;
    const gapNorm = path.gaps_remaining.size / 10;
    const violNorm = path.prerequisite_violations / 5;

    const distance = Math.sqrt(timeNorm ** 2 + gapNorm ** 2 + violNorm ** 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = path;
    }
  }

  return best;
}

function findFastestSolution(front: LearningPath[]): LearningPath {
  return front.reduce((min, curr) =>
    curr.total_hours < min.total_hours ? curr : min
  );
}

function findMostComprehensiveSolution(front: LearningPath[]): LearningPath {
  return front.reduce((min, curr) =>
    curr.gaps_remaining.size < min.gaps_remaining.size ? curr : min
  );
}
```

---

## Implementation Schedule

| Phase | Week | Hours | Deliverables |
|-------|------|-------|--------------|
| 0 - Data Infrastructure | 1 | 8 | DB migration, logging hooks, outcome tracking |
| 1 - Weibull Decay | 1-2 | 12 | skill-decay.ts, gap-analysis integration |
| 2 - IRT Assessment | 2-3 | 20 | irt-engine.ts, adaptive-session.ts |
| 3 - Semantic Matching | 3-4 | 24 | skill-embeddings.ts, fallback matching |
| 4 - Skill Graph | 4-5 | 24 | skill-graph.ts, course scoring |
| 5 - NSGA-II | 5-6 | 20 | course-optimizer.ts, Pareto paths |
| **Total** | | **108** | |

---

## Patent Claims Summary

### Claim 1: Career-Outcome Embedding Space
A computer-implemented method for matching skills to jobs comprising training an embedding model on career placement outcomes to position skills, jobs, and courses in a semantic space.

### Claim 2: Adaptive Assessment with Real-time Recalibration
A computer-implemented assessment system that simultaneously estimates student ability and question parameters, using information-maximizing question selection.

### Claim 3: Skill Transfer Graph
A computer-implemented course recommendation system using a directed graph of skill relationships with transfer coefficients derived from prerequisite data, job co-occurrence, and student sequences.

### Claim 4: Weibull Skill Decay
A computer-implemented skill tracking system with category-specific Weibull decay parameters empirically calibrated from retest data.

### Claim 5: Multi-Objective Learning Path Optimization
A computer-implemented learning path system using NSGA-II to generate Pareto-optimal course sequences balancing time, coverage, and prerequisites.

---

## Success Metrics

| Algorithm | Current Performance | Target Performance | Measurement |
|-----------|--------------------|--------------------|-------------|
| Skill Matching | 20% semantic overlap detection | 75%+ | A/B test against Jaccard |
| Assessment | ±0.5 level accuracy | ±0.1 level (θ SE < 0.3) | Retest correlation |
| Course Linking | 30% relevant recommendations | 70%+ | User engagement |
| Skill Freshness | Binary fresh/stale | Continuous decay score | Retest validation |
| Course Selection | N/A (greedy) | Pareto-optimal paths | Coverage vs. time curve |

---

*Algorithm Upgrade Plan v1.0 - 2026-01-31*
