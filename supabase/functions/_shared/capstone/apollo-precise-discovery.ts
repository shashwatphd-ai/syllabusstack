/**
 * Apollo Precise Discovery Service
 * Ported from EduThree1's 3-strategy Apollo search system.
 *
 * Discovery Strategies (in order of precision):
 * 1. technology_filter — companies using specific technologies (via Apollo tech UIDs)
 * 2. job_title_search — companies with matching job titles
 * 3. industry_search — companies in relevant industries (broadest fallback)
 *
 * Features:
 * - Progressive location fallback (city → state → national)
 * - Course seed diversity via page offset
 * - Industry keyword mapping to Apollo taxonomy
 * - Recruiter title exclusion for technical courses
 */

import type {
  DiscoveredCompany,
  JobPosting,
  CompanyDiscoveryInput,
  CompanyDiscoveryOutput,
  DiscoveryStrategy
} from './pipeline-types.ts';
import { generateLocationVariants } from './location-utils.ts';
import { enrichOrganization, fetchJobPostingsRobust, calculateBuyingIntent } from './apollo-enrichment-service.ts';
import { getTechnologyUIDsFromSOC } from './apollo-technology-mapping.ts';
import { mapSOCIndustriesToApollo } from './apollo-industry-mapper.ts';
import type { SOCMapping } from './course-soc-mapping.ts';

const APOLLO_API_BASE = 'https://api.apollo.io';
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
  street_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  short_description?: string;
  seo_description?: string;
  current_technologies?: Array<{ uid: string; name: string; category?: string }>;
  latest_funding_stage?: string;
  total_funding?: number;
  industry_tag_list?: string[];
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

// ========== COURSE SEED FOR DIVERSITY ==========

function getCoursePageOffset(courseTitle: string): number {
  if (!courseTitle) return 1;
  const hash = courseTitle.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (hash % 5) + 1; // Pages 1-5
}

// ========== STRATEGIES ==========

/**
 * Strategy 1: Technology UID filter — most precise, filters for companies
 * that actually USE specific technologies.
 */
async function searchByTechnology(
  technologyUids: string[],
  locations: string[],
  targetCount: number,
  apiKey: string,
  pageOffset: number = 1
): Promise<ApolloOrganization[]> {
  console.log(`  [Strategy 1] Searching by ${technologyUids.length} technology UIDs...`);
  if (technologyUids.length === 0) return [];

  const result = await apolloFetch<{ organizations: ApolloOrganization[] }>(
    '/api/v1/mixed_companies/search',
    {
      currently_using_any_of_technology_uids: technologyUids.slice(0, 10),
      organization_locations: locations,
      organization_num_employees_ranges: ["11,50", "51,200", "201,500", "501,1000", "1001,5000"],
      per_page: Math.min(targetCount * 3, 100),
      page: pageOffset
    },
    apiKey
  );

  const orgs = result?.organizations || [];
  console.log(`  [Strategy 1] Found ${orgs.length} companies using matching technologies`);
  return orgs;
}

async function searchByJobTitles(
  jobTitles: string[],
  locations: string[],
  targetCount: number,
  apiKey: string,
  pageOffset: number = 1,
  excludeTitles: string[] = []
): Promise<ApolloOrganization[]> {
  console.log(`  [Strategy 2] Searching by ${jobTitles.length} job titles...`);
  if (jobTitles.length === 0) return [];

  const body: Record<string, unknown> = {
    q_organization_job_titles: jobTitles.slice(0, 5),
    organization_locations: locations,
    organization_num_employees_ranges: ["11,50", "51,200", "201,500", "501,1000", "1001,5000"],
    per_page: Math.min(targetCount * 3, 100),
    page: pageOffset
  };

  // Exclude recruiter titles for technical courses
  if (excludeTitles.length > 0) {
    body.person_not_titles = excludeTitles;
  }

  const result = await apolloFetch<{ organizations: ApolloOrganization[] }>(
    '/api/v1/mixed_companies/search',
    body,
    apiKey
  );

  const orgs = result?.organizations || [];
  console.log(`  [Strategy 2] Found ${orgs.length} companies with matching job titles`);
  return orgs;
}

