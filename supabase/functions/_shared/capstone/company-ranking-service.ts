/**
 * Company Ranking Service
 * Ported from EduThree1's company-ranking-service.ts (426 lines)
 *
 * PHASE 5 of the pipeline: Rank and select final companies.
 *
 * Multi-factor scoring:
 * - Semantic score (40%) - Validation confidence / skill overlap
 * - Hiring score (25%) - Active job postings
 * - Location score (15%) - Distance-based (simplified without geo data)
 * - Size score (10%) - Company size fit for capstone projects
 * - Diversity score (10%) - Industry variety bonus
 */

// Default scoring weights
const DEFAULT_WEIGHTS = {
  semantic: 0.40,
  hiring: 0.25,
  location: 0.15,
  size: 0.10,
  diversity: 0.10
};

export interface CompanyScores {
  semantic: number;
  hiring: number;
  location: number;
  size: number;
  diversity: number;
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

/**
 * Calculate semantic score from validation confidence and skill overlap
 */
function calculateSemanticScore(company: any): number {
  const validationConfidence = company.validation_confidence || 0.5;
  const skillsOverlap = company.skills_overlap || [];
  // Boost for more overlapping skills (max +0.2)
  const skillBonus = Math.min(0.2, skillsOverlap.length * 0.03);
  return Math.min(1.0, validationConfidence + skillBonus);
}

/**
 * Calculate hiring score based on active job postings
 */
function calculateHiringScore(company: any): number {
  const jobs = company.job_postings || [];
  const jobCount = Array.isArray(jobs) ? jobs.length : 0;

  if (jobCount === 0) return 0;
  if (jobCount >= 10) return 1.0;
  if (jobCount >= 5) return 0.8;
  if (jobCount >= 3) return 0.6;
  if (jobCount >= 1) return 0.4;

  return 0;
}

/**
 * Calculate location score
 * Without geo coordinates, uses heuristics from address data
 */
function calculateLocationScore(company: any, targetLocation: string): number {
  const companyAddress = (company.full_address || '').toLowerCase();
  const target = targetLocation.toLowerCase();

  if (!companyAddress || !target) return 0.5;

  // Extract city and state from target
  const targetParts = target.split(',').map((p: string) => p.trim());
  const targetCity = targetParts[0] || '';
  const targetState = targetParts[1] || '';

  // Same city = perfect score
  if (targetCity && companyAddress.includes(targetCity)) return 1.0;
  // Same state = good score
  if (targetState && companyAddress.includes(targetState)) return 0.7;
  // Same country = moderate
  if (companyAddress.includes('united states') || companyAddress.includes('usa')) return 0.4;

  return 0.3;
}

/**
 * Calculate size score — prefer 50-5000 employees for capstone projects
 */
function calculateSizeScore(company: any): number {
  const sizeStr = company.employee_count || company.size || '';
  const count = parseEmployeeCount(sizeStr);

  if (count === 0) return 0.5; // Unknown
  if (count >= 50 && count <= 5000) return 1.0;
  if (count >= 20 && count <= 10000) return 0.8;
  if (count >= 10) return 0.6;
  return 0.4; // Very small
}

function parseEmployeeCount(str: string): number {
  if (!str) return 0;
  // Extract first number from strings like "500 employees", "201-500", etc.
  const match = str.replace(/,/g, '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function getSizeCategory(count: number): string {
  if (count < 100) return 'small';
  if (count < 1000) return 'medium';
  return 'large';
}

/**
 * Calculate diversity bonus for industry variety
 */
function calculateDiversityScore(
  company: any,
  selectedIndustries: Set<string>
): number {
  const companyIndustry = (company.sector || company.industry || 'unknown').toLowerCase();

  if (!selectedIndustries.has(companyIndustry)) {
    // Bonus for adding a new industry
    const diversityNeed = Math.max(0, 4 - selectedIndustries.size);
    return 0.5 + (diversityNeed * 0.125); // Max 1.0
  }

  // Small penalty for duplicate industries
  return Math.max(0.3, 1.0 - selectedIndustries.size * 0.05);
}

/**
 * Calculate composite score from all factors
 */
function calculateCompositeScore(scores: CompanyScores): number {
  return (
    scores.semantic * DEFAULT_WEIGHTS.semantic +
    scores.hiring * DEFAULT_WEIGHTS.hiring +
    scores.location * DEFAULT_WEIGHTS.location +
    scores.size * DEFAULT_WEIGHTS.size +
    scores.diversity * DEFAULT_WEIGHTS.diversity
  );
}

/**
 * Generate selection reason text
 */
function generateSelectionReason(
  company: any,
  scores: CompanyScores,
  rank: number
): string {
  const reasons: string[] = [];

  if (scores.semantic >= 0.7) reasons.push('Strong skill alignment');
  else if (scores.semantic >= 0.5) reasons.push('Good skill fit');

  const jobs = company.job_postings || [];
  const jobCount = Array.isArray(jobs) ? jobs.length : 0;
  if (scores.hiring >= 0.8) reasons.push(`Actively hiring (${jobCount} openings)`);
  else if (scores.hiring >= 0.4) reasons.push('Some open positions');

  if (scores.location >= 0.8) reasons.push('Close to campus');
  if (scores.size >= 0.8) reasons.push('Ideal company size for capstone projects');
  if (scores.diversity >= 0.8) reasons.push('Adds industry diversity');

  if (company.validation_reason) {
    reasons.push(company.validation_reason);
  }

  return reasons.length > 0
    ? reasons.join('. ')
    : `Rank #${rank} based on overall fit`;
}

/**
 * Apply diversity constraints — max 40% from one industry
 */
function applyDiversityConstraints(
  companies: RankedCompany[],
  maxResults: number
): RankedCompany[] {
  const selected: RankedCompany[] = [];
  const selectedIndustries = new Map<string, number>();

  for (const company of companies) {
    if (selected.length >= maxResults) break;

    const industry = (company.company.sector || 'unknown').toLowerCase();

    // Always take top 2
    if (selected.length < 2) {
      selected.push(company);
      selectedIndustries.set(industry, (selectedIndustries.get(industry) || 0) + 1);
      continue;
    }

    // Check 40% industry cap
    const currentIndustryCount = selectedIndustries.get(industry) || 0;
    const maxFromOneIndustry = Math.ceil(maxResults * 0.4);

    if (currentIndustryCount >= maxFromOneIndustry) {
      continue; // Skip — too many from this industry
    }

    selected.push(company);
    selectedIndustries.set(industry, currentIndustryCount + 1);
  }

  // Fill remaining slots if diversity constraints left gaps
  for (const company of companies) {
    if (selected.length >= maxResults) break;
    if (!selected.includes(company)) {
      selected.push(company);
    }
  }

  return selected.slice(0, maxResults);
}

/**
 * MAIN EXPORT: Rank and select final companies
 */
export function rankAndSelectCompanies(
  companies: any[],
  targetLocation: string,
  maxResults: number = 10
): RankingOutput {
  console.log(`\n========================================`);
  console.log(`PHASE: RANKING & SELECTION`);
  console.log(`========================================`);
  console.log(`Companies to rank: ${companies.length}`);
  console.log(`Max results: ${maxResults}`);

  const selectedIndustries = new Set<string>();

  // Score all companies
  const rankedCompanies: RankedCompany[] = companies.map((company) => {
    const semanticScore = calculateSemanticScore(company);
    const hiringScore = calculateHiringScore(company);
    const locationScore = calculateLocationScore(company, targetLocation);
    const sizeScore = calculateSizeScore(company);
    const diversityScore = calculateDiversityScore(company, selectedIndustries);

    const scores: CompanyScores = {
      semantic: semanticScore,
      hiring: hiringScore,
      location: locationScore,
      size: sizeScore,
      diversity: diversityScore,
      composite: 0
    };

    scores.composite = calculateCompositeScore(scores);

    // Track industry
    const industry = (company.sector || 'unknown').toLowerCase();
    selectedIndustries.add(industry);

    return {
      rank: 0,
      company,
      scores,
      selectionReason: ''
    };
  });

  // Sort by composite score (highest first)
  rankedCompanies.sort((a, b) => b.scores.composite - a.scores.composite);

  // Apply diversity constraints and select top N
  const selected = applyDiversityConstraints(rankedCompanies, maxResults);

  // Update ranks and selection reasons
  selected.forEach((company, index) => {
    company.rank = index + 1;
    company.selectionReason = generateSelectionReason(
      company.company,
      company.scores,
      index + 1
    );
  });

  // Get alternates
  const selectedSet = new Set(selected.map(s => s.company.id || s.company.name));
  const alternates = rankedCompanies
    .filter(c => !selectedSet.has(c.company.id || c.company.name))
    .slice(0, 4)
    .map((company, index) => ({
      ...company,
      rank: maxResults + index + 1,
      selectionReason: 'Alternate candidate'
    }));

  // Summary
  const industriesCovered = [...new Set(selected.map(c =>
    c.company.sector || 'Unknown'
  ))];

  const sizesIncluded = [...new Set(selected.map(c => {
    const count = parseEmployeeCount(c.company.employee_count || c.company.size || '');
    return getSizeCategory(count);
  }))];

  const avgSemanticScore = selected.length > 0
    ? selected.reduce((sum, c) => sum + c.scores.semantic, 0) / selected.length
    : 0;

  const allHaveActiveHiring = selected.every(c => c.scores.hiring > 0);

  // Log results
  console.log(`\nRanking Results:`);
  selected.forEach(c => {
    console.log(`  ${c.rank}. ${c.company.name}`);
    console.log(`     Composite: ${(c.scores.composite * 100).toFixed(0)}%`);
    console.log(`     Semantic: ${(c.scores.semantic * 100).toFixed(0)}% | Hiring: ${(c.scores.hiring * 100).toFixed(0)}%`);
    console.log(`     Industry: ${c.company.sector || 'Unknown'}`);
  });

  console.log(`\nSelection Summary:`);
  console.log(`  Selected: ${selected.length} | Alternates: ${alternates.length}`);
  console.log(`  Industries: ${industriesCovered.length} | Sizes: ${sizesIncluded.join(', ')}`);
  console.log(`  All hiring: ${allHaveActiveHiring}`);

  return {
    selected,
    alternates,
    selectionSummary: {
      avgSemanticScore,
      industriesCovered,
      sizesIncluded,
      allHaveActiveHiring
    }
  };
}
