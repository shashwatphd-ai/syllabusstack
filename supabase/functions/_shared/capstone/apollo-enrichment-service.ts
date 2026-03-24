/**
 * Apollo Enrichment Service
 * Ported from EduThree1's enrichSingleOrganization() logic.
 * 
 * 3-stage enrichment per company:
 * 1. Organization Enrich API — full company profile
 * 2. Job Postings — GET /organizations/{id}/job_postings (corrected endpoint)
 * 3. Contact Search — /mixed_people/api_search + /people/bulk_match (migrated from deprecated endpoint)
 */

const APOLLO_API_BASE = 'https://api.apollo.io';
const REQUEST_TIMEOUT_MS = 25000;
const ENRICHMENT_DELAY_MS = 200;

// ============================================
// SHARED FETCH HELPER
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apolloEnrichFetch<T>(
  endpoint: string,
  body: Record<string, unknown>,
  apiKey: string,
  method: 'POST' | 'GET' = 'POST'
): Promise<T | null> {
  const url = `${APOLLO_API_BASE}${endpoint}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      };

      if (method === 'POST') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`  [Enrich] Rate limited on ${endpoint}, waiting ${waitTime / 1000}s...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`  [Enrich] ${endpoint} returned ${response.status}: ${errorText.substring(0, 150)}`);
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      if (attempt === 2) {
        console.warn(`  [Enrich] ${endpoint} failed after 2 attempts:`, error);
        return null;
      }
      await sleep(1000);
    }
  }
  return null;
}

// ============================================
// 1. ORGANIZATION ENRICHMENT
// ============================================

interface ApolloEnrichmentResponse {
  organization?: {
    id?: string;
    short_description?: string;
    seo_description?: string;
    industries?: string[];
    industry_tag_list?: string[];
    technology_names?: string[];
    current_technologies?: Array<{ name: string; category?: string }>;
    departmental_head_count?: Record<string, number>;
    funding_events?: Array<{ date?: string; news_url?: string; type?: string; amount?: number }>;
    estimated_num_employees?: number;
    annual_revenue_printed?: string;
    annual_revenue?: number;
    linkedin_url?: string;
    latest_funding_stage?: string;
    total_funding?: number;
    // Address fields
    street_address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    phone?: string;
  };
}

