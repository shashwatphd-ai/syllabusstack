import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { getWebProvider, type SearchResult } from "../_shared/web-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CourseResult {
  title: string;
  provider: string;
  url: string;
  description: string;
  duration?: string;
  rating?: string;
  price?: string;
  isFree?: boolean;
}

// Free platform domains (less likely to have Cloudflare blocking)
const FREE_DOMAINS = [
  'khanacademy.org',
  'ocw.mit.edu',
  'youtube.com',
  'freecodecamp.org',
  'open.edu',
  'edx.org/learn', // Free audit courses
];

// Paid platform domains
const PAID_DOMAINS = [
  'coursera.org',
  'udemy.com',
  'edx.org',
  'linkedin.com/learning',
  'pluralsight.com',
  'skillshare.com',
  'udacity.com',
  'codecademy.com',
];

// Detect if a result is blocked by Cloudflare or bot protection
function isBlockedResult(result: SearchResult): boolean {
  const blockedIndicators = [
    'just a moment',
    'verify you are human',
    'checking your browser',
    'enable javascript',
    'access denied',
    'please wait',
    'captcha',
    'security check',
    'ddos protection',
    'cloudflare',
  ];
  const titleLower = (result.title || '').toLowerCase();
  const descLower = (result.description || '').toLowerCase();
  return blockedIndicators.some(indicator => 
    titleLower.includes(indicator) || descLower.includes(indicator)
  );
}

