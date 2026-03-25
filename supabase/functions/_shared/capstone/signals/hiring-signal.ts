/**
 * Signal 5: Active Hiring Signal
 * Ported from EduThree — scores companies based on active job postings
 *
 * Scoring: active jobs (30pts) + job count bonus (10pts) + title relevance (20pts) + recent postings (10pts)
 * Total: 0-70 raw, normalized to 0-100
 */

import {
  SignalResult,
  SignalProvider,
  SignalContext,
  JobPosting
} from '../signal-types.ts';

const POINTS_HAS_ACTIVE_JOBS = 30;
const POINTS_JOB_COUNT_BONUS = 10;
const POINTS_TITLE_RELEVANCE = 20;
const POINTS_RECENT_POSTINGS = 10;
const RECENT_JOB_DAYS = 30;
const MAX_JOBS_TO_ANALYZE = 25;

export const HiringSignal: SignalProvider = {
  name: 'active_hiring' as any,
  weight: 0.15,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company, syllabusSkills, syllabusDomain, jobPostings } = context;

    console.log(`  [Hiring Signal] Calculating for ${company.name}`);

    const jobs = getJobPostings(jobPostings, company);

    if (jobs.length === 0) {
      return {
        score: 0,
        confidence: 0.5,
        signals: ['No active job postings found'],
        rawData: { hasActiveJobs: false, jobCount: 0, relevantJobCount: 0, recentJobCount: 0, sampleRelevantJobs: [], hiringScore: 0 }
      };
    }

    const limitedJobs = jobs.slice(0, MAX_JOBS_TO_ANALYZE);
    const hasActiveJobsPoints = POINTS_HAS_ACTIVE_JOBS;
    const jobCountPoints = calculateJobCountBonus(limitedJobs.length);
    const { relevancePoints, relevantJobs, sampleRelevantJobs } = calculateTitleRelevance(limitedJobs, syllabusSkills, syllabusDomain);
    const { recentPoints, recentJobCount } = calculateRecentPostingsBonus(limitedJobs);

    const rawScore = hasActiveJobsPoints + jobCountPoints + relevancePoints + recentPoints;
    const normalizedScore = Math.round((rawScore / 70) * 100);
    const confidence = calculateConfidence(limitedJobs.length, relevantJobs, recentJobCount);
    const signals = generateSignalDescriptions(limitedJobs.length, relevantJobs, recentJobCount, sampleRelevantJobs);

    console.log(`     Hiring Score: ${normalizedScore}/100 (${limitedJobs.length} jobs, ${relevantJobs} relevant, ${recentJobCount} recent)`);

    return {
      score: normalizedScore,
      confidence,
      signals,
      rawData: {
        hasActiveJobs: true, jobCount: limitedJobs.length, relevantJobCount: relevantJobs, recentJobCount, sampleRelevantJobs, hiringScore: normalizedScore,
        breakdown: { hasActiveJobsPoints, jobCountPoints, relevancePoints, recentPoints, rawTotal: rawScore, normalized: normalizedScore }
      }
    };
  }
};

function calculateJobCountBonus(jobCount: number): number {
  if (jobCount <= 0) return 0;
  if (jobCount === 1) return 2;
  if (jobCount <= 3) return 4;
  if (jobCount <= 5) return 6;
  if (jobCount <= 10) return 8;
  return POINTS_JOB_COUNT_BONUS;
}

function calculateTitleRelevance(jobs: JobPosting[], syllabusSkills: string[], syllabusDomain: string): { relevancePoints: number; relevantJobs: number; sampleRelevantJobs: string[] } {
  if (jobs.length === 0 || syllabusSkills.length === 0) return { relevancePoints: 0, relevantJobs: 0, sampleRelevantJobs: [] };

  const normalizedSkills = syllabusSkills.map(s => s.toLowerCase().trim());
  const domainKeywords = getDomainKeywords(syllabusDomain);
  let relevantJobs = 0;
  const sampleRelevantJobs: string[] = [];

  for (const job of jobs) {
    const titleLower = (job.title || '').toLowerCase();
    const descLower = (job.description || '').toLowerCase();
    const combinedText = `${titleLower} ${descLower}`;

    const hasSkillMatch = normalizedSkills.some(skill =>
      combinedText.includes(skill) || skill.split(' ').some(word => word.length > 3 && combinedText.includes(word))
    );
    const hasDomainMatch = domainKeywords.some(keyword => combinedText.includes(keyword));

    if (hasSkillMatch || hasDomainMatch) {
      relevantJobs++;
      if (sampleRelevantJobs.length < 5) sampleRelevantJobs.push(job.title);
    }
  }

  const relevanceRatio = relevantJobs / jobs.length;
  return { relevancePoints: Math.round(relevanceRatio * POINTS_TITLE_RELEVANCE), relevantJobs, sampleRelevantJobs };
}

