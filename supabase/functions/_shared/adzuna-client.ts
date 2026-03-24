/**
 * Adzuna API Client
 *
 * Provides job search and salary estimation for cross-validation
 * against Lightcast demand signals.
 *
 * Auth: API key + app_id.
 *
 * USAGE:
 *   import { searchJobs, getSalaryEstimate, isAdzunaConfigured } from '../_shared/adzuna-client.ts';
 *
 *   const jobs = await searchJobs({ what: 'Python Developer', where: 'New York' });
 *   const salary = await getSalaryEstimate('Python Developer', 'New York');
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AdzunaJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  created: string;
  redirectUrl: string;
  category: string;
}

export interface AdzunaSearchResult {
  count: number;
  jobs: AdzunaJob[];
  meanSalary: number | null;
}

export interface AdzunaSalaryEstimate {
  percentile25: number;
  median: number;
  percentile75: number;
  currency: string;
}

// ============================================================================
// API HELPERS
// ============================================================================

const BASE_URL = 'https://api.adzuna.com/v1/api';

function getCredentials(): { appId: string; apiKey: string } {
  const appId = Deno.env.get('ADZUNA_APP_ID');
  const apiKey = Deno.env.get('ADZUNA_API_KEY');

  if (!appId || !apiKey) {
    throw new Error('ADZUNA_APP_ID and ADZUNA_API_KEY must be set');
  }

  return { appId, apiKey };
}

async function adzunaFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const { appId, apiKey } = getCredentials();

  const queryParams = new URLSearchParams({
    app_id: appId,
    app_key: apiKey,
    content_type: 'application/json',
    ...params,
  });

  const url = `${BASE_URL}${path}?${queryParams.toString()}`;
  const response = await fetch(url);

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '10');
    console.warn(`Adzuna rate limited, retrying in ${retryAfter}s`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return adzunaFetch(path, params);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Adzuna API error (${response.status}) ${path}: ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// JOB SEARCH
// ============================================================================

/**
 * Search for jobs on Adzuna.
 * Country defaults to 'us'. Use ISO-2 codes.
 */
export async function searchJobs(params: {
  what: string;
  where?: string;
  country?: string;
  resultsPerPage?: number;
  page?: number;
}): Promise<AdzunaSearchResult> {
  const country = params.country || 'us';
  const queryParams: Record<string, string> = {
    what: params.what,
    results_per_page: String(params.resultsPerPage || 20),
    page: String(params.page || 1),
  };

  if (params.where) {
    queryParams.where = params.where;
  }

  const data = await adzunaFetch(`/jobs/${country}/search/${params.page || 1}`, queryParams);

  const jobs: AdzunaJob[] = (data.results || []).map((job: any) => ({
    id: String(job.id),
    title: job.title || '',
    company: job.company?.display_name || '',
    location: job.location?.display_name || '',
    salaryMin: job.salary_min || null,
    salaryMax: job.salary_max || null,
    description: job.description || '',
    created: job.created || '',
    redirectUrl: job.redirect_url || '',
    category: job.category?.label || '',
  }));

  // Calculate mean salary from results
  const salaries = jobs
    .map(j => j.salaryMin && j.salaryMax ? (j.salaryMin + j.salaryMax) / 2 : null)
    .filter((s): s is number => s !== null);
  const meanSalary = salaries.length > 0
    ? salaries.reduce((a, b) => a + b, 0) / salaries.length
    : null;

  return {
    count: data.count || 0,
    jobs,
    meanSalary,
  };
}

// ============================================================================
// SALARY ESTIMATION
// ============================================================================

/**
 * Get salary estimation for a job title / location from Adzuna's histogram API.
 */
export async function getSalaryEstimate(
  jobTitle: string,
  location?: string,
  country: string = 'us'
): Promise<AdzunaSalaryEstimate | null> {
  try {
    const queryParams: Record<string, string> = {
      what: jobTitle,
    };
    if (location) {
      queryParams.where = location;
    }

    const data = await adzunaFetch(`/jobs/${country}/history`, queryParams);

    if (!data.month) return null;

    // Get the latest month's data
    const months = Object.keys(data.month).sort();
    if (months.length === 0) return null;

    const latestMonth = data.month[months[months.length - 1]];
    const median = typeof latestMonth === 'number' ? latestMonth : latestMonth?.median || 0;

    return {
      percentile25: Math.round(median * 0.80),
      median: Math.round(median),
      percentile75: Math.round(median * 1.25),
      currency: 'USD',
    };
  } catch (err) {
    console.warn('Adzuna salary estimate failed:', err);
    return null;
  }
}

// ============================================================================
// UTILITY
// ============================================================================

export function isAdzunaConfigured(): boolean {
  return !!(Deno.env.get('ADZUNA_APP_ID') && Deno.env.get('ADZUNA_API_KEY'));
}
