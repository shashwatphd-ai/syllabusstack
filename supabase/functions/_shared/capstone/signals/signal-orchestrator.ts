/**
 * Signal Orchestrator — coordinates all 4 signal providers
 * and calculates composite scores.
 * Ported from EduThree1.
 */

import type {
  SignalResult, SignalContext, SignalProvider,
  CompositeScore, SignalScores, CompanyForSignal,
  SIGNAL_WEIGHTS as WeightsType, StorableSignalData, JobPosting,
} from '../signal-types.ts';
import { SIGNAL_WEIGHTS } from '../signal-types.ts';

import { JobSkillsSignal } from './job-skills-signal.ts';
import { MarketIntelSignal } from './market-intel-signal.ts';
import { DepartmentFitSignal } from './department-fit-signal.ts';
import { ContactQualitySignal } from './contact-quality-signal.ts';

const SIGNAL_PROVIDERS: SignalProvider[] = [
  JobSkillsSignal,
  MarketIntelSignal,
  DepartmentFitSignal,
  ContactQualitySignal,
];

const SIGNAL_TIMEOUT_MS = 30000;

// =============================================================================
// MAIN
// =============================================================================

export async function calculateCompanySignals(
  company: CompanyForSignal,
  syllabusSkills: string[],
  syllabusDomain: string,
  apolloApiKey?: string
): Promise<CompositeScore> {
  console.log(`\n🎯 [Orchestrator] Signals for: ${company.name}`);

  const jobPostings = extractJobPostings(company.job_postings);
  const context: SignalContext = { company, syllabusSkills, syllabusDomain, jobPostings, apolloApiKey };

  const signalResults = await executeSignals(context);
  return buildCompositeScore(signalResults, company.name);
}

export async function calculateBatchSignals(
  companies: CompanyForSignal[],
  syllabusSkills: string[],
  syllabusDomain: string,
  apolloApiKey?: string
): Promise<Map<string, CompositeScore>> {
  console.log(`\n🚀 [Orchestrator] Batch processing ${companies.length} companies`);
  const results = new Map<string, CompositeScore>();
  const BATCH = 5;

  for (let i = 0; i < companies.length; i += BATCH) {
    const batch = companies.slice(i, i + BATCH);
    const promises = batch.map(c =>
      calculateCompanySignals(c, syllabusSkills, syllabusDomain, apolloApiKey)
        .then(score => ({ id: c.id, score }))
        .catch(err => ({ id: c.id, score: createErrorScore(c.name, err) }))
    );
    const batchResults = await Promise.all(promises);
    for (const { id, score } of batchResults) results.set(id, score);

    if (i + BATCH < companies.length) await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

// =============================================================================
// EXECUTION
// =============================================================================

async function executeSignals(context: SignalContext): Promise<Map<string, SignalResult>> {
  const results = new Map<string, SignalResult>();

  const promises = SIGNAL_PROVIDERS.map(async provider => {
    try {
      return { name: provider.name, result: await provider.calculate(context) };
    } catch (error) {
      return {
        name: provider.name,
        result: { score: 0, confidence: 0, signals: ['Failed'], error: String(error) } as SignalResult,
      };
    }
  });

  try {
    const all = await Promise.race([
      Promise.all(promises),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), SIGNAL_TIMEOUT_MS)),
    ]) as Array<{ name: string; result: SignalResult }>;

    for (const { name, result } of all) results.set(name, result);
  } catch {
    console.warn('  ⚠️ Signal timeout');
  }

  return results;
}

// =============================================================================
// SCORING
// =============================================================================

function buildCompositeScore(results: Map<string, SignalResult>, name: string): CompositeScore {
  const js = results.get('job_skills_match');
  const mi = results.get('market_intelligence');
  const df = results.get('department_fit');
  const cq = results.get('contact_quality');

  const components: SignalScores = {
    jobSkillsMatch: js?.score ?? 0,
    marketIntelligence: mi?.score ?? 0,
    departmentFit: df?.score ?? 0,
    contactQuality: cq?.score ?? 0,
  };

  const overall = Math.round(
    components.jobSkillsMatch * SIGNAL_WEIGHTS.job_skills_match +
    components.marketIntelligence * SIGNAL_WEIGHTS.market_intelligence +
    components.departmentFit * SIGNAL_WEIGHTS.department_fit +
    components.contactQuality * SIGNAL_WEIGHTS.contact_quality
  );

  const avgConf = [js, mi, df, cq].reduce((s, r) => s + (r?.confidence ?? 0), 0) / 4;
  const confidence = avgConf > 0.7 ? 'high' : avgConf > 0.4 ? 'medium' : 'low';

  const signalsDetected = {
    hasActiveJobPostings: (js?.score ?? 0) > 30,
    hasFundingNews: (mi?.rawData as any)?.hasNewsData === true || (mi?.score ?? 0) > 50,
    hasHiringNews: (mi?.score ?? 0) > 40,
    hasDepartmentGrowth: (df?.score ?? 0) > 50,
    hasTechnologyMatch: (df?.score ?? 0) > 40,
    hasDecisionMakers: (cq?.score ?? 0) > 40,
  };

  const allSignals: string[] = [];
  for (const r of results.values()) allSignals.push(...(r.signals || []));

  const errors: string[] = [];
  for (const r of results.values()) if (r.error) errors.push(r.error);

  const lines = [
    `Signal Analysis for ${name}:`,
    `• Skills: ${components.jobSkillsMatch}/100 (35%)`,
    `• Market: ${components.marketIntelligence}/100 (25%)`,
    `• Dept Fit: ${components.departmentFit}/100 (20%)`,
    `• Contact: ${components.contactQuality}/100 (20%)`,
  ];

  return { overall, confidence, components, signalsDetected, breakdown: lines.join('\n'), errors };
}

function createErrorScore(name: string, error: unknown): CompositeScore {
  return {
    overall: 0, confidence: 'low',
    components: { jobSkillsMatch: 0, marketIntelligence: 0, departmentFit: 0, contactQuality: 0 },
    signalsDetected: { hasActiveJobPostings: false, hasFundingNews: false, hasHiringNews: false, hasDepartmentGrowth: false, hasTechnologyMatch: false, hasDecisionMakers: false },
    breakdown: `Failed for ${name}`,
    errors: [error instanceof Error ? error.message : String(error)],
  };
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

export function toStorableSignalData(composite: CompositeScore): StorableSignalData {
  return {
    skill_match_score: composite.components.jobSkillsMatch,
    market_signal_score: composite.components.marketIntelligence,
    department_fit_score: composite.components.departmentFit,
    contact_quality_score: composite.components.contactQuality,
    composite_signal_score: composite.overall,
    signal_confidence: composite.confidence,
    signal_data: composite,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function extractJobPostings(raw: unknown): JobPosting[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((j: any) => ({ id: j.id, title: j.title || 'Unknown', description: j.description }));
  } catch { return []; }
}

export { SIGNAL_PROVIDERS };