async function searchByIndustry(
  apolloKeywords: string[],
  locations: string[],
  targetCount: number,
  apiKey: string,
  pageOffset: number = 1,
  excludeTitles: string[] = []
): Promise<ApolloOrganization[]> {
  console.log(`  [Strategy 3] Searching by ${apolloKeywords.length} Apollo keywords...`);
  if (apolloKeywords.length === 0) return [];

  const body: Record<string, unknown> = {
    q_organization_keyword_tags: apolloKeywords.slice(0, 15),
    organization_locations: locations,
    organization_num_employees_ranges: ["11,50", "51,200", "201,500", "501,1000", "1001,5000"],
    per_page: Math.min(targetCount * 4, 100),
    page: pageOffset
  };

  if (excludeTitles.length > 0) {
    body.person_not_titles = excludeTitles;
  }

  const result = await apolloFetch<{ organizations: ApolloOrganization[] }>(
    '/api/v1/mixed_companies/search',
    body,
    apiKey
  );

  const orgs = result?.organizations || [];
  console.log(`  [Strategy 3] Found ${orgs.length} companies in matching industries`);
  return orgs;
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
    discoveryStrategy: strategy,
    primary_domain: org.primary_domain,
  };
}

// ========== PROGRESSIVE LOCATION FALLBACK ==========

/**
 * Parse location into cascading levels for progressive search.
 * Returns: [cityLevel, stateLevel, nationalLevel]
 */
function getLocationCascade(location: string): string[][] {
  const parts = location.split(',').map(p => p.trim());

  if (parts.length >= 2) {
    const city = parts[0];
    const state = parts[1].replace(/,?\s*United States$/i, '').trim();

    return [
      // Level 1: City + State (most specific)
      [`${city}, ${state}, United States`, `${city}, ${state}`],
      // Level 2: State only
      [`${state}, United States`, state],
      // Level 3: National
      ['United States'],
    ];
  }

  // Can't parse — use full variant generation
  const variants = generateLocationVariants(location);
  return [variants, ['United States']];
}

// ========== MAIN EXPORT ==========

/**
 * Extended input with SOC codes and course title for enhanced discovery.
 */
export interface EnhancedDiscoveryInput extends CompanyDiscoveryInput {
  socCodes?: string[];
  socMappings?: SOCMapping[];
  courseTitle?: string;
}

/**
 * Discover companies using multi-strategy Apollo search with:
 * - Technology UID filtering (Strategy 1)
 * - Progressive location fallback (city → state → national)
 * - Course seed diversity
 * - Apollo industry keyword mapping
 */
