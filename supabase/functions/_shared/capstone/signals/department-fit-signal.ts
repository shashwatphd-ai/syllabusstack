/**
 * Signal 3: Department Fit
 * Uses departmental_head_count (from Apollo enrichment) + technology alignment
 * to determine if the company has a relevant department for the course domain.
 */

import type { SignalResult, SignalProvider, SignalContext, SignalName } from '../signal-types.ts';

const DOMAIN_TO_DEPT: Record<string, string[]> = {
  finance: ['finance', 'accounting'],
  engineering: ['engineering', 'product_management', 'design'],
  marketing: ['marketing', 'media_and_communication'],
  operations: ['operations', 'support'],
  sales: ['sales', 'business_development'],
  hr: ['human_resources', 'consulting'],
  data: ['engineering', 'product_management', 'information_technology'],
  it: ['engineering', 'information_technology'],
  science: ['engineering', 'operations'],
  business: ['business_development', 'operations', 'finance'],
  unknown: ['engineering'],
};

export const DepartmentFitSignal: SignalProvider = {
  name: 'department_fit' as SignalName,
  weight: 0.20,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company, syllabusDomain, syllabusSkills } = context;
    console.log(`  🏢 [Signal 3] Department fit for ${company.name}`);

    const deptCounts = parseDeptCounts(company.departmental_head_count);
    const technologies = parseTechnologies(company.technologies_used || company.technologies);

    if (Object.keys(deptCounts).length === 0 && technologies.length === 0) {
      return { score: 30, confidence: 0.2, signals: ['No department or tech data available'] };
    }

    // Department growth score
    const relevantDepts = DOMAIN_TO_DEPT[syllabusDomain.toLowerCase()] || DOMAIN_TO_DEPT.unknown;
    let relevantCount = 0;
    let totalCount = 0;
    for (const [dept, count] of Object.entries(deptCounts)) {
      totalCount += count;
      if (relevantDepts.some(rd => dept.toLowerCase().includes(rd))) {
        relevantCount += count;
      }
    }

    const capacityScore = totalCount > 0 ? Math.min(1, relevantCount / 50) : 0.3;
    const focusScore = totalCount > 0 ? relevantCount / totalCount : 0.3;
    const deptScore = capacityScore * 0.7 + focusScore * 0.3;

    // Funding recency score
    let fundingScore = 0.3; // baseline
    const fundingStage = (company.funding_stage || '').toLowerCase();
    if (fundingStage) {
      // Recent funding stages get higher scores
      if (fundingStage.includes('series c') || fundingStage.includes('series d') || fundingStage.includes('ipo')) {
        fundingScore = 1.0;
      } else if (fundingStage.includes('series b')) {
        fundingScore = 0.85;
      } else if (fundingStage.includes('series a')) {
        fundingScore = 0.7;
      } else if (fundingStage.includes('seed') || fundingStage.includes('angel')) {
        fundingScore = 0.55;
      } else if (fundingStage.includes('private equity') || fundingStage.includes('acquired')) {
        fundingScore = 0.65;
      }
    }

    // Technology category matching for partial credit
    const TECH_CATEGORIES: Record<string, string[]> = {
      'cloud': ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'cloudformation'],
      'data': ['sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch'],
      'ml': ['tensorflow', 'pytorch', 'scikit', 'pandas', 'numpy', 'jupyter'],
      'web': ['react', 'angular', 'vue', 'next', 'node', 'express', 'django', 'flask'],
      'devops': ['jenkins', 'github actions', 'gitlab', 'ci/cd', 'ansible', 'puppet'],
      'mobile': ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
    };

    // Technology match with category-based partial credit
    let techMatchScore = 0;
    for (const skill of syllabusSkills) {
      const lower = skill.toLowerCase();
      // Direct match = 1.0 credit
      if (technologies.some(t => t.includes(lower) || lower.includes(t))) {
        techMatchScore += 1.0;
      } else {
        // Category match = 0.5 credit
        let categoryMatched = false;
        for (const [_category, members] of Object.entries(TECH_CATEGORIES)) {
          const skillInCategory = members.some(m => lower.includes(m) || m.includes(lower));
          if (skillInCategory) {
            const companyInCategory = technologies.some(t => members.some(m => t.includes(m) || m.includes(t)));
            if (companyInCategory) {
              techMatchScore += 0.5;
              categoryMatched = true;
              break;
            }
          }
        }
      }
    }
    const techScore = syllabusSkills.length > 0
      ? Math.min(1, techMatchScore / Math.min(5, syllabusSkills.length))
      : 0.3;

    // Combined: dept 40%, funding 35%, tech 25%
    const combined = deptScore * 0.40 + fundingScore * 0.35 + techScore * 0.25;
    const score = Math.round(combined * 100);

    const signals: string[] = [];
    if (relevantCount > 50) signals.push(`Large ${syllabusDomain} team (${relevantCount}+ employees)`);
    else if (relevantCount > 20) signals.push(`Growing ${syllabusDomain} team (${relevantCount})`);
    else if (relevantCount > 0) signals.push(`${syllabusDomain} team present (${relevantCount})`);
    if (techMatchScore > 0) signals.push(`${Math.round(techMatchScore)} technology overlaps with course skills`);
    if (fundingStage) signals.push(`Funding stage: ${company.funding_stage}`);
    if (fundingScore >= 0.85) signals.push('Strong funding signal');
    else if (fundingScore >= 0.55) signals.push('Active funding signal');
    if (signals.length === 0) signals.push('Limited department data');

    const confidence = (Object.keys(deptCounts).length > 0 ? 0.4 : 0) + (technologies.length > 0 ? 0.3 : 0) + 0.2;
    console.log(`     ✅ Score: ${score}/100`);

    return { score, confidence: Math.min(1, confidence), signals, rawData: { deptScore, fundingScore, techScore, relevantCount } };
  },
};

function parseDeptCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return obj as Record<string, number>;
  } catch { return {}; }
}

function parseTechnologies(raw: unknown): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter((t: any): t is string => typeof t === 'string').map(t => t.toLowerCase());
}

export default DepartmentFitSignal;
