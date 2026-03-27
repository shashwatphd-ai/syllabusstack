/**
 * Signal 1: Job-Skills Matching
 * Keyword-based matching between company job postings and syllabus skills.
 * Falls back to technology alignment when no jobs available.
 */

import type { SignalResult, SignalProvider, SignalContext, SignalName, JobPosting } from '../signal-types.ts';
import { generateBatchEmbeddings, cosineSimilarity } from '../../embedding-client.ts';

const MAX_JOBS = 15;
const MAX_SKILLS = 20;

export const JobSkillsSignal: SignalProvider = {
  name: 'job_skills_match' as SignalName,
  weight: 0.35,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company, syllabusSkills, jobPostings } = context;
    console.log(`  📊 [Signal 1] Job-skills match for ${company.name}`);

    const jobs = extractJobPostings(jobPostings, company);

    if (jobs.length === 0) {
      // Fallback: technology alignment + baseline
      const { score, matched } = technologyFallback(company, syllabusSkills);
      const baselineScore = (company.description || company.name) ? 15 : 0;
      const capped = Math.max(baselineScore, Math.min(score, 40));
      return {
        score: capped, confidence: score > 0 ? 0.3 : 0.15,
        signals: score > 0
          ? [`Tech alignment fallback: ${matched.length} skills matched`, `Capped at 40% without job evidence`]
          : [`Baseline score (${baselineScore}) — company exists but no job/tech data`],
        rawData: { fallbackMethod: 'technology_alignment', matchedTech: matched },
      };
    }

    if (syllabusSkills.length === 0) {
      return { score: 10, confidence: 0.1, signals: ['No syllabus skills extracted — baseline score assigned'] };
    }

    // Try embedding-based matching first
    const embeddingResult = await embeddingMatch(jobs.slice(0, MAX_JOBS), syllabusSkills.slice(0, MAX_SKILLS));
    if (embeddingResult) {
      return embeddingResult;
    }

    // Fall back to keyword matching, capped at 70
    const result = calculateKeywordMatch(jobs.slice(0, MAX_JOBS), syllabusSkills.slice(0, MAX_SKILLS));
    result.score = Math.min(result.score, 70);
    result.signals.push('Keyword-only match (capped at 70%)');
    return result;
  },
};

async function embeddingMatch(jobs: JobPosting[], skills: string[]): Promise<SignalResult | null> {
  try {
    const jobTexts = jobs.map(j => `${j.title} ${j.description || ''}`);
    const skillsText = skills.join(', ');
    const embeddings = await generateBatchEmbeddings([skillsText, ...jobTexts]);

    const skillsEmbedding = embeddings[0];
    const similarities: number[] = [];
    const matchedJobIndices: number[] = [];
    const matchedSkillsSet = new Set<string>();

    for (let i = 1; i < embeddings.length; i++) {
      const sim = cosineSimilarity(skillsEmbedding, embeddings[i]);
      similarities.push(sim);
      if (sim >= 0.45) {
        matchedJobIndices.push(i - 1);
        // Attribute matched skills by checking which skills appear in this job text
        const jobText = jobTexts[i - 1].toLowerCase();
        for (const skill of skills) {
          if (jobText.includes(skill.toLowerCase())) {
            matchedSkillsSet.add(skill);
          }
        }
      }
    }

    const matchedSimilarities = similarities.filter(s => s >= 0.45);
    if (matchedSimilarities.length === 0) {
      return null;
    }

    const avg_similarity = matchedSimilarities.reduce((a, b) => a + b, 0) / matchedSimilarities.length;
    const skill_coverage = matchedSkillsSet.size / skills.length;
    const job_coverage = matchedJobIndices.length / jobs.length;

    const score = Math.round(
      avg_similarity * 100 * 0.50 +
      skill_coverage * 100 * 0.30 +
      job_coverage * 100 * 0.20
    );

    const signals: string[] = [
      `Embedding match: ${matchedJobIndices.length}/${jobs.length} jobs above threshold`,
      `Avg similarity: ${(avg_similarity * 100).toFixed(1)}%`,
      `${Math.round(skill_coverage * 100)}% skill coverage, ${Math.round(job_coverage * 100)}% job coverage`,
    ];

    return {
      score: Math.min(score, 100),
      confidence: 0.8,
      signals,
      rawData: { method: 'embedding', avg_similarity, skill_coverage, job_coverage, matchedJobs: matchedJobIndices.length },
    };
  } catch (error) {
    console.warn(`  ⚠️ [Signal 1] Embedding match failed, falling back to keyword: ${error}`);
    return null;
  }
}

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
