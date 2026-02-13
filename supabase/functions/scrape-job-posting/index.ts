import { createClient } from "@supabase/supabase-js";
import { getWebProvider } from "../_shared/web-provider.ts";
import { generateText, MODELS } from "../_shared/unified-ai-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";
import { validateRequest, scrapeJobPostingSchema } from "../_shared/validators/index.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";

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

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    // Rate limit check
    const limits = await getUserLimits(supabase, user.id);
    const rateLimitResult = await checkRateLimit(supabase, user.id, 'scrape-job-posting', limits);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    logInfo('scrape-job-posting', 'authenticated', { userId: user.id });

    const body = await req.json();
    const validation = validateRequest(scrapeJobPostingSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }
    const { url } = validation.data;

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

      const result = await generateText({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        model: MODELS.FAST,
        json: true,
        fallbacks: [MODELS.GEMINI_FLASH],
        logPrefix: '[scrape-job-posting]'
      });

      jobData = JSON.parse(result.content);
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
    logError("scrape-job-posting", error instanceof Error ? error : new Error(String(error)), { action: "scraping" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));

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
