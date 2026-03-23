/**
 * Company Ranking Service (v2 — Full Enrichment Utilization)
 *
 * PHASE 5 of the pipeline: Rank and select final companies.
 *
 * 9-factor scoring using ALL Apollo enrichment signals:
 * - Semantic score (25%) - Validation confidence / skill overlap
 * - Hiring score (15%) - Job postings quantity + title relevance
 * - Buying Intent (12%) - Funding + hiring velocity composite
 * - Location score (12%) - Metro-aware proximity
 * - Tech Overlap (10%) - Course skills vs company tech stack
 * - Size score (8%) - Company size fit for capstone projects
 * - Completeness (8%) - Data completeness from enrichment
 * - Diversity score (5%) - Industry variety bonus
 * - Contact Quality (5%) - Verified decision-maker contact
 */

import { isSameMetroArea } from './location-utils.ts';

// ============================================
// TYPES
// ============================================

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
  company: any;
  scores: CompanyScores;
  selectionReason: string;
}

export interface RankingOutput {
  selected: RankedCompany[];
  alternates: RankedCompany[];
  selectionSummary: {
    avgSemanticScore: number;
    industriesCovered: string[];
    sizesIncluded: string[];
    allHaveActiveHiring: boolean;
  };
}

// ============================================
// WEIGHTS (must sum to 1.0)
// ============================================

const WEIGHTS = {
  semantic: 0.25,
  hiring: 0.15,
  buyingIntent: 0.12,
  location: 0.12,
  techOverlap: 0.10,
  size: 0.08,
  completeness: 0.08,
  diversity: 0.05,
  contactQuality: 0.05,
};

// ============================================
// SCORING FUNCTIONS
// ============================================

function calculateSemanticScore(company: any): number {
  const validationConfidence = company.validation_confidence || 0.5;
  const skillsOverlap = company.skills_overlap || [];
  const skillBonus = Math.min(0.2, skillsOverlap.length * 0.03);
  return Math.min(1.0, validationConfidence + skillBonus);
}

/**
 * Hiring score: quantity + title relevance against course skills
 */
function calculateHiringScore(company: any, courseSkills: string[]): number {
  const jobs = company.job_postings || [];
  const jobCount = Array.isArray(jobs) ? jobs.length : 0;
  if (jobCount === 0) return 0;

  // Base quantity score (0-0.7)
  let quantityScore: number;
  if (jobCount >= 10) quantityScore = 0.7;
  else if (jobCount >= 5) quantityScore = 0.55;
  else if (jobCount >= 3) quantityScore = 0.4;
  else quantityScore = 0.25;

  // Relevance bonus: do any job titles contain course skill keywords? (0-0.3)
  let relevanceBonus = 0;
  if (courseSkills.length > 0 && Array.isArray(jobs)) {
    const lowerSkills = courseSkills.map(s => s.toLowerCase());
    let matchingJobs = 0;
    for (const job of jobs) {
      const title = (job.title || '').toLowerCase();
      if (lowerSkills.some(skill => title.includes(skill))) {
        matchingJobs++;
      }
    }
    const matchRatio = matchingJobs / jobs.length;
    relevanceBonus = Math.min(0.3, matchRatio * 0.5);
  }

  return Math.min(1.0, quantityScore + relevanceBonus);
}

/**
 * Location score: metro-area aware matching
 */
function calculateLocationScore(company: any, targetLocation: string): number {
  const companyAddress = (company.full_address || '').toLowerCase();
  const target = targetLocation.toLowerCase();

  if (!companyAddress || !target) return 0.5;

  const targetParts = target.split(',').map((p: string) => p.trim());
  const targetCity = targetParts[0] || '';
  const targetState = targetParts[1] || '';

  // Same city = perfect score
  if (targetCity && companyAddress.includes(targetCity)) return 1.0;

  // Metro area match
  if (targetCity && isSameMetroArea(targetCity, companyAddress)) return 0.9;

  // Same state = good score
  if (targetState && companyAddress.includes(targetState)) return 0.7;

  // Same country = moderate
  if (companyAddress.includes('united states') || companyAddress.includes('usa')) return 0.4;

  return 0.3;
}

/**
 * Size score: prefer 50-5000 employees for capstone projects
 */
function calculateSizeScore(company: any): number {
  const sizeStr = company.employee_count || company.size || '';
  const count = parseEmployeeCount(sizeStr);

  if (count === 0) return 0.5;
  if (count >= 50 && count <= 5000) return 1.0;
  if (count >= 20 && count <= 10000) return 0.8;
  if (count >= 10) return 0.6;
  return 0.4;
}

/**
 * Diversity bonus for industry variety
 */