function getDomainKeywords(domain: string): string[] {
  const domainLower = (domain || '').toLowerCase();
  const domainKeywordMap: Record<string, string[]> = {
    'finance': ['financial', 'analyst', 'investment', 'portfolio', 'accounting', 'banking', 'risk', 'trading', 'cfa', 'cpa'],
    'engineering': ['engineer', 'developer', 'software', 'technical', 'architect', 'devops', 'data', 'cloud', 'backend', 'frontend'],
    'marketing': ['marketing', 'digital', 'brand', 'content', 'social', 'seo', 'growth', 'campaign', 'advertising'],
    'operations': ['operations', 'supply chain', 'logistics', 'process', 'lean', 'project manager', 'procurement'],
    'healthcare': ['healthcare', 'medical', 'clinical', 'patient', 'nursing', 'pharma', 'biomedical'],
    'hr': ['human resources', 'recruiter', 'talent', 'hr manager', 'people operations', 'workforce'],
    'sales': ['sales', 'account executive', 'business development', 'customer success', 'client'],
    'design': ['designer', 'ux', 'ui', 'product design', 'creative', 'visual', 'graphic']
  };

  for (const [key, keywords] of Object.entries(domainKeywordMap)) {
    if (domainLower.includes(key)) return keywords;
  }
  return ['analyst', 'associate', 'coordinator', 'specialist', 'manager'];
}

function calculateRecentPostingsBonus(jobs: JobPosting[]): { recentPoints: number; recentJobCount: number } {
  const recentThreshold = Date.now() - (RECENT_JOB_DAYS * 24 * 60 * 60 * 1000);
  let recentJobCount = 0;

  for (const job of jobs) {
    if (job.posted_at) {
      try {
        if (new Date(job.posted_at).getTime() >= recentThreshold) recentJobCount++;
      } catch { /* skip invalid dates */ }
    }
  }

  if (recentJobCount === 0) return { recentPoints: 0, recentJobCount: 0 };
  return { recentPoints: Math.round((recentJobCount / jobs.length) * POINTS_RECENT_POSTINGS), recentJobCount };
}

function getJobPostings(contextJobs: JobPosting[] | undefined, company: SignalContext['company']): JobPosting[] {
  if (contextJobs && contextJobs.length > 0) return contextJobs;
  if (company.job_postings) {
    try {
      const parsed = typeof company.job_postings === 'string' ? JSON.parse(company.job_postings) : company.job_postings;
      if (Array.isArray(parsed)) {
        return parsed.map((j: any) => ({ id: j.id, title: j.title || 'Unknown Role', url: j.url, description: j.description, posted_at: j.posted_at }));
      }
    } catch { /* ignore parse errors */ }
  }
  return [];
}

function calculateConfidence(jobCount: number, relevantJobs: number, recentJobCount: number): number {
  let dataScore = Math.min(1, jobCount / 10);
  if (relevantJobs > 0) dataScore += 0.2;
  if (recentJobCount > 0) dataScore += 0.1;
  return Math.min(1, dataScore);
}

function generateSignalDescriptions(jobCount: number, relevantJobs: number, recentJobCount: number, sampleJobs: string[]): string[] {
  const signals: string[] = [];
  signals.push(`${jobCount} active job posting${jobCount !== 1 ? 's' : ''}`);
  if (relevantJobs > 0) {
    signals.push(`${relevantJobs} job${relevantJobs !== 1 ? 's' : ''} relevant to course skills`);
    if (sampleJobs.length > 0) signals.push(`Relevant roles: ${sampleJobs.slice(0, 3).join(', ')}`);
  }
  if (recentJobCount > 0) signals.push(`${recentJobCount} job${recentJobCount !== 1 ? 's' : ''} posted in last 30 days`);
  return signals;
}

export function calculateHiringScore(jobPostings: any[], syllabusSkills: string[] = [], syllabusDomain: string = ''): number {
  if (!jobPostings || jobPostings.length === 0) return 0;
  const jobs = jobPostings.slice(0, MAX_JOBS_TO_ANALYZE).map(j => ({ id: j.id, title: j.title || 'Unknown', url: j.url, description: j.description || j.short_description, posted_at: j.posted_at }));
  const rawScore = POINTS_HAS_ACTIVE_JOBS + calculateJobCountBonus(jobs.length) + calculateTitleRelevance(jobs, syllabusSkills, syllabusDomain).relevancePoints + calculateRecentPostingsBonus(jobs).recentPoints;
  return Math.round((rawScore / 70) * 100);
}

export function hasActiveJobs(jobPostings: any[]): boolean {
  return Array.isArray(jobPostings) && jobPostings.length > 0;
}

/**
 * Get hiring stats for a batch of companies
 */
export function getHiringStats(companies: Array<{ jobPostings?: any[] }>): {
  companiesWithJobs: number;
  companiesWithoutJobs: number;
  totalJobPostings: number;
  averageJobsPerCompany: number;
} {
  let companiesWithJobs = 0;
  let companiesWithoutJobs = 0;
  let totalJobPostings = 0;

  for (const company of companies) {
    const jobs = company.jobPostings || [];
    if (Array.isArray(jobs) && jobs.length > 0) {
      companiesWithJobs++;
      totalJobPostings += jobs.length;
    } else {
      companiesWithoutJobs++;
    }
  }

  return {
    companiesWithJobs,
    companiesWithoutJobs,
    totalJobPostings,
    averageJobsPerCompany: companiesWithJobs > 0
      ? Math.round(totalJobPostings / companiesWithJobs * 10) / 10
      : 0
  };
}

export default HiringSignal;
