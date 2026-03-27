/**
 * Pipeline Types for Capstone Discovery
 * Ported from EduThree1 — type definitions for the multi-phase pipeline.
 */

// ============================================
// SKILL EXTRACTION TYPES
// ============================================

export interface IndustrySkill {
  skill: string;
  category: 'technical' | 'analytical' | 'domain' | 'tool' | 'framework';
  confidence: number;
  source: string;
  keywords: string[];
}

export interface SkillExtractionOutput {
  skills: IndustrySkill[];
  extractionMethod: 'ai-translation' | 'soc-fallback' | 'pattern-fallback';
  processingTimeMs: number;
}

// ============================================
// COMPANY DISCOVERY TYPES
// ============================================

export type DiscoveryStrategy =
  | 'technology_filter'
  | 'job_title_search'
  | 'industry_search';

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  postedDate: string;
  location?: string;
}

export interface DiscoveredCompany {
  apolloId: string;
  name: string;
  website?: string;
  industry: string;
  industryTags: string[];
  employeeCount: number;
  location: {
    city: string;
    state: string;
    country: string;
    streetAddress?: string;
    postalCode?: string;
  };
  description: string;
  jobPostings: JobPosting[];
  technologies: string[];
  fundingStage?: string;
  totalFunding?: number;
  discoveryStrategy: DiscoveryStrategy;
  // Enrichment fields (populated by apollo-enrichment-service)
  seoDescription?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactTitle?: string;
  contactPhone?: string;
  departmentalHeadCount?: Record<string, number>;
  buyingIntentSignals?: {
    fundingScore: number;
    hiringVelocityScore: number;
    compositeScore: number;
    signals: string[];
  };
  revenueRange?: string;
  lastEnrichedAt?: string;
  primary_domain?: string;
}

export interface CompanyDiscoveryInput {
  industries: string[];
  jobTitles: string[];
  skillKeywords: string[];
  location: string;
  targetCount: number;
}

export interface CompanyDiscoveryOutput {
  companies: DiscoveredCompany[];
  stats: {
    totalDiscovered: number;
    byStrategy: Record<DiscoveryStrategy, number>;
    processingTimeMs: number;
  };
}

// ============================================
// VALIDATION & RANKING TYPES
// ============================================

export interface CompanyValidation {
  isValid: boolean;
  confidence: number;
  reason: string;
  suggestedProjectType?: string;
  skillsOverlap: string[];
}

export interface ValidatedCompany extends DiscoveredCompany {
  validation: CompanyValidation;
}

export interface CompanyScores {
  semantic: number;
  hiring: number;
  location: number;
  size: number;
  diversity: number;
  buyingIntent: number;
  techOverlap: number;
  contactQuality: number;
  completeness: number;
  composite: number;
}

export interface RankedCompany {
  rank: number;
  company: ValidatedCompany;
  scores: CompanyScores;
  selectionReason: string;
}

// ============================================
// PIPELINE ORCHESTRATION TYPES
// ============================================

export interface PipelineInput {
  courseId: string;
  courseTitle: string;
  courseLevel: string;
  learningObjectives: string[];
  location: string;
  targetCount: number;
}

export interface PipelineOutput {
  success: boolean;
  companies: DiscoveredCompany[];
  companiesSaved: number;
  phases: {
    skillExtraction?: SkillExtractionOutput;
    discovery?: CompanyDiscoveryOutput;
  };
  totalProcessingTimeMs: number;
  error?: string;
}

// ============================================
// O*NET STRUCTURED TYPES
// (Used by onet-structured-service.ts)
// ============================================

export interface LightcastSkillId {
  id: string;
  name: string;
  confidence?: number;
}

export interface DetailedWorkActivity {
  id: string;
  name: string;
  importance: number;
  level?: number;
}

export interface OccupationTechnology {
  name: string;
  category?: string;
  apolloTechnologyUid?: string;
}

export interface MappedOccupation {
  socCode: string;
  title: string;
  confidence: number;
  dwas: DetailedWorkActivity[];
  technologies: OccupationTechnology[];
  industries: string[];
}

export interface OccupationMappingInput {
  skills: LightcastSkillId[];
  courseTitle: string;
  courseLevel?: string;
}

export interface OccupationMappingOutput {
  occupations: MappedOccupation[];
  allDWAs: DetailedWorkActivity[];
  allTechnologies: OccupationTechnology[];
  allIndustries: string[];
  processingTimeMs?: number;
}
