/**
 * Semantic Validation V2 Service
 * Ported from projectify-syllabus/semantic-validation-v2-service.ts
 *
 * PHASE 4 of the pipeline: Validate companies using Lightcast skill ID matching.
 *
 * This module extracts skills from company job postings and compares them
 * against the course skill IDs for exact matching.
 *
 * Key difference from V1:
 * - Uses Lightcast skill IDs for exact matching (not keyword-based)
 * - Compares structured DWAs instead of text similarity
 * - Generates detailed match explanations
 *
 * Adaptations for syllabusstack:
 * - Uses fetchWithTimeout from ./timeout-config.ts instead of manual AbortController
 * - Uses ../embedding-client.ts for embeddings (generateEmbedding, cosineSimilarity)
 * - Uses ../unified-ai-client.ts for any AI calls (no Lovable gateway)
 */

import { fetchWithTimeout, API_TIMEOUT_MS } from './timeout-config.ts';
import { generateEmbedding, cosineSimilarity } from '../embedding-client.ts';

// ============================================================================
// TYPES (inline to avoid circular dependencies with pipeline-types.ts)
// ============================================================================

export interface LightcastSkillId {
  id: string;
  name: string;
  type: string;
  category: string;
  confidence: number;
  relatedSkillIds: string[];
}

export interface DetailedWorkActivity {
  id?: string;
  name: string;
  importance?: number;
}

export interface DiscoveredCompanyForValidation {
  name: string;
  jobPostings: Array<{
    id: string;
    title: string;
    description: string;
    [key: string]: any;
  }>;
  technologies: string[];
  [key: string]: any;
}

export interface SkillMatch {
  courseSkillId: string;
  courseSkillName: string;
  jobSkillId: string;
  jobSkillName: string;
  matchType: 'exact' | 'related';
  foundInJobs: string[];
}

export interface DWAMatch {
  courseDWA: string;
  jobRequirement: string;
  similarity: number;
}

export interface SemanticValidation {
  overallScore: number;
  confidence: 'high' | 'medium' | 'low';
  skillMatches: SkillMatch[];
  skillMatchScore: number;
  dwaMatches: DWAMatch[];
  dwaMatchScore: number;
  technologyMatches: string[];
  technologyMatchScore: number;
  missingSkills: string[];
  additionalSkillsNeeded: string[];
  explanation: string;
}

export interface ValidatedCompany extends DiscoveredCompanyForValidation {
  validation: SemanticValidation;
  extractedJobSkillIds: string[];
}

export interface SemanticValidationInput {
  companies: DiscoveredCompanyForValidation[];
  courseSkillIds: LightcastSkillId[];
  courseDWAs: DetailedWorkActivity[];
}

export interface SemanticValidationOutput {
  validatedCompanies: ValidatedCompany[];
  stats: {
    inputCount: number;
    passedValidation: number;
    highConfidence: number;
    mediumConfidence: number;
    failedValidation: number;
    avgSemanticScore: number;
    processingTimeMs: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LIGHTCAST_API_BASE = 'https://emsiservices.com/skills';
const LIGHTCAST_API_VERSION = 'versions/latest';
const VALIDATION_THRESHOLD = 0.3; // Minimum score to pass validation
const REQUEST_TIMEOUT_MS = API_TIMEOUT_MS; // Use centralized timeout

// Cache for extracted job skills
const jobSkillCache = new Map<string, { skills: LightcastSkillId[]; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize a skill name for comparison (inline since lightcast-client
 * does not export normalizeSkillName in syllabusstack)
 */
function normalizeSkillName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Get Lightcast API key
 */
function getLightcastApiKey(): string | null {
  return Deno.env.get('LIGHTCAST_API_KEY') || null;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// SKILL EXTRACTION FROM JOB POSTINGS
// ============================================================================

/**
 * Extract skills from job posting text using Lightcast
 */
async function extractSkillsFromJobPosting(
  jobId: string,
  jobTitle: string,
  jobDescription: string,
  apiKey: string
): Promise<LightcastSkillId[]> {
  // Check cache first
  const cacheKey = jobId || `${jobTitle.substring(0, 50)}`;
  const cached = jobSkillCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.skills;
  }

  const text = `${jobTitle}\n${jobDescription}`;

  try {
    const response = await fetchWithTimeout(
      `${LIGHTCAST_API_BASE}/${LIGHTCAST_API_VERSION}/extract`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          confidenceThreshold: 0.5,
        }),
      },
      REQUEST_TIMEOUT_MS,
      'Lightcast Skill Extraction'
    );

    if (!response.ok) {
      console.warn(`  [Validation] Could not extract skills from job: ${response.status}`);
      return [];
    }

    const result = await response.json();

    const skills: LightcastSkillId[] = (result.data || []).map((item: any) => ({
      id: item.skill.id,
      name: item.skill.name,
      type: item.skill.type?.name || 'Hard Skill',
      category: item.skill.category?.name || 'Unknown',
      confidence: item.confidence,
      relatedSkillIds: [],
    }));

    // Cache result
    jobSkillCache.set(cacheKey, { skills, timestamp: Date.now() });

    return skills;

  } catch (error) {
    console.warn(`  [Validation] Error extracting job skills: ${error}`);
    return [];
  }
}

