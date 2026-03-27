/**
 * Signal-Driven Company Discovery — Type Definitions
 * Ported from EduThree1's signal-types.ts
 */

// =============================================================================
// CORE INTERFACES
// =============================================================================

export interface SignalResult {
  score: number;        // 0-100
  confidence: number;   // 0-1
  signals: string[];
  rawData?: unknown;
  error?: string;
}

export interface SignalContext {
  company: CompanyForSignal;
  syllabusSkills: string[];
  syllabusDomain: string;
  jobPostings?: JobPosting[];
  apolloApiKey?: string;
}

export interface SignalProvider {
  readonly name: SignalName;
  readonly weight: number;
  calculate(context: SignalContext): Promise<SignalResult>;
}

// =============================================================================
// SIGNAL NAMES & WEIGHTS
// =============================================================================

export type SignalName =
  | 'job_skills_match'
  | 'market_intelligence'
  | 'department_fit'
  | 'contact_quality';

export const SIGNAL_WEIGHTS: Record<SignalName, number> = {
  job_skills_match: 0.35,
  market_intelligence: 0.25,
  department_fit: 0.20,
  contact_quality: 0.20,
} as const;

// =============================================================================
// COMPOSITE SCORING
// =============================================================================

export interface SignalScores {
  jobSkillsMatch: number;
  marketIntelligence: number;
  departmentFit: number;
  contactQuality: number;
}

export interface CompositeScore {
  overall: number;
  confidence: 'high' | 'medium' | 'low';
  components: SignalScores;
  signalsDetected: {
    hasActiveJobPostings: boolean;
    hasFundingNews: boolean;
    hasHiringNews: boolean;
    hasDepartmentGrowth: boolean;
    hasTechnologyMatch: boolean;
    hasDecisionMakers: boolean;
  };
  breakdown: string;
  errors: string[];
}

// =============================================================================
// COMPANY DATA
// =============================================================================

export interface CompanyForSignal {
  id: string;
  name: string;
  apollo_organization_id?: string | null;
  industries?: unknown;
  departmental_head_count?: unknown;
  technologies?: unknown;
  technologies_used?: unknown;
  job_postings?: unknown;
  description?: string | null;
  size?: string | null;
  sector?: string | null;
  funding_stage?: string | null;
  total_funding_usd?: number | null;
  contact_email?: string | null;
  contact_person?: string | null;
  contact_title?: string | null;
}

export interface JobPosting {
  id?: string;
  title: string;
  url?: string;
  posted_at?: string;
  location?: string;
  description?: string;
}

// =============================================================================
// FALLBACK CONFIG
// =============================================================================

export interface FallbackConfig {
  minScoreThreshold: number;
  fallbackThreshold: number;
  minCompaniesToReturn: number;
  maxCompaniesToReturn: number;
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  minScoreThreshold: 50,
  fallbackThreshold: 30,
  minCompaniesToReturn: 3,
  maxCompaniesToReturn: 15,
} as const;

// =============================================================================
// STORABLE DATA
// =============================================================================

export interface StorableSignalData {
  skill_match_score: number | null;
  market_signal_score: number | null;
  department_fit_score: number | null;
  contact_quality_score: number | null;
  composite_signal_score: number | null;
  signal_confidence: 'high' | 'medium' | 'low' | null;
  signal_data: CompositeScore | null;
}