function calculateDiversityScore(company: any, selectedIndustries: Set<string>): number {
  const companyIndustry = (company.sector || company.industry || 'unknown').toLowerCase();

  if (!selectedIndustries.has(companyIndustry)) {
    const diversityNeed = Math.max(0, 4 - selectedIndustries.size);
    return 0.5 + (diversityNeed * 0.125);
  }

  return Math.max(0.3, 1.0 - selectedIndustries.size * 0.05);
}

/**
 * NEW: Buying intent from stored composite score
 */
function calculateBuyingIntentScore(company: any): number {
  const signals = company.buying_intent_signals;
  if (!signals) return 0.3; // Unknown — neutral default

  const compositeScore = signals.compositeScore ?? signals.composite_score ?? 0;
  // compositeScore is typically 0-100 from enrichment service
  return Math.min(1.0, compositeScore / 100);
}

/**
 * NEW: Tech overlap — Jaccard similarity between company tech and course skills
 */
function calculateTechOverlapScore(company: any, courseSkills: string[]): number {
  const companyTech = company.technologies_used || [];
  if (!Array.isArray(companyTech) || companyTech.length === 0 || courseSkills.length === 0) {
    return 0.3; // No data — neutral
  }

  const lowerTech = new Set(companyTech.map((t: string) => t.toLowerCase()));
  const lowerSkills = new Set(courseSkills.map(s => s.toLowerCase()));

  let intersection = 0;
  for (const skill of lowerSkills) {
    for (const tech of lowerTech) {
      if (tech.includes(skill) || skill.includes(tech)) {
        intersection++;
        break;
      }
    }
  }

  const union = new Set([...lowerTech, ...lowerSkills]).size;
  if (union === 0) return 0.3;

  return Math.min(1.0, intersection / union + 0.1); // +0.1 baseline boost
}

/**
 * NEW: Contact quality — prefer companies with verified decision-maker contacts
 */
function calculateContactQualityScore(company: any): number {
  let score = 0;
  if (company.contact_email) score += 0.4;
  if (company.contact_first_name || company.contact_person) score += 0.2;
  if (company.contact_title) score += 0.2;
  if (company.contact_phone) score += 0.2;
  return score;
}

/**
 * NEW: Data completeness from stored enrichment score
 */
function calculateCompletenessScore(company: any): number {
  const score = company.data_completeness_score;
  if (score == null) return 0.3;
  // Stored as 0-1 from enrichment service
  return Math.min(1.0, typeof score === 'number' ? score : 0.3);
}

// ============================================
// HELPERS
// ============================================

