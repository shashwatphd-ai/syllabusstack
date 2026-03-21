/**
 * Context-Aware Industry Filtering System
 * Ported from EduThree1.
 *
 * Solves: "Should we exclude staffing companies?"
 * Answer: Depends on the course domain!
 *
 * ARCHITECTURE:
 * 1. Two-Tier Classification: Hard exclude (always) vs Soft exclude (context-dependent)
 * 2. SOC-Based Domain Detection: Automatically classify course type
 * 3. Job Posting Intelligence: Verify if company has real project opportunities
 */

import { SOCMapping } from './course-soc-mapping.ts';

// ========================================
// TIER 1: HARD EXCLUDE (Never Relevant)
// ========================================
const HARD_EXCLUDE_INDUSTRIES = [
  'insurance', 'insurance services',
  'legal services', 'law firm', 'law practice',
  'gambling', 'casino',
  'tobacco', 'alcohol'
];

// ========================================
// TIER 2: SOFT EXCLUDE (Context-Dependent)
// ========================================
const SOFT_EXCLUDE_INDUSTRIES = [
  'staffing', 'recruiting', 'recruitment',
  'human resources', 'hr services', 'hr consulting',
  'employment services', 'talent acquisition',
  'outsourcing'
];

// ========================================
// COURSE DOMAIN CLASSIFICATION
// ========================================

export type CourseDomain =
  | 'business_management'
  | 'engineering_technical'
  | 'computer_tech'
  | 'healthcare_science'
  | 'hybrid'
  | 'unknown';

/**
 * Classify course domain based on SOC codes
 */
export function classifyCourseDomain(socMappings: SOCMapping[]): {
  domain: CourseDomain;
  confidence: number;
  reasoning: string;
} {
  if (!socMappings || socMappings.length === 0) {
    return { domain: 'unknown', confidence: 0, reasoning: 'No SOC mappings available' };
  }

  const domainVotes: Record<CourseDomain, number> = {
    'business_management': 0,
    'engineering_technical': 0,
    'computer_tech': 0,
    'healthcare_science': 0,
    'hybrid': 0,
    'unknown': 0
  };

  for (const soc of socMappings) {
    const group = soc.socCode.split('-')[0];
    const weight = soc.confidence;

    switch (group) {
      case '11': case '13':
        domainVotes['business_management'] += weight;
        break;
      case '15':
        domainVotes['computer_tech'] += weight;
        break;
      case '17':
        domainVotes['engineering_technical'] += weight;
        break;
      case '19': case '29':
        domainVotes['healthcare_science'] += weight;
        break;
      case '51':
        domainVotes['engineering_technical'] += weight * 0.8;
        break;
      default:
        domainVotes['unknown'] += weight * 0.5;
    }
  }

  const sortedDomains = Object.entries(domainVotes).sort(([, a], [, b]) => b - a);
  const [primaryDomain, primaryScore] = sortedDomains[0];
  const [, secondaryScore] = sortedDomains[1];
  const totalScore = Object.values(domainVotes).reduce((sum, s) => sum + s, 0);
  const primaryPercentage = totalScore > 0 ? primaryScore / totalScore : 0;

  if (primaryPercentage < 0.6 && secondaryScore > 0) {
    return {
      domain: 'hybrid',
      confidence: 1 - primaryPercentage,
      reasoning: `Hybrid course: ${Math.round(primaryPercentage * 100)}% ${primaryDomain}`
    };
  }

  return {
    domain: primaryDomain as CourseDomain,
    confidence: primaryPercentage,
    reasoning: `Primary domain: ${primaryDomain} (${Math.round(primaryPercentage * 100)}%)`
  };
}

/**
 * Check if a company industry should be excluded based on course context.
 * This is the MAIN function used by all filtering layers.
 */
