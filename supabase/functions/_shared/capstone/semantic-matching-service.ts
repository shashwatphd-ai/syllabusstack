/**
 * Semantic Matching Service
 * Ported from EduThree1 — uses TF-IDF keyword overlap with adaptive threshold
 * for filtering companies by course relevance.
 *
 * This is a lightweight alternative to Sentence-BERT embeddings that works
 * without an external embedding service.
 */

import type { OnetOccupation } from './onet-service.ts';
import { generateBatchEmbeddings, cosineSimilarity } from '../embedding-client.ts';

export interface SemanticMatch {
  companyName: string;
  similarityScore: number;
  confidence: 'high' | 'medium' | 'low';
  matchingSkills: string[];
  matchingDWAs: string[];
  explanation: string;
  hasActiveJobs: boolean;
  hiringBoost: number;
}

export interface SemanticFilteringResult {
  matches: SemanticMatch[];
  allMatches: SemanticMatch[];
  totalCompanies: number;
  filteredCount: number;
  averageSimilarity: number;
  threshold: number;
  processingTimeMs: number;
}

/**
 * Rank companies by keyword-overlap similarity to course skills/occupations.
 * Includes adaptive threshold fallback if too few pass.
 */
export function rankCompaniesBySimilarity(
  courseSkills: string[],
  occupations: OnetOccupation[],
  companies: any[],
  threshold: number = 0.5
): SemanticFilteringResult {
  const startTime = Date.now();
  console.log(`\n🧠 [Semantic Matching] Ranking ${companies.length} companies (threshold: ${(threshold * 100).toFixed(0)}%)`);

  // Build course text tokens
  const courseTokens = buildCourseTokens(courseSkills, occupations);

  // Score each company
  const allMatches: SemanticMatch[] = companies.map(company => {
    const companyTokens = buildCompanyTokens(company);
    const similarity = computeKeywordSimilarity(courseTokens, companyTokens);

    const jobs = company.job_postings || company.jobPostings || [];
    const jobCount = Array.isArray(jobs) ? jobs.length : 0;
    const hasActiveJobs = jobCount > 0;

    // Hiring boost (up to 15%)
    let hiringBoost = 0;
    if (hasActiveJobs) {
      const multiplier = Math.min(1, jobCount / 10);
      hiringBoost = 0.15 * (0.5 + 0.5 * multiplier);
    }

    const boostedScore = Math.min(1.0, similarity * (1 + hiringBoost));
    const matchingSkills = findMatchingSkills(courseSkills, company);
    const matchingDWAs = findMatchingDWAs(occupations, company);

    const confidence: 'high' | 'medium' | 'low' =
      boostedScore >= 0.7 ? 'high' : boostedScore >= 0.5 ? 'medium' : 'low';

    return {
      companyName: company.name,
      similarityScore: boostedScore,
      confidence,
      matchingSkills,
      matchingDWAs,
      explanation: `${matchingSkills.length} skill matches, ${matchingDWAs.length} DWA matches`,
      hasActiveJobs,
      hiringBoost,
    };
  });

  allMatches.sort((a, b) => b.similarityScore - a.similarityScore);

  // Adaptive threshold: lower if too few pass
  let effectiveThreshold = threshold;
  let matches = allMatches.filter(m => m.similarityScore >= effectiveThreshold);

  if (matches.length < 3 && allMatches.length >= 3) {
    effectiveThreshold = threshold * 0.6;
    matches = allMatches.filter(m => m.similarityScore >= effectiveThreshold);
    console.log(`  ⚠️ Lowered threshold to ${(effectiveThreshold * 100).toFixed(0)}% (${matches.length} pass)`);
  }

  // Still too few? Take top N
  if (matches.length < 3 && allMatches.length > 0) {
    matches = allMatches.slice(0, Math.min(allMatches.length, 5));
    console.log(`  ⚠️ Taking top ${matches.length} regardless of score`);
  }

  const avgSimilarity = allMatches.length > 0
    ? allMatches.reduce((s, m) => s + m.similarityScore, 0) / allMatches.length
    : 0;

  console.log(`  ✅ Passed: ${matches.length}/${allMatches.length} (avg: ${(avgSimilarity * 100).toFixed(0)}%)`);

  return {
    matches,
    allMatches,
    totalCompanies: companies.length,
    filteredCount: allMatches.length - matches.length,
    averageSimilarity: avgSimilarity,
    threshold: effectiveThreshold,
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================
// TOKEN BUILDERS
// ============================================

function buildCourseTokens(skills: string[], occupations: OnetOccupation[]): Set<string> {
  const tokens = new Set<string>();
  for (const s of skills) tokenize(s).forEach(t => tokens.add(t));
  for (const occ of occupations) {
    tokenize(occ.title).forEach(t => tokens.add(t));
    for (const dwa of (occ.dwas || []).filter(d => d.importance > 60).slice(0, 10)) {
      tokenize(dwa.description || dwa.name).forEach(t => tokens.add(t));
    }
    for (const tech of (occ.technologies || []).slice(0, 10)) {
      tokenize(tech).forEach(t => tokens.add(t));
    }
  }
  return tokens;
}

function buildCompanyTokens(company: any): Set<string> {
  const tokens = new Set<string>();
  tokenize(company.description || '').forEach(t => tokens.add(t));
  tokenize(company.sector || company.industry || '').forEach(t => tokens.add(t));
  for (const tech of (company.technologies_used || company.technologies || [])) {
    tokenize(tech).forEach(t => tokens.add(t));
  }
  const jobs = company.job_postings || company.jobPostings || [];
  if (Array.isArray(jobs)) {
    for (const j of jobs.slice(0, 10)) {
      tokenize(j.title || '').forEach(t => tokens.add(t));
    }
  }
  for (const ind of (company.industries || company.industryTags || [])) {
    tokenize(ind).forEach(t => tokens.add(t));
  }
  return tokens;
}

// ============================================
// SIMILARITY
// ============================================

function computeKeywordSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  // Jaccard on the smaller set for better precision
  const minSize = Math.min(set1.size, set2.size);
  return intersection / minSize;
}

function findMatchingSkills(courseSkills: string[], company: any): string[] {
  const companyText = [
    company.description || '',
    ...(company.technologies_used || []),
    ...((company.job_postings || []).map((j: any) => j.title || '')),
  ].join(' ').toLowerCase();

  return courseSkills.filter(skill => companyText.includes(skill.toLowerCase()));
}

function findMatchingDWAs(occupations: OnetOccupation[], company: any): string[] {
  const companyText = [
    company.description || '',
    ...((company.job_postings || []).map((j: any) => j.title || '')),
  ].join(' ').toLowerCase();

  const matched: string[] = [];
  for (const occ of occupations) {
    for (const dwa of (occ.dwas || [])) {
      const dwaWords = dwa.name.toLowerCase().split(' ').filter(w => w.length > 4);
      if (dwaWords.some(w => companyText.includes(w))) {
        matched.push(dwa.name);
      }
    }
  }
  return [...new Set(matched)].slice(0, 10);
}

// ============================================
// TOKENIZER
// ============================================

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'our', 'your',
  'that', 'this', 'these', 'those', 'their', 'its', 'not', 'also', 'such',
]);

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