export interface EnrichmentResult {
  shortDescription: string;
  seoDescription: string;
  industries: string[];
  technologies: string[];
  departmentalHeadCount: Record<string, number>;
  employeeCount: number;
  revenueRange: string;
  fundingStage: string;
  totalFunding: number;
  linkedinUrl: string;
  // Address fields from Apollo enrichment
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

export async function enrichOrganization(
  domain: string | undefined | null,
  apiKey: string
): Promise<EnrichmentResult | null> {
  if (!domain) {
    console.log('  [Enrich] No domain provided, skipping org enrichment');
    return null;
  }

  // Clean domain
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  const result = await apolloEnrichFetch<ApolloEnrichmentResponse>(
    '/v1/organizations/enrich',
    { domain: cleanDomain },
    apiKey
  );

  if (!result?.organization) return null;

  const org = result.organization;
  return {
    shortDescription: org.short_description || '',
    seoDescription: org.seo_description || '',
    industries: org.industry_tag_list || org.industries || [],
    technologies: org.technology_names || (org.current_technologies || []).map(t => t.name),
    departmentalHeadCount: org.departmental_head_count || {},
    employeeCount: org.estimated_num_employees || 0,
    revenueRange: org.annual_revenue_printed || '',
    fundingStage: org.latest_funding_stage || '',
    totalFunding: org.total_funding || 0,
    linkedinUrl: org.linkedin_url || '',
    streetAddress: org.street_address || '',
    city: org.city || '',
    state: org.state || '',
    postalCode: org.postal_code || '',
    country: org.country || '',
    phone: org.phone || '',
  };
}

// ============================================
// 2. ROBUST JOB POSTINGS FETCH (FIXED)
// ============================================

interface ApolloJobPosting {
  id: string;
  title: string;
  posted_at?: string;
  location?: string;
  description?: string;
  url?: string;
}

/**
 * Fetch job postings using the correct GET endpoint:
 * GET /api/v1/organizations/{organization_id}/job_postings
 */
export async function fetchJobPostingsRobust(
  orgId: string,
  apiKey: string
): Promise<ApolloJobPosting[]> {
  // Strategy 1: Correct REST path — GET /api/v1/organizations/{orgId}/job_postings
  try {
    const url = `${APOLLO_API_BASE}/api/v1/organizations/${orgId}/job_postings`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const jobs = (data?.job_postings || data?.organization_job_postings || []) as ApolloJobPosting[];
      if (jobs.length > 0) {
        console.log(`  [Enrich] Found ${jobs.length} job postings via GET endpoint`);
        return jobs;
      }
    } else {
      const errorText = await response.text();
      console.warn(`  [Enrich] GET /organizations/${orgId}/job_postings returned ${response.status}: ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.warn(`  [Enrich] Job postings GET failed:`, error);
  }

  // Strategy 2: Mixed companies search with job postings inline
  const result2 = await apolloEnrichFetch<Record<string, unknown>>(
    '/v1/mixed_companies/search',
    { organization_ids: [orgId], per_page: 1 },
    apiKey
  );

  const orgs = (result2?.organizations || []) as Array<{ job_postings?: ApolloJobPosting[] }>;
  if (orgs[0]?.job_postings?.length) {
    console.log(`  [Enrich] Found ${orgs[0].job_postings.length} job postings via mixed search`);
    return orgs[0].job_postings;
  }

  console.log('  [Enrich] No job postings found via either endpoint');
  return [];
}

// ============================================
// 3. DECISION-MAKER CONTACT SEARCH (MIGRATED)
// ============================================

interface ApolloContact {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  title?: string;
  phone_numbers?: Array<{ sanitized_number?: string }>;
  linkedin_url?: string;
}

export interface ContactResult {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  phone: string;
  linkedinUrl: string;
}

const DOMAIN_DEPARTMENT_MAP: Record<string, string[]> = {
  engineering: ['engineering', 'operations', 'product'],
  business: ['business_development', 'operations', 'finance', 'marketing'],
  science: ['engineering', 'operations', 'product'],
  data: ['engineering', 'data', 'product', 'information_technology'],
  arts: ['marketing', 'media_and_communication', 'human_resources'],
  default: ['operations', 'business_development', 'engineering'],
};

/**
 * Find best contact using the NEW 2-step flow:
 * Step 1: /mixed_people/api_search (returns partial profiles, no credits)
 * Step 2: /people/bulk_match (enriches with email/phone, costs credits)
 */
export async function findBestContact(
  orgId: string,
  courseDomain: string,
  apiKey: string
): Promise<ContactResult | null> {
  const departments = DOMAIN_DEPARTMENT_MAP[courseDomain] || DOMAIN_DEPARTMENT_MAP.default;

  // 4-strategy cascade for finding decision-makers
  const strategies = [
    { seniorities: ['vp', 'director'], departments: [departments[0]] },
    { seniorities: ['c_suite', 'owner'], departments: [departments[0]] },
    { seniorities: ['manager', 'senior'], departments: [departments[0]] },
    { seniorities: ['vp', 'director', 'c_suite', 'manager'], departments: [] }, // company-wide
  ];

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];

    // Step 1: api_search (free, returns partial profiles with IDs)
    const searchBody: Record<string, unknown> = {
      organization_ids: [orgId],
      person_seniorities: strategy.seniorities,
      per_page: 3,
    };

    if (strategy.departments.length > 0) {
      searchBody.person_departments = strategy.departments;
    }

    const searchResult = await apolloEnrichFetch<{ people?: ApolloContact[] }>(
      '/api/v1/mixed_people/api_search',
      searchBody,
      apiKey
    );

    const people = searchResult?.people || [];
    if (people.length === 0) {
      await sleep(100);
      continue;
    }

    // Step 2: Enrich the best candidate via /people/bulk_match
    const personIds = people.slice(0, 1).map(p => p.id).filter(Boolean);
    if (personIds.length > 0) {
      const enrichResult = await apolloEnrichFetch<{ people?: ApolloContact[] }>(
        '/api/v1/people/bulk_match',
        { 
          details: personIds.map(id => ({ id })),
          reveal_personal_emails: false,
        },
        apiKey
      );

      const enrichedPeople = enrichResult?.people || [];
      const contact = enrichedPeople.find(p => p.email) || enrichedPeople[0];

      if (contact) {
        console.log(`  [Enrich] Found contact via strategy ${i + 1} (api_search+bulk_match): ${contact.first_name} ${contact.last_name} (${contact.title})`);
        return {
          firstName: contact.first_name || '',
          lastName: contact.last_name || '',
          email: contact.email || '',
          title: contact.title || '',
          phone: contact.phone_numbers?.[0]?.sanitized_number || '',
          linkedinUrl: contact.linkedin_url || '',
        };
      }
    }

    // Fallback: use partial data from api_search if bulk_match fails
    const partialContact = people[0];
    if (partialContact && (partialContact.first_name || partialContact.title)) {
      console.log(`  [Enrich] Found partial contact via strategy ${i + 1} (api_search only): ${partialContact.first_name} ${partialContact.last_name} (${partialContact.title})`);
      return {
        firstName: partialContact.first_name || '',
        lastName: partialContact.last_name || '',
        email: '', // api_search doesn't return emails
        title: partialContact.title || '',
        phone: '',
        linkedinUrl: partialContact.linkedin_url || '',
      };
    }

    await sleep(100); // Brief pause between strategies
  }

  console.log('  [Enrich] No contacts found after all strategies');
  return null;
}

// ============================================
// 4. BUYING INTENT CALCULATION
// ============================================

export interface BuyingIntentSignals {
  fundingScore: number;
  hiringVelocityScore: number;
  compositeScore: number;
  signals: string[];
}

export function calculateBuyingIntent(
  fundingStage: string | undefined,
  totalFunding: number | undefined,
  jobPostingCount: number
): BuyingIntentSignals {
  const signals: string[] = [];

  // Funding stage scoring
  let fundingScore = 0;
  if (fundingStage) {
    const stage = fundingStage.toLowerCase();
    if (stage.includes('seed') || stage.includes('angel')) {
      fundingScore = 0.2;
      signals.push('Early-stage funding');
    } else if (stage.includes('series a')) {
      fundingScore = 0.3;
      signals.push('Series A funded');
    } else if (stage.includes('series b')) {
      fundingScore = 0.5;
      signals.push('Series B funded — growth stage');
    } else if (stage.includes('series c') || stage.includes('series d') || stage.includes('series e')) {
      fundingScore = 0.7;
      signals.push(`Late-stage funding (${fundingStage})`);
    } else if (stage.includes('ipo') || stage.includes('public')) {
      fundingScore = 0.6;
      signals.push('Publicly traded');
    } else if (stage.includes('private equity') || stage.includes('acquired')) {
      fundingScore = 0.5;
      signals.push('PE-backed or acquired');
    }
  }

  if (totalFunding && totalFunding > 10000000) {
    fundingScore = Math.min(1.0, fundingScore + 0.1);
    signals.push(`$${(totalFunding / 1000000).toFixed(0)}M+ total funding`);
  }

  // Hiring velocity scoring
  let hiringVelocityScore = 0;
  if (jobPostingCount === 0) {
    hiringVelocityScore = 0;
  } else if (jobPostingCount <= 3) {
    hiringVelocityScore = 0.3;
    signals.push(`${jobPostingCount} active job postings`);
  } else if (jobPostingCount <= 10) {
    hiringVelocityScore = 0.6;
    signals.push(`${jobPostingCount} active job postings — actively hiring`);
  } else {
    hiringVelocityScore = 0.9;
    signals.push(`${jobPostingCount}+ active job postings — high hiring velocity`);
  }

  const compositeScore = fundingScore * 0.4 + hiringVelocityScore * 0.6;

  return { fundingScore, hiringVelocityScore, compositeScore, signals };
}

// ============================================
// 5. DATA COMPLETENESS SCORE
// ============================================

export function calculateEnrichmentCompleteness(
  contact: ContactResult | null,
  enrichment: EnrichmentResult | null,
  jobPostingCount: number,
  techCount: number
): number {
  let score = 0;

  // Contact quality (40 pts)
  if (contact) {
    if (contact.email) score += 20;
    if (contact.firstName && contact.lastName) score += 10;
    if (contact.title) score += 5;
    if (contact.phone) score += 5;
  }

  // Organization data (30 pts)
  if (enrichment) {
    if (enrichment.shortDescription || enrichment.seoDescription) score += 10;
    if (enrichment.employeeCount > 0) score += 5;
    if (enrichment.revenueRange) score += 5;
    if (enrichment.fundingStage) score += 5;
    if (enrichment.industries.length > 0) score += 5;
  }

  // Market signals (30 pts)
  if (jobPostingCount > 0) score += 15;
  if (techCount > 0) score += 15;

  // Normalize to 0.0-1.0 scale (max possible = 100)
  return score / 100;
}

// ============================================
// MAIN ENRICHMENT ORCHESTRATOR
// ============================================

export interface FullEnrichmentResult {
  enrichment: EnrichmentResult | null;
  jobPostings: ApolloJobPosting[];
  contact: ContactResult | null;
  buyingIntent: BuyingIntentSignals;
  completenessScore: number;
}

export async function enrichCompanyFull(
  orgId: string,
  domain: string | undefined | null,
  courseDomain: string,
  apiKey: string
): Promise<FullEnrichmentResult> {
  // Step 1: Org enrichment
  const enrichment = await enrichOrganization(domain, apiKey);
  await sleep(ENRICHMENT_DELAY_MS);

  // Step 2: Job postings
  const jobPostings = await fetchJobPostingsRobust(orgId, apiKey);
  await sleep(ENRICHMENT_DELAY_MS);

  // Step 3: Contact search
  const contact = await findBestContact(orgId, courseDomain, apiKey);

  // Step 4: Buying intent
  const buyingIntent = calculateBuyingIntent(
    enrichment?.fundingStage,
    enrichment?.totalFunding,
    jobPostings.length
  );

  // Step 5: Completeness
  const completenessScore = calculateEnrichmentCompleteness(
    contact,
    enrichment,
    jobPostings.length,
    enrichment?.technologies.length || 0
  );

  return { enrichment, jobPostings, contact, buyingIntent, completenessScore };
}
