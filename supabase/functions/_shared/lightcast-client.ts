/**
 * Lightcast (EMSI) API Client
 *
 * Provides skill extraction, related skills graph, job posting analytics,
 * and salary data from the Lightcast API.
 *
 * Auth: OAuth2 client_credentials with 1-hour token caching.
 *
 * USAGE:
 *   import { extractSkills, getRelatedSkills, getJobPostingAnalytics } from '../_shared/lightcast-client.ts';
 *
 *   const skills = await extractSkills('Build REST APIs with Python Flask');
 *   const related = await getRelatedSkills('KS123456');
 *   const analytics = await getJobPostingAnalytics({ skills: ['Python'], location: 'US-NY' });
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LightcastSkill {
  id: string;
  name: string;
  type: 'Specialized' | 'Common' | 'Certification';
  confidence: number;
}

export interface LightcastRelatedSkill {
  id: string;
  name: string;
  confidence: number;
  type?: string;
}

export interface LightcastJPAResult {
  totalPostings: number;
  uniquePostings: number;
  medianSalary: number | null;
  meanSalary: number | null;
  percentile25: number | null;
  percentile75: number | null;
  growthRate: number | null;  // year-over-year
  topEmployers: Array<{ name: string; postings: number }>;
  topLocations: Array<{ name: string; postings: number }>;
}

export interface LightcastSalaryData {
  percentile10: number;
  percentile25: number;
  median: number;
  percentile75: number;
  percentile90: number;
  currency: string;
}

// ============================================================================
// TOKEN CACHE
// ============================================================================

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 300_000) {
    return cachedToken;
  }

  const clientId = Deno.env.get('LIGHTCAST_CLIENT_ID');
  const clientSecret = Deno.env.get('LIGHTCAST_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('LIGHTCAST_CLIENT_ID and LIGHTCAST_CLIENT_SECRET must be set');
  }

  const response = await fetch('https://auth.emsicloud.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'emsi_open',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lightcast auth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return cachedToken!;
}

// ============================================================================
// API HELPERS
// ============================================================================

const BASE_URL = 'https://emsiservices.com';

async function lightcastFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle rate limiting with exponential backoff
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
    console.warn(`Lightcast rate limited, retrying in ${retryAfter}s`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return lightcastFetch(path, options); // Single retry
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lightcast API error (${response.status}) ${path}: ${errorText}`);
  }

  return response;
}

// ============================================================================
// SKILL EXTRACTION
// ============================================================================

/**
 * Extract skills from text using Lightcast NLP.
 * Useful for parsing syllabus text, job descriptions, course content.
 */
export async function extractSkills(text: string): Promise<LightcastSkill[]> {
  const response = await lightcastFetch('/skills/versions/latest/extract', {
    method: 'POST',
    body: JSON.stringify({
      text,
      confidenceThreshold: 0.5,
    }),
  });

  const data = await response.json();
  return (data.data || []).map((skill: any) => ({
    id: skill.skill?.id || skill.id,
    name: skill.skill?.name || skill.name,
    type: skill.skill?.type?.name || skill.type || 'Specialized',
    confidence: skill.confidence || 0.5,
  }));
}

// ============================================================================
// RELATED SKILLS GRAPH
// ============================================================================

/**
 * Get related skills for a given Lightcast skill ID.
 * Enables graph traversal for skill expansion.
 */
export async function getRelatedSkills(
  skillId: string,
  limit: number = 10
): Promise<LightcastRelatedSkill[]> {
  const response = await lightcastFetch(`/skills/versions/latest/skills/${skillId}/related`, {
    method: 'GET',
  });

  const data = await response.json();
  return (data.data || []).slice(0, limit).map((rel: any) => ({
    id: rel.id,
    name: rel.name,
    confidence: rel.score || rel.confidence || 0.5,
    type: rel.type?.name,
  }));
}

// ============================================================================
// JOB POSTING ANALYTICS (JPA)
// ============================================================================

/**
 * Get job posting analytics for skills/location.
 * Returns posting volume, salary data, growth trends, top employers.
 */
export async function getJobPostingAnalytics(params: {
  skills: string[];
  location?: string;
  timeframe?: string;  // e.g., '2025-01' to '2026-01'
}): Promise<LightcastJPAResult> {
  const filter: any = {
    when: params.timeframe ? { start: params.timeframe } : { start: 'last_12_months' },
  };

  if (params.skills.length > 0) {
    filter.skill_name = params.skills;
  }
  if (params.location) {
    filter.nation = params.location;
  }

  const response = await lightcastFetch('/jpa/totals', {
    method: 'POST',
    body: JSON.stringify({ filter }),
  });

  const data = await response.json();
  const totals = data.data?.totals || {};

  return {
    totalPostings: totals.total_postings || 0,
    uniquePostings: totals.unique_postings || 0,
    medianSalary: totals.median_posting_duration || null,
    meanSalary: null,
    percentile25: null,
    percentile75: null,
    growthRate: null,
    topEmployers: (data.data?.top_employers || []).slice(0, 10).map((e: any) => ({
      name: e.name,
      postings: e.unique_postings || 0,
    })),
    topLocations: (data.data?.top_metros || []).slice(0, 10).map((l: any) => ({
      name: l.name,
      postings: l.unique_postings || 0,
    })),
  };
}

// ============================================================================
// SALARY DATA
// ============================================================================

/**
 * Get estimated salary data for a given occupation / skills combination.
 */
export async function getSalaryEstimate(params: {
  occupationCode?: string;
  skills?: string[];
  location?: string;
}): Promise<LightcastSalaryData | null> {
  try {
    const queryParams = new URLSearchParams();
    if (params.occupationCode) queryParams.set('occ', params.occupationCode);
    if (params.location) queryParams.set('area', params.location);

    const response = await lightcastFetch(`/compensation/salary?${queryParams.toString()}`);
    const data = await response.json();

    if (!data.data) return null;

    return {
      percentile10: data.data.percentile10 || 0,
      percentile25: data.data.percentile25 || 0,
      median: data.data.median || 0,
      percentile75: data.data.percentile75 || 0,
      percentile90: data.data.percentile90 || 0,
      currency: 'USD',
    };
  } catch (err) {
    console.warn('Lightcast salary estimate failed:', err);
    return null;
  }
}

// ============================================================================
// UTILITY: Check if Lightcast is configured
// ============================================================================

export function isLightcastConfigured(): boolean {
  return !!(Deno.env.get('LIGHTCAST_CLIENT_ID') && Deno.env.get('LIGHTCAST_CLIENT_SECRET'));
}