// ============================================================================
// SKILL COMPARISON
// ============================================================================

/**
 * Compare course skill IDs with job posting skill IDs
 */
function compareSkillIds(
  courseSkills: LightcastSkillId[],
  jobSkills: LightcastSkillId[],
  jobId: string
): SkillMatch[] {
  const matches: SkillMatch[] = [];

  const jobSkillIds = new Set(jobSkills.map(s => s.id));
  const jobSkillNames = new Set(jobSkills.map(s => normalizeSkillName(s.name)));

  for (const courseSkill of courseSkills) {
    // Exact ID match
    if (jobSkillIds.has(courseSkill.id)) {
      const matchingJobSkill = jobSkills.find(s => s.id === courseSkill.id)!;
      matches.push({
        courseSkillId: courseSkill.id,
        courseSkillName: courseSkill.name,
        jobSkillId: matchingJobSkill.id,
        jobSkillName: matchingJobSkill.name,
        matchType: 'exact',
        foundInJobs: [jobId],
      });
      continue;
    }

    // Check related skills
    for (const relatedId of courseSkill.relatedSkillIds) {
      if (jobSkillIds.has(relatedId)) {
        const matchingJobSkill = jobSkills.find(s => s.id === relatedId)!;
        matches.push({
          courseSkillId: courseSkill.id,
          courseSkillName: courseSkill.name,
          jobSkillId: matchingJobSkill.id,
          jobSkillName: matchingJobSkill.name,
          matchType: 'related',
          foundInJobs: [jobId],
        });
        break;
      }
    }

    // Check by normalized name as last resort
    const normalizedCourseName = normalizeSkillName(courseSkill.name);
    if (jobSkillNames.has(normalizedCourseName)) {
      const matchingJobSkill = jobSkills.find(s =>
        normalizeSkillName(s.name) === normalizedCourseName
      )!;
      matches.push({
        courseSkillId: courseSkill.id,
        courseSkillName: courseSkill.name,
        jobSkillId: matchingJobSkill.id,
        jobSkillName: matchingJobSkill.name,
        matchType: 'related', // Name match is considered related, not exact
        foundInJobs: [jobId],
      });
    }
  }

  return matches;
}

// ============================================================================
// DWA MATCHING
// ============================================================================

/**
 * Match course DWAs against job requirements using text similarity
 */
