/**
 * Signal 1: Job-Skills Matching
 * Keyword-based matching between company job postings and syllabus skills.
 * Falls back to technology alignment when no jobs available.
 */

import type { SignalResult, SignalProvider, SignalContext, SignalName, JobPosting } from '../signal-types.ts';

const MAX_JOBS = 15;
const MAX_SKILLS = 20;

export const JobSkillsSignal: SignalProvider = {
  name: 'job_skills_match' as SignalName,
  weight: 0.25,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company, syllabusSkills, jobPostings } = context;
    console.log(`  📊 [Signal 1] Job-skills match for ${company.name}`);

    const jobs = extractJobPostings(jobPostings, company);

    if (jobs.length === 0) {
      // Fallback: technology alignment
      const { score, matched } = technologyFallback(company, syllabusSkills);
      const capped = Math.min(score, 40);
      return {
        score: capped, confidence: score > 0 ? 0.3 : 0,
        signals: score > 0
          ? [`Tech alignment fallback: ${matched.length} skills matched`, `Capped at 40% without job evidence`]
          : ['No job postings or technology data'],
        rawData: { fallbackMethod: 'technology_alignment', matchedTech: matched },
      };
    }

    if (syllabusSkills.length === 0) {
      return { score: 0, confidence: 0, signals: ['No syllabus skills to match'] };
    }

    return calculateKeywordMatch(jobs.slice(0, MAX_JOBS), syllabusSkills.slice(0, MAX_SKILLS));
  },
};

function calculateKeywordMatch(jobs: JobPosting[], skills: string[]): SignalResult {
  const skillTokens = new Map<string, Set<string>>();
  for (const skill of skills) {
    skillTokens.set(skill, tokenize(skill));
  }

  const matches: Array<{ job: string; skill: string; overlap: number }> = [];
  const matchedSkills = new Set<string>();

  for (const job of jobs) {
    const jobTokens = tokenize(`${job.title} ${job.description || ''}`);
    for (const [skill, sTokens] of skillTokens) {
      const overlap = calculateOverlap(jobTokens, sTokens);
      if (overlap >= 0.15) {
        matches.push({ job: job.title, skill, overlap });
        matchedSkills.add(skill);
      }
    }
  }

  matches.sort((a, b) => b.overlap - a.overlap);
  const avg = matches.length > 0 ? matches.reduce((s, m) => s + m.overlap, 0) / matches.length : 0;
  const coverage = matchedSkills.size / skills.length;
  const base = Math.round(avg * 40 + coverage * 40);
  const bonus = matches.length > 0 ? Math.min(20, matches.length * 5) : 0;
  const score = Math.min(base + bonus, 100);

  const signals: string[] = [];
  if (matches.length > 0) signals.push(`${matches.length} job-skill matches (top: "${matches[0].job}" ↔ "${matches[0].skill}")`);
  signals.push(`${Math.round(coverage * 100)}% skill coverage`);

  return { score, confidence: 0.6, signals, rawData: { method: 'keyword', matchCount: matches.length, coverage } };
}

function technologyFallback(company: any, skills: string[]): { score: number; matched: string[] } {
  const tech = company.technologies_used || company.technologies;
  if (!Array.isArray(tech) || tech.length === 0) return { score: 0, matched: [] };

  const lowerTech = tech.map((t: string) => t.toLowerCase());
  const matched: string[] = [];
  for (const skill of skills) {
    if (lowerTech.some((t: string) => t.includes(skill.toLowerCase()) || skill.toLowerCase().includes(t))) {
      matched.push(skill);
    }
  }
  return { score: Math.round((matched.length / skills.length) * 100), matched };
}

function extractJobPostings(contextJobs: JobPosting[] | undefined, company: any): JobPosting[] {
  if (contextJobs?.length) return contextJobs;
  const raw = company.job_postings;
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map((j: any) => ({ id: j.id, title: j.title || 'Unknown', description: j.description })) : [];
  } catch { return []; }
}

const STOP = new Set(['a','an','the','and','or','in','on','at','to','for','of','with','by','from','as','is','was','are','were','be','have','has','do','will','would','could','should','our','your','that','this']);

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t)));
}

function calculateOverlap(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  let i = 0;
  for (const t of set1) { if (set2.has(t)) i++; }
  return i / Math.min(set1.size, set2.size);
}

export default JobSkillsSignal;
