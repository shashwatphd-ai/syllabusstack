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
  weight: 0.25,

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

    // Technology match
    let techMatchCount = 0;
    for (const skill of syllabusSkills) {
      const lower = skill.toLowerCase();
      if (technologies.some(t => t.includes(lower) || lower.includes(t))) {
        techMatchCount++;
      }
    }
    const techScore = syllabusSkills.length > 0
      ? Math.min(1, techMatchCount / Math.min(5, syllabusSkills.length))
      : 0.3;

    // Combined: dept 50%, tech 50%
    const combined = deptScore * 0.5 + techScore * 0.5;
    const score = Math.round(combined * 100);

    const signals: string[] = [];
    if (relevantCount > 50) signals.push(`Large ${syllabusDomain} team (${relevantCount}+ employees)`);
    else if (relevantCount > 20) signals.push(`Growing ${syllabusDomain} team (${relevantCount})`);
    else if (relevantCount > 0) signals.push(`${syllabusDomain} team present (${relevantCount})`);
    if (techMatchCount > 0) signals.push(`${techMatchCount} technology overlaps with course skills`);
    if (signals.length === 0) signals.push('Limited department data');

    const confidence = (Object.keys(deptCounts).length > 0 ? 0.4 : 0) + (technologies.length > 0 ? 0.3 : 0) + 0.2;
    console.log(`     ✅ Score: ${score}/100`);

    return { score, confidence: Math.min(1, confidence), signals, rawData: { deptScore, techScore, relevantCount } };
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