export async function discoverCompanies(
  input: EnhancedDiscoveryInput
): Promise<CompanyDiscoveryOutput> {
  const startTime = Date.now();

  console.log(`\n========================================`);
  console.log(`PHASE 3: COMPANY DISCOVERY (Apollo Enhanced)`);
  console.log(`========================================`);
  console.log(`Location: ${input.location}`);
  console.log(`Target: ${input.targetCount} companies`);
  console.log(`Industries: ${input.industries.length}`);
  console.log(`Job Titles: ${input.jobTitles.length}`);
  console.log(`Skill Keywords: ${input.skillKeywords.length}`);
  console.log(`SOC Codes: ${(input.socCodes || []).length}`);

  const apiKey = getApolloApiKey();
  const pageOffset = getCoursePageOffset(input.courseTitle || '');
  console.log(`Course page offset: ${pageOffset}`);

  // Map industries to Apollo taxonomy
  const { apolloKeywords, excludeTitles } = input.socMappings
    ? mapSOCIndustriesToApollo(input.industries, input.socMappings)
    : { apolloKeywords: input.industries, excludeTitles: [] as string[] };

  console.log(`Apollo keywords (mapped): ${apolloKeywords.slice(0, 5).join(', ')}...`);
  if (excludeTitles.length > 0) {
    console.log(`Excluding titles: ${excludeTitles.join(', ')}`);
  }

  // Get technology UIDs for Strategy 1
  const technologyUids = input.socCodes
    ? getTechnologyUIDsFromSOC(input.socCodes)
    : [];
  console.log(`Technology UIDs: ${technologyUids.length}`);

  const statsByStrategy: Record<DiscoveryStrategy, number> = {
    technology_filter: 0,
    job_title_search: 0,
    industry_search: 0
  };

  const allOrganizations: Array<{ org: ApolloOrganization; strategy: DiscoveryStrategy }> = [];
  const seenIds = new Set<string>();

  const addOrgs = (orgs: ApolloOrganization[], strategy: DiscoveryStrategy) => {
    for (const org of orgs) {
      if (!seenIds.has(org.id)) {
        seenIds.add(org.id);
        allOrganizations.push({ org, strategy });
        statsByStrategy[strategy]++;
      }
    }
  };

  // ── Progressive Location Fallback ──
  const locationCascade = getLocationCascade(input.location);
  const targetTotal = input.targetCount * 3; // 3x for filtering headroom

  for (let level = 0; level < locationCascade.length; level++) {
    const locations = locationCascade[level];
    const levelName = level === 0 ? 'City' : level === 1 ? 'State' : 'National';
    console.log(`\n  📍 Location level ${level + 1} (${levelName}): ${locations[0]}`);

    // STRATEGY 1: Technology Filter (most precise)
    if (technologyUids.length > 0 && allOrganizations.length < targetTotal) {
      const techOrgs = await searchByTechnology(technologyUids, locations, input.targetCount, apiKey, pageOffset);
      addOrgs(techOrgs, 'technology_filter');
    }

    // STRATEGY 2: Job Title Search
    if (input.jobTitles.length > 0 && allOrganizations.length < targetTotal) {
      const jobOrgs = await searchByJobTitles(input.jobTitles, locations, input.targetCount, apiKey, pageOffset, excludeTitles);
      addOrgs(jobOrgs, 'job_title_search');
    }

    // STRATEGY 3: Industry Search (broadest)
    if (allOrganizations.length < targetTotal) {
      const industryOrgs = await searchByIndustry(apolloKeywords, locations, input.targetCount, apiKey, pageOffset, excludeTitles);
      addOrgs(industryOrgs, 'industry_search');
    }

    // If we have enough companies, stop broadening
    if (allOrganizations.length >= targetTotal) {
      console.log(`  ✅ Sufficient companies found at ${levelName} level (${allOrganizations.length})`);
      break;
    }

    console.log(`  ⚠️ Only ${allOrganizations.length}/${targetTotal} companies — broadening to next level`);
  }

  console.log(`\nTotal unique organizations found: ${allOrganizations.length}`);
  console.log(`  By technology filter: ${statsByStrategy.technology_filter}`);
  console.log(`  By job title search: ${statsByStrategy.job_title_search}`);
  console.log(`  By industry search: ${statsByStrategy.industry_search}`);

  // Transform + enrich companies (cap to control API spend and timeout)
  const companies: DiscoveredCompany[] = [];
  const enrichmentCap = Math.min(allOrganizations.length, 20); // Hard cap at 20 for timeout safety
  console.log(`\n  Enriching up to ${enrichmentCap} companies before validation...`);

  for (const { org, strategy } of allOrganizations.slice(0, enrichmentCap)) {
    const company = transformOrganization(org, strategy);
    const domain = org.website_url || org.primary_domain;

    // Stage 1: Organization enrichment (full profile)
    try {
      const enrichment = await enrichOrganization(domain, apiKey);
      if (enrichment) {
        company.description = enrichment.shortDescription || enrichment.seoDescription || company.description;
        company.seoDescription = enrichment.seoDescription;
        company.technologies = enrichment.technologies.length > 0 ? enrichment.technologies : company.technologies;
        company.employeeCount = enrichment.employeeCount || company.employeeCount;
        company.fundingStage = enrichment.fundingStage || company.fundingStage;
        company.totalFunding = enrichment.totalFunding || company.totalFunding;
        company.industryTags = enrichment.industries.length > 0 ? enrichment.industries : company.industryTags;
        company.revenueRange = enrichment.revenueRange;
        company.departmentalHeadCount = enrichment.departmentalHeadCount;
        company.lastEnrichedAt = new Date().toISOString();
      }
    } catch (e) {
      console.warn(`  Org enrichment failed for ${org.name}:`, e);
    }

    // Stage 2: Robust job postings fetch (no delay between calls)
    try {
      const jobPostings = await fetchJobPostingsRobust(org.id, apiKey);
      company.jobPostings = jobPostings.map(jp => ({
        id: jp.id,
        title: jp.title,
        description: jp.description || '',
        postedDate: jp.posted_at || new Date().toISOString(),
        location: jp.location
      }));
    } catch (e) {
      console.warn(`  Job postings failed for ${org.name}:`, e);
    }

    // Stage 3: Buying intent signals
    const buyingIntent = calculateBuyingIntent(
      company.fundingStage,
      company.totalFunding,
      company.jobPostings.length
    );
    company.buyingIntentSignals = buyingIntent;

    companies.push(company);
  }

  const processingTimeMs = Date.now() - startTime;
  console.log(`\nPhase 3 complete: ${companies.length} companies in ${processingTimeMs}ms`);
  console.log(`Companies with job postings: ${companies.filter(c => c.jobPostings.length > 0).length}`);
  console.log(`Companies with descriptions: ${companies.filter(c => c.description?.length > 0).length}`);

  return {
    companies,
    stats: {
      totalDiscovered: allOrganizations.length,
      byStrategy: statsByStrategy,
      processingTimeMs
    }
  };
}
