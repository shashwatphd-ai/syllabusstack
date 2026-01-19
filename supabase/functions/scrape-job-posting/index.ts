import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getWebProvider } from "../_shared/web-provider.ts";
import { simpleCompletion, MODELS } from "../_shared/openrouter-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobPostingData {
  title: string;
  company?: string;
  companyType?: string;
  location?: string;
  salaryRange?: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  experienceLevel?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL format
    let jobUrl: URL;
    try {
      jobUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SSRF Protection: Whitelist of allowed job posting domains
    const ALLOWED_JOB_HOSTS = [
      'linkedin.com', 'www.linkedin.com',
      'indeed.com', 'www.indeed.com',
      'glassdoor.com', 'www.glassdoor.com',
      'greenhouse.io', 'boards.greenhouse.io',
      'lever.co', 'jobs.lever.co',
      'workday.com', 'myworkdayjobs.com',
      'angel.co', 'wellfound.com',
      'ziprecruiter.com', 'www.ziprecruiter.com',
      'monster.com', 'www.monster.com',
      'simplyhired.com', 'www.simplyhired.com',
      'builtin.com', 'www.builtin.com',
      'dice.com', 'www.dice.com',
      'careerbuilder.com', 'www.careerbuilder.com',
      'usajobs.gov', 'www.usajobs.gov',
    ];

    const hostname = jobUrl.hostname.toLowerCase();
    const isAllowedHost = ALLOWED_JOB_HOSTS.some(allowed => 
      hostname === allowed || hostname.endsWith('.' + allowed)
    );

    if (!isAllowedHost) {
      // Block private IP ranges and localhost
      const blockedPatterns = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^localhost$/i,
        /^169\.254\./,
        /^::1$/,
        /^fc00:/i,
        /^fe80:/i,
        /^0\./,
        /^\[::1\]$/,
      ];

      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return new Response(
          JSON.stringify({ error: "Private or internal URLs are not allowed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`URL domain ${hostname} not in whitelist, but allowing for flexibility`);
      // Note: We allow non-whitelisted domains but log them for monitoring
      // The third-party APIs (Firecrawl/Jina) have their own SSRF protections
    }

    console.log(`Scraping job posting from: ${jobUrl.href}`);

    // Get web provider (firecrawl or jina based on WEB_PROVIDER env var)
    const webProvider = getWebProvider();
    console.log(`Using web provider: ${webProvider.name}`);

    // Check if provider is configured
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (webProvider.name === 'firecrawl' && !FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured. Please connect Firecrawl in Settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use web provider abstraction to scrape the job posting
    const scrapeResult = await webProvider.scrape(jobUrl.href, {
      onlyMainContent: true,
      waitFor: 2000,
    });

    if (!scrapeResult.success) {
      console.error(`${webProvider.name} scrape failed for: ${jobUrl.href}`);
      return new Response(
        JSON.stringify({ error: "Failed to scrape job posting. Please try a different URL." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeResult.markdown || "";
    const metadata = scrapeResult.metadata || {};
    
    console.log(`Scraped ${markdown.length} characters from ${jobUrl.host}`);

    // Use OpenRouter for AI extraction
    let jobData: JobPostingData;
    
    try {
      const systemPrompt = `You are a job posting analyzer. Extract structured information from job postings.
Return a JSON object with these fields (use null for missing fields):
{
  "title": "job title",
  "company": "company name",
  "companyType": "startup|tech|consulting|finance|corporate|nonprofit|agency|other",
  "location": "city, state or Remote",
  "salaryRange": "$X - $Y per year" or null,
  "description": "1-2 sentence summary of the role",
  "requirements": ["list of required skills/qualifications"],
  "responsibilities": ["list of key responsibilities"],
  "experienceLevel": "entry|mid|senior|lead|executive"
}`;

      const userPrompt = `Extract job information from this posting:\n\n${markdown.slice(0, 8000)}`;

      const aiResponse = await simpleCompletion(
        MODELS.FAST,
        systemPrompt,
        userPrompt,
        { json: true, fallbacks: [MODELS.GEMINI_FLASH] },
        '[scrape-job-posting]'
      );

      jobData = JSON.parse(aiResponse);
      console.log("AI extracted job data:", jobData.title);
    } catch (aiError) {
      console.error("AI extraction failed, using fallback:", aiError);
      jobData = extractJobDataFallback(markdown, metadata);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: jobData,
        sourceUrl: jobUrl.href,
        sourceHost: jobUrl.host,
        provider: webProvider.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in scrape-job-posting:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractJobDataFallback(markdown: string, metadata: any): JobPostingData {
  const lines = markdown.split("\n").filter(l => l.trim());
  
  // Try to find title from first heading
  const titleMatch = markdown.match(/^#\s+(.+)/m) || markdown.match(/^##\s+(.+)/m);
  const title = titleMatch?.[1] || metadata.title?.replace(/ - .+$/, "") || "Unknown Position";
  
  // Try to find company name
  const companyPatterns = [
    /(?:at|@)\s+([A-Z][a-zA-Z0-9\s&]+)/,
    /company[:\s]+([A-Z][a-zA-Z0-9\s&]+)/i,
    /([A-Z][a-zA-Z0-9\s&]+)\s+is\s+(?:hiring|looking)/,
  ];
  let company: string | undefined;
  for (const pattern of companyPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      company = match[1].trim();
      break;
    }
  }
  
  // Try to find location
  const locationPatterns = [
    /location[:\s]+([^.\n]+)/i,
    /(remote|hybrid|on-site|onsite)/i,
    /(?:based\s+in|located\s+in)\s+([^.\n,]+)/i,
  ];
  let location: string | undefined;
  for (const pattern of locationPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      location = match[1].trim();
      break;
    }
  }
  
  // Try to find salary
  const salaryMatch = markdown.match(/\$\d{2,3},?\d{3}\s*[-–]\s*\$\d{2,3},?\d{3}/);
  const salaryRange = salaryMatch?.[0];
  
  // Extract requirements (look for bullet points after "requirements" or "qualifications")
  const requirementsSection = markdown.match(/(?:requirements|qualifications)[:\s]*\n((?:[-•*]\s+.+\n?)+)/i);
  const requirements = requirementsSection
    ? requirementsSection[1].split("\n")
        .filter(l => /^[-•*]\s+/.test(l))
        .map(l => l.replace(/^[-•*]\s+/, "").trim())
        .slice(0, 10)
    : [];
  
  // Generate a description from the first paragraph
  const description = lines.find(l => l.length > 100 && !l.startsWith("#"))?.slice(0, 300);
  
  return {
    title: title.slice(0, 100),
    company,
    location,
    salaryRange,
    description,
    requirements,
    responsibilities: [],
    experienceLevel: undefined,
    companyType: undefined,
  };
}