function matchDWAs(
  courseDWAs: DetailedWorkActivity[],
  jobDescriptions: string[]
): DWAMatch[] {
  const matches: DWAMatch[] = [];

  const combinedJobText = jobDescriptions.join(' ').toLowerCase();

  for (const dwa of courseDWAs) {
    const dwaName = dwa.name.toLowerCase();

    // Check for keyword overlap
    const dwaWords = dwaName.split(/\s+/).filter(w => w.length > 3);
    let matchCount = 0;

    for (const word of dwaWords) {
      if (combinedJobText.includes(word)) {
        matchCount++;
      }
    }

    const similarity = dwaWords.length > 0 ? matchCount / dwaWords.length : 0;

    if (similarity > 0.3) {
      matches.push({
        courseDWA: dwa.name,
        jobRequirement: `Found ${matchCount}/${dwaWords.length} matching terms`,
        similarity,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches.slice(0, 10); // Return top 10 matches
}

// ============================================================================
// TECHNOLOGY MATCHING
// ============================================================================

/**
 * Calculate technology match score
 */
function calculateTechnologyMatch(
  companyTechnologies: string[],
  occupationTechnologies: string[]
): { matches: string[]; score: number } {
  const normalizedCompanyTech = new Set(companyTechnologies.map(t => t.toLowerCase()));
  const normalizedOccTech = occupationTechnologies.map(t => t.toLowerCase());

  const matches: string[] = [];

  for (const tech of normalizedOccTech) {
    if (normalizedCompanyTech.has(tech)) {
      matches.push(tech);
    }
  }

  const score = normalizedOccTech.length > 0
    ? matches.length / normalizedOccTech.length
    : 0;

  return { matches, score };
}

// ============================================================================
// EXPLANATION & GAP ANALYSIS
// ============================================================================

/**
 * Generate human-readable match explanation
 */
function generateExplanation(
  skillMatches: SkillMatch[],
  dwaMatches: DWAMatch[],
  technologyMatches: string[],
  overallScore: number
): string {
  const parts: string[] = [];

  if (skillMatches.length > 0) {
    const exactMatches = skillMatches.filter(m => m.matchType === 'exact').length;
    const relatedMatches = skillMatches.filter(m => m.matchType === 'related').length;

    parts.push(`${skillMatches.length} skill matches (${exactMatches} exact, ${relatedMatches} related)`);

    const topSkills = skillMatches.slice(0, 3).map(m => m.courseSkillName).join(', ');
    parts.push(`Key matching skills: ${topSkills}`);
  } else {
    parts.push('No direct skill overlap found');
  }

  if (dwaMatches.length > 0) {
    parts.push(`${dwaMatches.length} work activity matches`);
  }

  if (technologyMatches.length > 0) {
    parts.push(`Uses ${technologyMatches.length} matching technologies`);
  }

  // Overall assessment
  if (overallScore >= 0.7) {
    parts.push('Strong match - highly relevant for this course');
  } else if (overallScore >= 0.5) {
    parts.push('Good match - relevant work opportunities');
  } else if (overallScore >= 0.3) {
    parts.push('Moderate match - some relevant opportunities');
  } else {
    parts.push('Weak match - limited skill overlap');
  }

  return parts.join('. ');
}

/**
 * Identify gaps between course skills and company needs
 */
function identifyGaps(
  courseSkills: LightcastSkillId[],
  jobSkills: LightcastSkillId[],
  skillMatches: SkillMatch[]
): { missingSkills: string[]; additionalNeeded: string[] } {
  const matchedCourseSkillIds = new Set(skillMatches.map(m => m.courseSkillId));
  const matchedJobSkillIds = new Set(skillMatches.map(m => m.jobSkillId));

  // Skills the course teaches but company doesn't need
  const missingSkills = courseSkills
    .filter(s => !matchedCourseSkillIds.has(s.id))
    .slice(0, 5)
    .map(s => s.name);

  // Skills company wants but course doesn't teach
  const additionalNeeded = jobSkills
    .filter(s => !matchedJobSkillIds.has(s.id))
    .filter(s => s.type === 'Hard Skill') // Focus on technical skills
    .slice(0, 5)
    .map(s => s.name);

  return { missingSkills, additionalNeeded };
}

// ============================================================================
// SINGLE COMPANY VALIDATION
// ============================================================================

/**
 * Validate a single company
 */
async function validateCompany(
  company: DiscoveredCompanyForValidation,
  courseSkills: LightcastSkillId[],
  courseDWAs: DetailedWorkActivity[],
  apiKey: string | null
): Promise<ValidatedCompany> {
  const allJobSkills: LightcastSkillId[] = [];
  const jobDescriptions: string[] = [];
  const allSkillMatches: SkillMatch[] = [];

  // Extract skills from each job posting
  if (apiKey && company.jobPostings.length > 0) {
    for (const job of company.jobPostings.slice(0, 5)) { // Limit to 5 jobs
      const jobSkills = await extractSkillsFromJobPosting(
        job.id,
        job.title,
        job.description,
        apiKey
      );

      allJobSkills.push(...jobSkills);
      jobDescriptions.push(`${job.title}. ${job.description}`);

      // Compare skills
      const matches = compareSkillIds(courseSkills, jobSkills, job.id);
      allSkillMatches.push(...matches);

      // Rate limit protection
      await sleep(100);
    }
  }

  // Deduplicate skill matches by course skill ID
  const uniqueMatches = new Map<string, SkillMatch>();
  for (const match of allSkillMatches) {
    const existing = uniqueMatches.get(match.courseSkillId);
    if (!existing || match.matchType === 'exact') {
      uniqueMatches.set(match.courseSkillId, {
        ...match,
        foundInJobs: existing
          ? [...new Set([...existing.foundInJobs, ...match.foundInJobs])]
          : match.foundInJobs,
      });
    }
  }
  const skillMatches = Array.from(uniqueMatches.values());

  // Match DWAs
  const dwaMatches = matchDWAs(courseDWAs, jobDescriptions);

  // Calculate technology match
  const techMatch = calculateTechnologyMatch(
    company.technologies,
    courseDWAs.flatMap(d => d.name.split(/\s+/).filter(w => w.length > 4))
  );

  // Calculate scores
  const skillMatchScore = courseSkills.length > 0
    ? skillMatches.length / courseSkills.length
    : 0;

  const dwaMatchScore = courseDWAs.length > 0
    ? dwaMatches.reduce((sum, m) => sum + m.similarity, 0) / courseDWAs.length
    : 0;

  // Weighted overall score
  // Skill matches: 50%, DWA matches: 30%, Technology: 20%
  const overallScore = (skillMatchScore * 0.5) + (dwaMatchScore * 0.3) + (techMatch.score * 0.2);

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (overallScore >= 0.6) {
    confidence = 'high';
  } else if (overallScore >= 0.35) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Identify gaps
  const gaps = identifyGaps(courseSkills, allJobSkills, skillMatches);

  // Generate explanation
  const explanation = generateExplanation(
    skillMatches,
    dwaMatches,
    techMatch.matches,
    overallScore
  );

  const validation: SemanticValidation = {
    overallScore,
    confidence,
    skillMatches,
    skillMatchScore,
    dwaMatches,
    dwaMatchScore,
    technologyMatches: techMatch.matches,
    technologyMatchScore: techMatch.score,
    missingSkills: gaps.missingSkills,
    additionalSkillsNeeded: gaps.additionalNeeded,
    explanation,
  };

  return {
    ...company,
    validation,
    extractedJobSkillIds: allJobSkills.map(s => s.id),
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * MAIN EXPORT: Validate companies using semantic skill matching
 *
 * This is the entry point for Phase 4 of the pipeline.
 */
export async function validateCompaniesSemanticly(
  input: SemanticValidationInput
): Promise<SemanticValidationOutput> {
  const startTime = Date.now();

  console.log(`\n========================================`);
  console.log(`PHASE 4: SEMANTIC VALIDATION (Lightcast)`);
  console.log(`========================================`);
  console.log(`Companies to validate: ${input.companies.length}`);
  console.log(`Course skills: ${input.courseSkillIds.length}`);
  console.log(`Course DWAs: ${input.courseDWAs.length}`);

  const apiKey = getLightcastApiKey();

  if (!apiKey) {
    console.warn(`  [Validation] Lightcast API key not configured`);
    console.warn(`  [Validation] Using basic validation without skill extraction`);
  }

  const validatedCompanies: ValidatedCompany[] = [];

  for (const company of input.companies) {
    console.log(`  Validating: ${company.name}...`);

    const validated = await validateCompany(
      company,
      input.courseSkillIds,
      input.courseDWAs,
      apiKey
    );

    validatedCompanies.push(validated);

    console.log(`    Score: ${(validated.validation.overallScore * 100).toFixed(0)}% (${validated.validation.confidence})`);
    console.log(`    Skill matches: ${validated.validation.skillMatches.length}/${input.courseSkillIds.length}`);
  }

  // Calculate stats
  const passedValidation = validatedCompanies.filter(
    c => c.validation.overallScore >= VALIDATION_THRESHOLD
  ).length;

  const highConfidence = validatedCompanies.filter(
    c => c.validation.confidence === 'high'
  ).length;

  const mediumConfidence = validatedCompanies.filter(
    c => c.validation.confidence === 'medium'
  ).length;

  const avgScore = validatedCompanies.length > 0
    ? validatedCompanies.reduce((sum, c) => sum + c.validation.overallScore, 0) / validatedCompanies.length
    : 0;

  const processingTimeMs = Date.now() - startTime;

  console.log(`\nPhase 4 Summary:`);
  console.log(`  Input: ${input.companies.length} companies`);
  console.log(`  Passed validation: ${passedValidation}`);
  console.log(`  High confidence: ${highConfidence}`);
  console.log(`  Medium confidence: ${mediumConfidence}`);
  console.log(`  Average score: ${(avgScore * 100).toFixed(0)}%`);
  console.log(`  Processing time: ${processingTimeMs}ms`);

  return {
    validatedCompanies,
    stats: {
      inputCount: input.companies.length,
      passedValidation,
      highConfidence,
      mediumConfidence,
      failedValidation: input.companies.length - passedValidation,
      avgSemanticScore: avgScore,
      processingTimeMs,
    },
  };
}
