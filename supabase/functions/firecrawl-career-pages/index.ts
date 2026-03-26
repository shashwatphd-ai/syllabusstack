/**
 * Firecrawl Career Pages Scraper
 * Scrapes company career pages to validate hiring signals.
 * Ported from EduThree1.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

interface CareerPageRequest {
  companyId: string;
  companyName: string;
  websiteUrl: string;
  forceRefresh?: boolean;
}

interface CareerPageResult {
  success: boolean;
  companyId: string;
  companyName: string;
  data?: {
    careerPageUrl: string;
    jobCount: number;
    jobPostings: Array<{
      title: string;
      department?: string;
      location?: string;
      employmentType?: string;
    }>;
    hiringDepartments: string[];
    isActivelyHiring: boolean;
    hiringVelocitySignal: "high" | "medium" | "low" | "none";
    benefits?: string[];
    cultureKeywords?: string[];
    techStack?: string[];
    lastScrapedAt: string;
  };
  error?: string;
  cached?: boolean;
  processingTimeMs: number;
}

const CAREER_PAGE_PATHS = [
  "/careers", "/jobs", "/careers/", "/jobs/",
  "/join-us", "/work-with-us", "/opportunities", "/career", "/employment",
];

function calculateHiringVelocity(jobCount: number): "high" | "medium" | "low" | "none" {
  if (jobCount >= 20) return "high";
  if (jobCount >= 10) return "medium";
  if (jobCount >= 1) return "low";
  return "none";
}

function extractHiringDepartments(jobPostings: Array<{ department?: string }>): string[] {
  const departments = new Set<string>();
  for (const job of jobPostings) {
    if (job.department) departments.add(job.department);
  }
  return Array.from(departments);
}

async function findCareerPageUrl(baseUrl: string, apiKey: string): Promise<string | null> {
  const url = new URL(baseUrl);
  const baseHost = `${url.protocol}//${url.hostname}`;

  for (const path of CAREER_PAGE_PATHS) {
    try {
      const response = await fetch(`${baseHost}${path}`, { method: "HEAD", redirect: "follow" });
      if (response.ok) return `${baseHost}${path}`;
    } catch {
      // Path doesn't exist
    }
  }

  // Fallback: scrape homepage for career links
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: baseHost, formats: ["links"], onlyMainContent: false }),
    });
    if (response.ok) {
      const data = await response.json();
      const links = data.data?.links || [];
      const careerLink = links.find((link: string) => /career|jobs|join|hiring|opportunities/i.test(link));
      if (careerLink) return careerLink;
    }
  } catch (error) {
    console.warn("Failed to scrape homepage for links:", error);
  }

  return null;
}

async function scrapeCareerPage(careerUrl: string, apiKey: string) {
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: careerUrl,
      formats: ["markdown", "extract"],
      extract: {
        schema: {
          type: "object",
          properties: {
            jobPostings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  department: { type: "string" },
                  location: { type: "string" },
                  employmentType: { type: "string" },
                },
                required: ["title"],
              },
            },
            benefits: { type: "array", items: { type: "string" } },
            cultureKeywords: { type: "array", items: { type: "string" } },
            techStack: { type: "array", items: { type: "string" } },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl scrape failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const extraction = data.data?.llm_extraction || {};
  return {
    jobPostings: extraction.jobPostings || [],
    benefits: extraction.benefits || [],
    cultureKeywords: extraction.cultureKeywords || [],
    techStack: extraction.techStack || [],
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "Firecrawl API key not configured" }), { status: 500, headers });
    }

    const { companyId, companyName, websiteUrl, forceRefresh = false }: CareerPageRequest = await req.json();
    if (!companyId || !websiteUrl) {
      return new Response(JSON.stringify({ success: false, error: "companyId and websiteUrl are required" }), { status: 400, headers });
    }

    console.log(`🏢 [Career Scraper] Processing: ${companyName} (${websiteUrl})`);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check cache
    if (!forceRefresh) {
      const { data: existing } = await supabase
        .from("company_profiles")
        .select("last_enriched_at, job_postings")
        .eq("id", companyId)
        .single();

      if (existing?.last_enriched_at) {
        const hoursSince = (Date.now() - new Date(existing.last_enriched_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          const cachedJobs = typeof existing.job_postings === "string"
            ? JSON.parse(existing.job_postings) : existing.job_postings || [];
          const result: CareerPageResult = {
            success: true, companyId, companyName, cached: true,
            data: {
              careerPageUrl: websiteUrl, jobCount: cachedJobs.length,
              jobPostings: cachedJobs.slice(0, 25),
              hiringDepartments: extractHiringDepartments(cachedJobs),
              isActivelyHiring: cachedJobs.length > 0,
              hiringVelocitySignal: calculateHiringVelocity(cachedJobs.length),
              lastScrapedAt: existing.last_enriched_at,
            },
            processingTimeMs: Date.now() - startTime,
          };
          return new Response(JSON.stringify(result), { headers });
        }
      }
    }

    const careerPageUrl = await findCareerPageUrl(websiteUrl, apiKey);

    if (!careerPageUrl) {
      const result: CareerPageResult = {
        success: true, companyId, companyName,
        data: {
          careerPageUrl: websiteUrl, jobCount: 0, jobPostings: [],
          hiringDepartments: [], isActivelyHiring: false,
          hiringVelocitySignal: "none", lastScrapedAt: new Date().toISOString(),
        },
        processingTimeMs: Date.now() - startTime,
      };
      return new Response(JSON.stringify(result), { headers });
    }

    const scrapeResult = await scrapeCareerPage(careerPageUrl, apiKey);
    const jobCount = scrapeResult.jobPostings.length;
    const hiringDepartments = extractHiringDepartments(scrapeResult.jobPostings);

    // Update company profile
    const updateData: Record<string, unknown> = {
      job_postings: scrapeResult.jobPostings.slice(0, 25),
      last_enriched_at: new Date().toISOString(),
    };
    if (scrapeResult.techStack?.length) updateData.technologies_used = scrapeResult.techStack;

    await supabase.from("company_profiles").update(updateData).eq("id", companyId);

    const result: CareerPageResult = {
      success: true, companyId, companyName,
      data: {
        careerPageUrl, jobCount,
        jobPostings: scrapeResult.jobPostings.slice(0, 25),
        hiringDepartments, isActivelyHiring: jobCount > 0,
        hiringVelocitySignal: calculateHiringVelocity(jobCount),
        benefits: scrapeResult.benefits, cultureKeywords: scrapeResult.cultureKeywords,
        techStack: scrapeResult.techStack, lastScrapedAt: new Date().toISOString(),
      },
      processingTimeMs: Date.now() - startTime,
    };
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    console.error("❌ [Career Scraper] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error", processingTimeMs: Date.now() - startTime }),
      { status: 500, headers }
    );
  }
});