export function shouldExcludeIndustry(
  companySector: string,
  courseDomain: CourseDomain,
  socMappings: SOCMapping[],
  companyJobPostings?: any[]
): {
  shouldExclude: boolean;
  reason: string;
  penalty: number;
} {
  const sectorLower = companySector.toLowerCase();

  // TIER 1: Hard Exclude
  for (const hardExclude of HARD_EXCLUDE_INDUSTRIES) {
    if (sectorLower.includes(hardExclude)) {
      return { shouldExclude: true, reason: `Hard-excluded industry: ${hardExclude}`, penalty: 1.0 };
    }
  }

  // TIER 2: Soft Exclude
  const isSoftExclude = SOFT_EXCLUDE_INDUSTRIES.some(s => sectorLower.includes(s));
  if (!isSoftExclude) {
    return { shouldExclude: false, reason: 'Not an excluded industry', penalty: 0 };
  }

  // Context-dependent decision
  switch (courseDomain) {
    case 'business_management':
      return { shouldExclude: false, reason: 'Business/HR course - staffing companies are target industry', penalty: 0 };

    case 'engineering_technical':
    case 'computer_tech':
    case 'healthcare_science':
      return { shouldExclude: true, reason: 'Engineering/Tech course - staffing companies penalized (80%)', penalty: 0.8 };

    case 'hybrid':
      return handleHybridCourseIndustry(sectorLower, socMappings, companyJobPostings);

    case 'unknown':
    default:
      return { shouldExclude: true, reason: 'Unknown course domain - excluding staffing (conservative)', penalty: 0.8 };
  }
}

function handleHybridCourseIndustry(
  _companySector: string,
  socMappings: SOCMapping[],
  companyJobPostings?: any[]
): { shouldExclude: boolean; reason: string; penalty: number } {
  const primarySoc = socMappings[0];
  const majorGroup = primarySoc.socCode.split('-')[0];
  const isBusinessPrimary = ['11', '13'].includes(majorGroup);

  if (isBusinessPrimary) {
    return { shouldExclude: false, reason: 'Hybrid course with Business primary - staffing allowed', penalty: 0 };
  }

  if (companyJobPostings && companyJobPostings.length > 0) {
    if (analyzeJobPostingsForProjects(companyJobPostings)) {
      return { shouldExclude: false, reason: 'Staffing company with legitimate internal projects', penalty: 0.3 };
    }
  }

  return { shouldExclude: true, reason: 'Hybrid course with Tech primary - staffing penalized', penalty: 0.8 };
}

/**
 * Analyze job postings to determine if company has REAL project opportunities
 */
export function analyzeJobPostingsForProjects(jobPostings: any[]): boolean {
  if (!jobPostings || jobPostings.length === 0) return false;

  const projectRoleKeywords = [
    'software engineer', 'software developer', 'data scientist', 'data analyst',
    'data engineer', 'machine learning', 'devops', 'cloud engineer',
    'mechanical engineer', 'design engineer', 'manufacturing engineer',
    'industrial engineer', 'electrical engineer', 'civil engineer',
    'business analyst', 'product manager', 'financial analyst',
    'project manager', 'research scientist', 'research engineer',
    'operations analyst', 'strategy analyst', 'management consultant'
  ];

  const recruitingKeywords = [
    'recruiter', 'recruitment', 'talent acquisition', 'sourcer',
    'hr specialist', 'hr coordinator', 'staffing', 'headhunter'
  ];

  let legitimateRoleCount = 0;
  let recruitingRoleCount = 0;

  for (const posting of jobPostings) {
    const title = (posting.title || '').toLowerCase();
    const isRecruiting = recruitingKeywords.some(kw => title.includes(kw));
    if (isRecruiting) { recruitingRoleCount++; continue; }

    const isProjectRole = projectRoleKeywords.some(kw => title.includes(kw));
    if (isProjectRole) legitimateRoleCount++;
  }

  return legitimateRoleCount >= 1 && legitimateRoleCount >= recruitingRoleCount;
}

/**
 * Get expected industries from SOC mappings
 */
export function getExpectedIndustriesFromSOC(socMappings: SOCMapping[]): string[] {
  return [...new Set(socMappings.flatMap(soc => soc.industries))];
}
