/**
 * Apollo Precise Discovery Service
 * Ported from EduThree1's 3-strategy Apollo search system.
 *
 * Discovery Strategies (in order of precision):
 * 1. technology_filter — companies using specific technologies (not used yet; requires Apollo tech UIDs)
 * 2. job_title_search — companies with matching job titles
 * 3. industry_search — companies in relevant industries (broadest fallback)
 */

import type {
  DiscoveredCompany,
  JobPosting,
  CompanyDiscoveryInput,
  CompanyDiscoveryOutput,
  DiscoveryStrategy
} from './pipeline-types.ts';
import { generateLocationVariants } from './location-utils.ts';

const APOLLO_API_BASE = 'https://api.apollo.io/v1';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  primary_domain?: string;
  industry?: string;
  keywords?: string[];
  estimated_num_employees?: number;
  city?: string;
  state?: string;
  country?: string;
  short_description?: string;
  seo_description?: string;
  current_technologies?: Array<{ uid: string; name: string; category?: string }>;
  latest_funding_stage?: string;
  total_funding?: number;
  industry_tag_list?: string[];
}

interface ApolloJobPosting {
  id: string;
  title: string;
  posted_at?: string;
  location?: string;
  description?: string;
}

function getApolloApiKey(): string {
  const apiKey = Deno.env.get('APOLLO_API_KEY');
  if (!apiKey) throw new Error('APOLLO_API_KEY is required for company discovery');
  return apiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apolloFetch<T>(
  endpoint: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<T | null> {
  const url = `${APOLLO_API_BASE}${endpoint}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`  [Apollo] Rate limited, waiting ${waitTime / 1000}s...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  [Apollo] API error ${response.status}: ${errorText.substring(0, 200)}`);
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(`  [Apollo] Failed after ${MAX_RETRIES} attempts:`, error);
        return null;
      }
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.warn(`  [Apollo] Attempt ${attempt} failed, retrying in ${backoffMs / 1000}s...`);
      await sleep(backoffMs);
    }
  }

  return null;
}

// ========== STRATEGIES ==========

async function searchByJobTitles(
  jobTitles: string[],
  locations: string[],
  targetCount: number,
  apiKey: string
): Promise<ApolloOrganization[]> {
  console.log(`  [Strategy 2] Searching by ${jobTitles.length} job titles...`);
  if (jobTitles.length === 0) return [];

  const result = await apolloFetch<{ organizations: ApolloOrganization[] }>(
    '/mixed_companies/search',
    {
      q_organization_job_titles: jobTitles.slice(0, 5),
      organization_locations: locations,
      organization_num_employees_ranges: ["11,50", "51,200", "201,500", "501,1000", "1001,5000"],
      per_page: Math.min(targetCount * 3, 100),
      page: 1
    },
    apiKey
  );

  const orgs = result?.organizations || [];
  console.log(`  [Strategy 2] Found ${orgs.length} companies with matching job titles`);
  return orgs;
}

async function searchByIndustry(
  industries: string[],
  keywords: string[],
  locations: string[],
  targetCount: number,
  apiKey: string
): Promise<ApolloOrganization[]> {
  console.log(`  [Strategy 3] Searching by ${industries.length} industries + ${keywords.length} keywords...`);
  if (industries.length === 0 && keywords.length === 0) return [];

  const result = await apolloFetch<{ organizations: ApolloOrganization[] }>(
    '/mixed_companies/search',
    {
      q_organization_keyword_tags: [...industries, ...keywords].slice(0, 15),
      organization_locations: locations,
      organization_num_employees_ranges: ["11,50", "51,200", "201,500", "501,1000", "1001,5000"],
      per_page: Math.min(targetCount * 4, 100),
      page: 1
    },
    apiKey
  );

  const orgs = result?.organizations || [];
  console.log(`  [Strategy 3] Found ${orgs.length} companies in matching industries`);
  return orgs;
}

async function fetchJobPostings(companyId: string, apiKey: string): Promise<ApolloJobPosting[]> {
  const result = await apolloFetch<{ job_postings: ApolloJobPosting[] }>(
    '/organizations/job_postings',
    { organization_id: companyId, per_page: 10 },
    apiKey
  );
  return result?.job_postings || [];
}

function transformOrganization(
  org: ApolloOrganization,
  strategy: DiscoveryStrategy
): DiscoveredCompany {
  return {
    apolloId: org.id,
    name: org.name,
    website: org.website_url || org.primary_domain,
    industry: org.industry || 'Unknown',
    industryTags: org.industry_tag_list || org.keywords || [],
    employeeCount: org.estimated_num_employees || 0,
    location: {
      city: org.city || '',
      state: org.state || '',
      country: org.country || 'United States',
    },
    description: org.short_description || org.seo_description || '',
    jobPostings: [],
    technologies: (org.current_technologies || []).map(t => t.name),
    fundingStage: org.latest_funding_stage,
    totalFunding: org.total_funding,
    discoveryStrategy: strategy
  };
}

// ========== MAIN EXPORT ==========

/**
 * Discover companies using multi-strategy Apollo search.
 */
export async function discoverCompanies(
  input: CompanyDiscoveryInput
): Promise<CompanyDiscoveryOutput> {
  const startTime = Date.now();

  console.log(`\n========================================`);
  console.log(`PHASE 3: COMPANY DISCOVERY (Apollo)`);
  console.log(`========================================`);
  console.log(`Location: ${input.location}`);
  console.log(`Target: ${input.targetCount} companies`);
  console.log(`Industries: ${input.industries.length}`);
  console.log(`Job Titles: ${input.jobTitles.length}`);
  console.log(`Skill Keywords: ${input.skillKeywords.length}`);

  const apiKey = getApolloApiKey();
  const locations = generateLocationVariants(input.location);
  console.log(`Location variants: ${locations.join(', ')}`);

  const statsByStrategy: Record<DiscoveryStrategy, number> = {
    technology_filter: 0,
    job_title_search: 0,
    industry_search: 0
  };

  const allOrganizations: Array<{ org: ApolloOrganization; strategy: DiscoveryStrategy }> = [];
  const seenIds = new Set<string>();

  // STRATEGY 2: Job Title Search (most useful without tech UIDs)
  if (input.jobTitles.length > 0) {
    const jobOrgs = await searchByJobTitles(input.jobTitles, locations, input.targetCount, apiKey);
    for (const org of jobOrgs) {
      if (!seenIds.has(org.id)) {
        seenIds.add(org.id);
        allOrganizations.push({ org, strategy: 'job_title_search' });
        statsByStrategy.job_title_search++;
      }
    }
  }

  // STRATEGY 3: Industry Search (fallback / additional)
  if (allOrganizations.length < input.targetCount * 2) {
    const industryOrgs = await searchByIndustry(
      input.industries,
      input.skillKeywords.slice(0, 5),
      locations,
      input.targetCount,
      apiKey
    );
    for (const org of industryOrgs) {
      if (!seenIds.has(org.id)) {
        seenIds.add(org.id);
        allOrganizations.push({ org, strategy: 'industry_search' });
        statsByStrategy.industry_search++;
      }
    }
  }

  console.log(`\nTotal unique organizations found: ${allOrganizations.length}`);
  console.log(`  By job title search: ${statsByStrategy.job_title_search}`);
  console.log(`  By industry search: ${statsByStrategy.industry_search}`);

  // Transform + fetch job postings (limit to targetCount * 2 to save API calls)
  const companies: DiscoveredCompany[] = [];
  for (const { org, strategy } of allOrganizations.slice(0, input.targetCount * 2)) {
    const company = transformOrganization(org, strategy);

    // Fetch job postings for enrichment
    try {
      const jobPostings = await fetchJobPostings(org.id, apiKey);
      company.jobPostings = jobPostings.map(jp => ({
        id: jp.id,
        title: jp.title,
        description: jp.description || '',
        postedDate: jp.posted_at || new Date().toISOString(),
        location: jp.location
      }));
    } catch (e) {
      console.warn(`  Failed to fetch job postings for ${org.name}:`, e);
    }

    companies.push(company);
    await sleep(100); // Don't overwhelm Apollo
  }

  const processingTimeMs = Date.now() - startTime;
  console.log(`\nPhase 3 complete: ${companies.length} companies in ${processingTimeMs}ms`);
  console.log(`Companies with job postings: ${companies.filter(c => c.jobPostings.length > 0).length}`);

  return {
    companies,
    stats: {
      totalDiscovered: allOrganizations.length,
      byStrategy: statsByStrategy,
      processingTimeMs
    }
  };
}