function parseEmployeeCount(str: string): number {
  if (!str) return 0;
  const match = str.replace(/,/g, '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function getSizeCategory(count: number): string {
  if (count < 100) return 'small';
  if (count < 1000) return 'medium';
  return 'large';
}

function calculateCompositeScore(scores: CompanyScores): number {
  return (
    scores.semantic * WEIGHTS.semantic +
    scores.hiring * WEIGHTS.hiring +
    scores.buyingIntent * WEIGHTS.buyingIntent +
    scores.location * WEIGHTS.location +
    scores.techOverlap * WEIGHTS.techOverlap +
    scores.size * WEIGHTS.size +
    scores.completeness * WEIGHTS.completeness +
    scores.diversity * WEIGHTS.diversity +
    scores.contactQuality * WEIGHTS.contactQuality
  );
}

function generateSelectionReason(company: any, scores: CompanyScores, rank: number): string {
  const reasons: string[] = [];

  if (scores.semantic >= 0.7) reasons.push('Strong skill alignment');
  else if (scores.semantic >= 0.5) reasons.push('Good skill fit');

  const jobs = company.job_postings || [];
  const jobCount = Array.isArray(jobs) ? jobs.length : 0;
  if (scores.hiring >= 0.8) reasons.push(`Actively hiring (${jobCount} openings)`);
  else if (scores.hiring >= 0.4) reasons.push('Some open positions');

  if (scores.buyingIntent >= 0.7) reasons.push('High buying intent signals');
  if (scores.techOverlap >= 0.5) reasons.push('Strong tech stack alignment');
  if (scores.location >= 0.8) reasons.push('Close to campus');
  if (scores.size >= 0.8) reasons.push('Ideal company size');
  if (scores.contactQuality >= 0.6) reasons.push('Verified decision-maker contact');
  if (scores.diversity >= 0.8) reasons.push('Adds industry diversity');

  if (company.validation_reason) {
    reasons.push(company.validation_reason);
  }

  return reasons.length > 0
    ? reasons.join('. ')
    : `Rank #${rank} based on overall fit`;
}

// ============================================
// DIVERSITY CONSTRAINTS
// ============================================

function applyDiversityConstraints(companies: RankedCompany[], maxResults: number): RankedCompany[] {
  const selected: RankedCompany[] = [];
  const selectedIndustries = new Map<string, number>();

  for (const company of companies) {
    if (selected.length >= maxResults) break;

    const industry = (company.company.sector || 'unknown').toLowerCase();

    if (selected.length < 2) {
      selected.push(company);
      selectedIndustries.set(industry, (selectedIndustries.get(industry) || 0) + 1);
      continue;
    }

    const currentIndustryCount = selectedIndustries.get(industry) || 0;
    const maxFromOneIndustry = Math.ceil(maxResults * 0.4);

    if (currentIndustryCount >= maxFromOneIndustry) continue;

    selected.push(company);
    selectedIndustries.set(industry, currentIndustryCount + 1);
  }

  for (const company of companies) {
    if (selected.length >= maxResults) break;
    if (!selected.includes(company)) {
      selected.push(company);
    }
  }

  return selected.slice(0, maxResults);
}

// ============================================
// MAIN EXPORT
// ============================================

export function rankAndSelectCompanies(
  companies: any[],
  targetLocation: string,
  maxResults: number = 10,
  courseSkills: string[] = []
): RankingOutput {
  console.log(`\n========================================`);
  console.log(`PHASE: RANKING & SELECTION (v2 — 9 factors)`);
  console.log(`========================================`);
  console.log(`Companies to rank: ${companies.length}`);
  console.log(`Max results: ${maxResults}`);
  console.log(`Course skills for matching: ${courseSkills.length}`);

  const selectedIndustries = new Set<string>();

  const rankedCompanies: RankedCompany[] = companies.map((company) => {
    const scores: CompanyScores = {
      semantic: calculateSemanticScore(company),
      hiring: calculateHiringScore(company, courseSkills),
      location: calculateLocationScore(company, targetLocation),
      size: calculateSizeScore(company),
      diversity: calculateDiversityScore(company, selectedIndustries),
      buyingIntent: calculateBuyingIntentScore(company),
      techOverlap: calculateTechOverlapScore(company, courseSkills),
      contactQuality: calculateContactQualityScore(company),
      completeness: calculateCompletenessScore(company),
      composite: 0,
    };

    scores.composite = calculateCompositeScore(scores);

    const industry = (company.sector || 'unknown').toLowerCase();
    selectedIndustries.add(industry);

    return { rank: 0, company, scores, selectionReason: '' };
  });

  rankedCompanies.sort((a, b) => b.scores.composite - a.scores.composite);

  const selected = applyDiversityConstraints(rankedCompanies, maxResults);

  selected.forEach((company, index) => {
    company.rank = index + 1;
    company.selectionReason = generateSelectionReason(company.company, company.scores, index + 1);
  });

  const selectedSet = new Set(selected.map(s => s.company.id || s.company.name));
  const alternates = rankedCompanies
    .filter(c => !selectedSet.has(c.company.id || c.company.name))
    .slice(0, 4)
    .map((company, index) => ({
      ...company,
      rank: maxResults + index + 1,
      selectionReason: 'Alternate candidate',
    }));

  const industriesCovered = [...new Set(selected.map(c => c.company.sector || 'Unknown'))];
  const sizesIncluded = [...new Set(selected.map(c => {
    const count = parseEmployeeCount(c.company.employee_count || c.company.size || '');
    return getSizeCategory(count);
  }))];
  const avgSemanticScore = selected.length > 0
    ? selected.reduce((sum, c) => sum + c.scores.semantic, 0) / selected.length
    : 0;
  const allHaveActiveHiring = selected.every(c => c.scores.hiring > 0);

  // Log results with new factors
  console.log(`\nRanking Results:`);
  selected.forEach(c => {
    console.log(`  ${c.rank}. ${c.company.name}`);
    console.log(`     Composite: ${(c.scores.composite * 100).toFixed(0)}%`);
    console.log(`     Semantic: ${(c.scores.semantic * 100).toFixed(0)}% | Hiring: ${(c.scores.hiring * 100).toFixed(0)}% | Intent: ${(c.scores.buyingIntent * 100).toFixed(0)}%`);
    console.log(`     Tech: ${(c.scores.techOverlap * 100).toFixed(0)}% | Location: ${(c.scores.location * 100).toFixed(0)}% | Contact: ${(c.scores.contactQuality * 100).toFixed(0)}%`);
    console.log(`     Industry: ${c.company.sector || 'Unknown'}`);
  });

  console.log(`\nSelection Summary:`);
  console.log(`  Selected: ${selected.length} | Alternates: ${alternates.length}`);
  console.log(`  Industries: ${industriesCovered.length} | Sizes: ${sizesIncluded.join(', ')}`);
  console.log(`  All hiring: ${allHaveActiveHiring}`);

  return {
    selected,
    alternates,
    selectionSummary: { avgSemanticScore, industriesCovered, sizesIncluded, allHaveActiveHiring },
  };
}