// Extract course title from URL as fallback
function extractTitleFromUrl(url: string): string {
  const patterns = [
    /\/learn\/([^/?#]+)/,        // coursera.org/learn/python-programming
    /\/course\/([^/?#]+)/,       // udemy.com/course/complete-javascript
    /\/courses\/([^/?#]+)/,      // edx.org/courses/...
    /\/tutorial\/([^/?#]+)/,     // various tutorials
    /\/watch\?v=[^&]+.*[&?].*?([^&=]+)$/, // youtube
    /\/([^/?#]+)\/?$/,           // fallback: last path segment
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1]
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 80);
    }
  }
  return "Online Course";
}

// Extract meaningful search keywords from gap text
function extractSearchKeywords(gapText: string): string {
  const stopWords = new Set([
    'should', 'must', 'need', 'have', 'experience', 'with', 'and', 'or', 
    'the', 'a', 'an', 'in', 'for', 'to', 'of', 'ability', 'understanding',
    'knowledge', 'skills', 'proficiency', 'familiarity', 'strong', 'working',
    'demonstrated', 'proven', 'excellent', 'deep', 'solid', 'good', 'basic',
    'advanced', 'intermediate', 'beginner', 'that', 'this', 'will', 'can',
    'be', 'able', 'using', 'use', 'related', 'relevant', 'including'
  ]);
  
  const words = gapText.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  // Take top 4 meaningful keywords to keep query short
  const uniqueWords = [...new Set(words)];
  return uniqueWords.slice(0, 4).join(' ');
}

// Validate that URL is a valid course page
function isValidCourseUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  // Invalid patterns - PDFs, research papers, blog posts
  const invalidPatterns = [
    '.pdf', '.doc', '.docx', '.ppt', '.pptx',
    '/thesis/', '/research/', '/paper/', '/blog/',
    '/article/', '/news/', '/about/', '/contact/',
    '/terms', '/privacy', '/faq', '/help'
  ];
  
  if (invalidPatterns.some(p => urlLower.includes(p))) {
    return false;
  }
  
  // Valid course platform domains
  const validDomains = [
    ...FREE_DOMAINS,
    ...PAID_DOMAINS,
    'futurelearn.com',
  ];
  
  // Accept if from valid domain
  if (validDomains.some(d => urlLower.includes(d))) {
    return true;
  }
  
  // Also accept URLs with course-related paths
  const coursePatterns = ['/course/', '/learn/', '/courses/', '/class/', '/tutorial/'];
  return coursePatterns.some(p => urlLower.includes(p));
}

// Check if URL is from a free platform
function isFreePlatform(url: string): boolean {
  const urlLower = url.toLowerCase();
  return FREE_DOMAINS.some(d => urlLower.includes(d));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gaps, dreamJobId, dreamJobTitle, freeOnly = false } = await req.json();

    if (!gaps || !Array.isArray(gaps) || gaps.length === 0) {
      return new Response(
        JSON.stringify({ error: "Gaps array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get web provider (firecrawl or jina based on WEB_PROVIDER env var)
    const webProvider = getWebProvider();
    console.log(`Using web provider: ${webProvider.name}`);

    // Check if provider is configured
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const JINA_API_KEY = Deno.env.get("JINA_API_KEY");

    if (webProvider.name === 'firecrawl' && !FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured. Please connect Firecrawl in Settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching courses for ${gaps.length} gaps for job: ${dreamJobTitle}`);

    const allCourses: CourseResult[] = [];
    const searchErrors: string[] = [];
    const blockedUrls: string[] = [];

    // Search for each gap (limit to top 3 priority gaps to manage API calls)
    const gapsToSearch = gaps.slice(0, 3);

    for (const gap of gapsToSearch) {
      const gapText = gap.gap || gap.requirement || gap;
      const keywords = extractSearchKeywords(gapText);
      
      console.log(`Gap: "${gapText.slice(0, 50)}..." -> Keywords: "${keywords}"`);

      // === SEARCH 1: Free Platforms (prioritize - less blocking) ===
      const freeQuery = `${keywords} tutorial site:khanacademy.org OR site:ocw.mit.edu OR site:youtube.com OR site:freecodecamp.org`;
      console.log(`Searching FREE: ${freeQuery}`);
      
      try {
        const freeResults = await webProvider.search(freeQuery, { limit: 4 });
        console.log(`Found ${freeResults.length} FREE results for: ${keywords}`);
        
        for (const result of freeResults) {
          if (!isValidCourseUrl(result.url)) continue;
          if (isBlockedResult(result)) {
            blockedUrls.push(result.url);
            continue;
          }
          
          const course = parseSearchResult(result, true);
          if (!allCourses.some(c => c.url === course.url)) {
            allCourses.push(course);
          }
        }
      } catch (err) {
        console.error(`Free search error: ${err}`);
      }

      // === SEARCH 2: Paid Platforms (unless freeOnly is true) ===
      if (!freeOnly) {
        const paidQuery = `${keywords} online course site:coursera.org OR site:udemy.com OR site:edx.org`;
        console.log(`Searching PAID: ${paidQuery}`);
        
        try {
          const paidResults = await webProvider.search(paidQuery, { limit: 5 });
          console.log(`Found ${paidResults.length} PAID results for: ${keywords}`);
          
          for (const result of paidResults) {
            if (!isValidCourseUrl(result.url)) continue;
            
            // Handle blocked results differently for paid platforms
            if (isBlockedResult(result)) {
              blockedUrls.push(result.url);
              // Try to salvage with URL-based extraction
              const course = salvageBlockedResult(result);
              if (course && !allCourses.some(c => c.url === course.url)) {
                allCourses.push(course);
              }
              continue;
            }
            
            const course = parseSearchResult(result, false);
            if (!allCourses.some(c => c.url === course.url)) {
              allCourses.push(course);
            }
          }
        } catch (err) {
          console.error(`Paid search error: ${err}`);
          searchErrors.push(`Failed to search paid platforms for: ${keywords}`);
        }
      }
    }

    // Sort: Free courses first
    allCourses.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return 0;
    });

    console.log(`Total unique courses found: ${allCourses.length} (${blockedUrls.length} blocked results handled)`);

    // Save courses as recommendations
    if (allCourses.length > 0 && dreamJobId) {
      const recommendationsToInsert = allCourses.slice(0, 12).map((course, index) => {
        const gapIndex = Math.min(index, gapsToSearch.length - 1);
        const gap = gapsToSearch[gapIndex];
        const gapText = typeof gap === 'string' ? gap :
          gap?.gap || gap?.requirement || gap?.job_requirement || gap?.skill ||
          `${dreamJobTitle} skill requirement`;

        return {
          user_id: user.id,
          dream_job_id: dreamJobId,
          title: course.title,
          type: "course",
          description: course.isFree 
            ? `[FREE] ${course.description.slice(0, 450)}`
            : course.description.slice(0, 500),
          provider: course.provider,
          url: course.url,
          duration: course.duration || "Self-paced",
          cost_usd: parseCost(course.price),
          priority: course.isFree 
            ? (index < 2 ? "high" : "medium") 
            : (index < 4 ? "high" : index < 8 ? "medium" : "low"),
          status: "pending",
          gap_addressed: gapText,
          why_this_matters: course.isFree
            ? `This FREE resource addresses a skill gap for your goal of becoming a ${dreamJobTitle}. No financial barrier to start learning ${gapText}.`
            : `This course addresses a skill gap identified for your goal of becoming a ${dreamJobTitle}. Completing it will strengthen your candidacy by developing ${gapText}.`,
        };
      });

      const { error: insertError } = await supabase
        .from("recommendations")
        .insert(recommendationsToInsert);

      if (insertError) {
        console.error("Error saving course recommendations:", insertError);
      } else {
        console.log(`Saved ${recommendationsToInsert.length} course recommendations`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        courses: allCourses,
        gapsSearched: gapsToSearch.length,
        totalFound: allCourses.length,
        freeCount: allCourses.filter(c => c.isFree).length,
        paidCount: allCourses.filter(c => !c.isFree).length,
        provider: webProvider.name,
        blockedCount: blockedUrls.length,
        searchErrors: searchErrors.length > 0 ? searchErrors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in firecrawl-search-courses:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Parse a search result into a CourseResult
function parseSearchResult(result: SearchResult, isFree: boolean): CourseResult {
  let title = result.title || extractTitleFromUrl(result.url);
  
  // Clean up title if it looks like a blocked page title
  if (title.toLowerCase().includes('just a moment') || title.length < 5) {
    title = extractTitleFromUrl(result.url);
  }
  
  const provider = getProviderFromUrl(result.url);
  const description = result.description || extractDescription(result.markdown) || `Learn with ${provider}`;
  
  // Determine price
  let price: string;
  if (isFree || isFreePlatform(result.url)) {
    price = "Free";
  } else {
    price = extractPrice(result.markdown || result.description) || "Check pricing";
  }
  
  return {
    title,
    provider,
    url: result.url,
    description,
    duration: extractDuration(result.markdown || result.description),
    rating: extractRating(result.markdown || result.description),
    price,
    isFree: price === "Free",
  };
}

// Salvage a blocked result by extracting info from URL
function salvageBlockedResult(result: SearchResult): CourseResult | null {
  if (!isValidCourseUrl(result.url)) return null;
  
  const title = extractTitleFromUrl(result.url);
  if (title === "Online Course") return null; // Not useful enough
  
  const provider = getProviderFromUrl(result.url);
  
  return {
    title,
    provider,
    url: result.url,
    description: `${title} on ${provider}`,
    price: provider === "Khan Academy" || provider === "MIT OpenCourseWare" || provider === "freeCodeCamp" 
      ? "Free" 
      : "Check pricing",
    isFree: isFreePlatform(result.url),
  };
}

function getProviderFromUrl(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("coursera.org")) return "Coursera";
  if (urlLower.includes("udemy.com")) return "Udemy";
  if (urlLower.includes("edx.org")) return "edX";
  if (urlLower.includes("linkedin.com/learning")) return "LinkedIn Learning";
  if (urlLower.includes("pluralsight.com")) return "Pluralsight";
  if (urlLower.includes("skillshare.com")) return "Skillshare";
  if (urlLower.includes("udacity.com")) return "Udacity";
  if (urlLower.includes("codecademy.com")) return "Codecademy";
  if (urlLower.includes("khanacademy.org")) return "Khan Academy";
  if (urlLower.includes("ocw.mit.edu")) return "MIT OpenCourseWare";
  if (urlLower.includes("futurelearn.com")) return "FutureLearn";
  if (urlLower.includes("youtube.com")) return "YouTube";
  if (urlLower.includes("freecodecamp.org")) return "freeCodeCamp";
  if (urlLower.includes("open.edu")) return "Open University";
  return "Online Course";
}

function extractDescription(markdown: string): string {
  if (!markdown) return "";
  const lines = markdown.split("\n").filter(l => l.trim().length > 50);
  return lines[0]?.slice(0, 300) || "";
}

function extractDuration(text: string): string | undefined {
  if (!text) return undefined;
  const patterns = [
    /(\d+)\s*hours?/i,
    /(\d+)\s*weeks?/i,
    /(\d+)\s*months?/i,
    /approximately\s+(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

function extractRating(text: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+\.?\d*)\s*(?:\/\s*5|stars?|rating)/i);
  return match ? `${match[1]}/5` : undefined;
}

function extractPrice(text: string): string | undefined {
  if (!text) return undefined;
  if (/free\s*course|enroll\s*for\s*free|free\s*to\s*enroll|free\s*to\s*audit/i.test(text)) return "Free";
  const match = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (match) return `$${match[1]}`;
  return undefined;
}

function parseCost(price: string | undefined): number | null {
  if (!price) return null;
  if (price.toLowerCase() === "free") return 0;
  if (price.toLowerCase() === "check pricing") return null;
  const match = price.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
}
