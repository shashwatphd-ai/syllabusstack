import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getWebProvider } from "../_shared/web-provider.ts";

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

    // Use Lovable AI to extract structured job data
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    let jobData: JobPostingData;
    
    if (OPENAI_API_KEY) {
      // Use AI to extract structured data
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a job posting analyzer. Extract structured information from job postings.
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
}`
            },
            {
              role: "user",
              content: `Extract job information from this posting:\n\n${markdown.slice(0, 8000)}`
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        try {
          jobData = JSON.parse(aiData.choices[0].message.content);
          console.log("AI extracted job data:", jobData.title);
        } catch {
          console.error("Failed to parse AI response");
          jobData = extractJobDataFallback(markdown, metadata);
        }
      } else {
        console.error("AI API error:", aiResponse.status);
        jobData = extractJobDataFallback(markdown, metadata);
      }
    } else {
      // Fallback: basic extraction without AI
      console.log("No OPENAI_API_KEY, using fallback extraction");
      jobData = extractJobDataFallback(markdown, metadata);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: jobData,
        sourceUrl: jobUrl.href,
        sourceHost: jobUrl.host,
        provider: webProvider.name,  // Track which provider was used
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