// ============================================
// EMBEDDING-BASED MATCHING
// ============================================

/**
 * Compute similarity scores between course keywords and company texts
 * using vector embeddings from the embedding client.
 */
export async function embeddingBasedMatch(
  courseKeywords: string[],
  companyTexts: string[]
): Promise<number[]> {
  const courseText = courseKeywords.join(' ');
  const allTexts = [courseText, ...companyTexts];
  const embeddings = await generateBatchEmbeddings(allTexts);
  const courseEmbedding = embeddings[0];

  return embeddings.slice(1).map(companyEmbedding =>
    cosineSimilarity(courseEmbedding, companyEmbedding)
  );
}

// ============================================
// HYBRID MATCHING
// ============================================

/**
 * Combine TF-IDF keyword overlap with embedding-based similarity.
 * Falls back to TF-IDF-only if embedding generation fails.
 */
export async function hybridMatch(
  courseKeywords: string[],
  companyTexts: string[],
  options?: { embeddingWeight?: number }
): Promise<number[]> {
  const embeddingWeight = options?.embeddingWeight ?? 0.6;

  // TF-IDF scores via keyword overlap
  const courseTokens = new Set<string>();
  for (const kw of courseKeywords) {
    tokenize(kw).forEach(t => courseTokens.add(t));
  }

  const tfidfScores = companyTexts.map(text => {
    const companyTokens = tokenize(text);
    return computeKeywordSimilarity(courseTokens, companyTokens);
  });

  // Attempt embedding-based matching
  let embeddingScores: number[] | null = null;
  try {
    embeddingScores = await embeddingBasedMatch(courseKeywords, companyTexts);
  } catch (err) {
    console.warn('[hybridMatch] Embedding matching failed, falling back to TF-IDF only:', err);
  }

  if (!embeddingScores) {
    return tfidfScores;
  }

  // Blend scores
  return tfidfScores.map((tfidf, i) => {
    const embedding = embeddingScores![i] ?? 0;
    return embeddingWeight * embedding + (1 - embeddingWeight) * tfidf;
  });
}

// ============================================
// ADAPTIVE THRESHOLD
// ============================================

/**
 * Calculate an adaptive threshold based on the distribution of scores.
 * Returns mean - 0.5 * stddev, with a minimum of 0.1.
 */
export function adaptiveThreshold(scores: number[]): number {
  if (scores.length === 0) return 0.1;

  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);

  return Math.max(0.1, mean - 0.5 * stddev);
}
