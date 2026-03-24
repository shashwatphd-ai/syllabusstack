/**
 * Career Page Validator using Firecrawl
 * Scrapes company /careers pages to validate hiring signals from Apollo.
 * Ported from EduThree1's firecrawl-career-pages function.
 */

const CAREER_PATHS = ['/careers', '/jobs', '/careers/', '/jobs/', '/join-us', '/work-with-us', '/opportunities'];

export interface CareerPageResult {
  success: boolean;
  careerPageUrl: string | null;
  jobCount: number;
  jobPostings: Array<{ title: string; department?: string; location?: string }>;
  hiringDepartments: string[];
  isActivelyHiring: boolean;
  hiringVelocitySignal: 'high' | 'medium' | 'low' | 'none';
  techStack: string[];
  processingTimeMs: number;
}

/**
 * Validate a company's hiring signals by scraping their career page.
 */
export async function validateCareerPage(
  websiteUrl: string,
  companyName: string
): Promise<CareerPageResult> {
  const startTime = Date.now();
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlKey || !websiteUrl) {
    return emptyResult(startTime);
  }

  console.log(`  🔥 [Career Validator] Checking: ${companyName} (${websiteUrl})`);

  try {
    // Find career page
    const careerUrl = await findCareerPage(websiteUrl, firecrawlKey);
    if (!careerUrl) {
      console.log(`  ⚠️ No career page found for ${companyName}`);
      return emptyResult(startTime);
    }

    // Scrape it
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: careerUrl,
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              jobPostings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    department: { type: 'string' },
                    location: { type: 'string' },
                  },
                  required: ['title'],
                },
              },
              techStack: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn(`  ⚠️ Firecrawl scrape failed: ${response.status}`);
      return emptyResult(startTime);
    }

    const data = await response.json();
    const extraction = data.data?.llm_extraction || data.data?.extract || {};
    const jobs = (extraction.jobPostings || []).slice(0, 25);
    const techStack = extraction.techStack || [];

    const departments = [...new Set(jobs.map((j: any) => j.department).filter(Boolean))];
    const velocity: 'high' | 'medium' | 'low' | 'none' =
      jobs.length >= 20 ? 'high' : jobs.length >= 10 ? 'medium' : jobs.length >= 1 ? 'low' : 'none';

    console.log(`  ✅ Found ${jobs.length} jobs, velocity: ${velocity}`);

    return {
      success: true,
      careerPageUrl: careerUrl,
      jobCount: jobs.length,
      jobPostings: jobs,
      hiringDepartments: departments as string[],
      isActivelyHiring: jobs.length > 0,
      hiringVelocitySignal: velocity,
      techStack,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`  ❌ Career validation error:`, error);
    return emptyResult(startTime);
  }
}

async function findCareerPage(baseUrl: string, apiKey: string): Promise<string | null> {
  try {
    const url = new URL(baseUrl);
    const baseHost = `${url.protocol}//${url.hostname}`;

    // Try common paths
    for (const path of CAREER_PATHS) {
      try {
        const resp = await fetch(`${baseHost}${path}`, { method: 'HEAD', redirect: 'follow' });
        if (resp.ok) return `${baseHost}${path}`;
      } catch { /* continue */ }
    }

    // Fallback: scrape homepage for career links
    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: baseHost, formats: ['links'], onlyMainContent: false }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const links = data.data?.links || [];
      const careerLink = links.find((l: string) => /career|jobs|join|hiring|opportunities/i.test(l));
      if (careerLink) return careerLink;
    }
  } catch { /* no career page */ }

  return null;
}

function emptyResult(startTime: number): CareerPageResult {
  return {
    success: false,
    careerPageUrl: null,
    jobCount: 0,
    jobPostings: [],
    hiringDepartments: [],
    isActivelyHiring: false,
    hiringVelocitySignal: 'none',
    techStack: [],
    processingTimeMs: Date.now() - startTime,
  };
}
