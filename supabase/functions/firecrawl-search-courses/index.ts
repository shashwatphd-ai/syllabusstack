import { createClient } from "@supabase/supabase-js";
import { getWebProvider, type SearchResult } from "../_shared/web-provider.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

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

// =============================================================================
// GAP NORMALIZATION - Consistent handling of all gap formats
// =============================================================================

interface NormalizedGap {
  text: string;
  priority?: number;
}

/**
 * Extract text from any gap format - handles all known structures
 */
function extractGapText(gap: unknown): string {
  // Handle string input directly
  if (typeof gap === 'string') {
    return gap.trim();
  }

  // Handle null/undefined
  if (!gap || typeof gap !== 'object') {
    return '';
  }

  // Cast to record for property access
  const g = gap as Record<string, unknown>;

  // Try known property names in order of preference
  // This covers:
  // - priority_gaps: { gap, priority, reason }
  // - critical_gaps: { job_requirement, student_status, impact }
  // - various other formats from different parts of the app
  const propertyOrder = [
    'gap',              // priority_gaps primary field
    'job_requirement',  // critical_gaps primary field
    'requirement',      // alternative field
    'skill',            // another alternative
    'text',             // generic text field
    'description',      // fallback description
  ];

  for (const key of propertyOrder) {
    const value = g[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

/**
 * Normalize an array of gaps from any format to consistent structure
 */
function normalizeGaps(gaps: unknown[]): NormalizedGap[] {
  if (!Array.isArray(gaps)) {
    console.warn('[normalizeGaps] Received non-array:', typeof gaps);
    return [];
  }

  const normalized: NormalizedGap[] = [];

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    const text = extractGapText(gap);
    
    if (!text) {
      console.warn(`[normalizeGaps] Skipping gap at index ${i}, no text extracted:`, 
        typeof gap === 'object' ? JSON.stringify(gap).slice(0, 100) : typeof gap);
      continue;
    }

    // Extract priority if available
    let priority: number | undefined;
    if (typeof gap === 'object' && gap !== null) {
      const g = gap as Record<string, unknown>;
      if (typeof g.priority === 'number') {
        priority = g.priority;
      }
    }

    normalized.push({ text, priority: priority ?? i + 1 });
  }

  return normalized;
}

// =============================================================================
// SEARCH KEYWORD EXTRACTION
// =============================================================================

/**
 * Extract meaningful search keywords from gap text
 */
function extractSearchKeywords(gapText: string, maxKeywords = 4): string {
  const stopWords = new Set([
    'should', 'must', 'need', 'have', 'experience', 'with', 'and', 'or', 
    'the', 'a', 'an', 'in', 'for', 'to', 'of', 'ability', 'understanding',
    'knowledge', 'skills', 'proficiency', 'familiarity', 'strong', 'working',
    'demonstrated', 'proven', 'excellent', 'deep', 'solid', 'good', 'basic',
    'advanced', 'intermediate', 'beginner', 'that', 'this', 'will', 'can',
    'be', 'able', 'using', 'use', 'related', 'relevant', 'including',
    'years', 'year', 'months', 'month', 'days', 'day', 'from', 'into',
  ]);
  
  const words = gapText.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  const uniqueWords = [...new Set(words)];
  return uniqueWords.slice(0, maxKeywords).join(' ');
}

// =============================================================================
// PLATFORM CONFIGURATION
// =============================================================================

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

// =============================================================================
// RESULT PROCESSING UTILITIES
// =============================================================================

/**
 * Detect if a result is blocked by Cloudflare or bot protection
 */
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

/**
 * Extract course title from URL as fallback
 */
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

/**
 * Validate that URL is a valid course page
 */
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

/**
 * Check if URL is from a free platform
 */
function isFreePlatform(url: string): boolean {
  const urlLower = url.toLowerCase();
  return FREE_DOMAINS.some(d => urlLower.includes(d));
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

/**
 * Parse a search result into a CourseResult
 */
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

/**
 * Salvage a blocked result by extracting info from URL
 */
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

// =============================================================================
// MAIN HANDLER
// =============================================================================

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { gaps, dreamJobId, dreamJobTitle, freeOnly = false } = await req.json();

    // Normalize and validate gaps using our robust normalization
    const normalizedGaps = normalizeGaps(gaps || []);

    if (normalizedGaps.length === 0) {
      console.error('[firecrawl-search-courses] No valid gaps after normalization');
      console.error('[firecrawl-search-courses] Raw gaps received:', JSON.stringify(gaps).slice(0, 500));
      return createErrorResponse('BAD_REQUEST', corsHeaders, 'No valid skill gaps provided. Please ensure gaps have text content.');
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Authorization required');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Failed to authenticate user');
    }

    // Get web provider (firecrawl or jina based on WEB_PROVIDER env var)
    const webProvider = getWebProvider();
    console.log(`[firecrawl-search-courses] Using web provider: ${webProvider.name}`);

    // Check if provider is configured
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const JINA_API_KEY = Deno.env.get("JINA_API_KEY");

    if (webProvider.name === 'firecrawl' && !FIRECRAWL_API_KEY) {
      console.error("[firecrawl-search-courses] FIRECRAWL_API_KEY not configured");
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Firecrawl not configured. Please connect Firecrawl in Settings.');
    }

    console.log(`[firecrawl-search-courses] Searching courses for ${normalizedGaps.length} gaps for job: ${dreamJobTitle}`);
    console.log(`[firecrawl-search-courses] Normalized gaps:`, normalizedGaps.map(g => g.text.slice(0, 50)).join(' | '));

    const allCourses: CourseResult[] = [];
    const searchErrors: string[] = [];
    const blockedUrls: string[] = [];

    // Search for each gap (limit to top 3 priority gaps to manage API calls)
    const gapsToSearch = normalizedGaps.slice(0, 3);

    for (const gap of gapsToSearch) {
      const gapText = gap.text;
      const keywords = extractSearchKeywords(gapText);
      
      if (!keywords) {
        console.warn(`[firecrawl-search-courses] No keywords extracted from gap: "${gapText.slice(0, 50)}..."`);
        continue;
      }
      
      console.log(`[firecrawl-search-courses] Gap: "${gapText.slice(0, 50)}..." -> Keywords: "${keywords}"`);

      // === SEARCH 1: Free Platforms (prioritize - less blocking) ===
      const freeQuery = `${keywords} tutorial site:khanacademy.org OR site:ocw.mit.edu OR site:youtube.com OR site:freecodecamp.org`;
      console.log(`[firecrawl-search-courses] Searching FREE: ${freeQuery}`);
      
      try {
        const freeResults = await webProvider.search(freeQuery, { limit: 4 });
        console.log(`[firecrawl-search-courses] Found ${freeResults.length} FREE results for: ${keywords}`);
        
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
        console.error(`[firecrawl-search-courses] Free search error:`, err);
        searchErrors.push(`Free search failed for: ${keywords}`);
      }

      // === SEARCH 2: Paid Platforms (unless freeOnly is true) ===
      if (!freeOnly) {
        const paidQuery = `${keywords} online course site:coursera.org OR site:udemy.com OR site:edx.org`;
        console.log(`[firecrawl-search-courses] Searching PAID: ${paidQuery}`);
        
        try {
          const paidResults = await webProvider.search(paidQuery, { limit: 5 });
          console.log(`[firecrawl-search-courses] Found ${paidResults.length} PAID results for: ${keywords}`);
          
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
          console.error(`[firecrawl-search-courses] Paid search error:`, err);
          searchErrors.push(`Paid search failed for: ${keywords}`);
        }
      }
    }

    // Sort: Free courses first
    allCourses.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return 0;
    });

    console.log(`[firecrawl-search-courses] Total unique courses found: ${allCourses.length} (${blockedUrls.length} blocked results handled)`);

    // Save courses as recommendations
    if (allCourses.length > 0 && dreamJobId) {
      const recommendationsToInsert = allCourses.slice(0, 12).map((course, index) => {
        // Get the gap text for this recommendation
        const gapIndex = Math.min(index, gapsToSearch.length - 1);
        const gapText = gapsToSearch[gapIndex]?.text || `${dreamJobTitle} skill requirement`;

        // Determine if price is known (not "Check pricing")
        const priceKnown = course.price !== undefined && 
                          course.price !== null && 
                          course.price.toLowerCase() !== 'check pricing';

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
          price_known: priceKnown,
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
        console.error("[firecrawl-search-courses] Error saving course recommendations:", insertError);
      } else {
        console.log(`[firecrawl-search-courses] Saved ${recommendationsToInsert.length} course recommendations`);
      }
    }

    return createSuccessResponse({
      success: true,
      courses: allCourses,
      gapsSearched: gapsToSearch.length,
      totalFound: allCourses.length,
      freeCount: allCourses.filter(c => c.isFree).length,
      paidCount: allCourses.filter(c => !c.isFree).length,
      provider: webProvider.name,
      blockedCount: blockedUrls.length,
      searchErrors: searchErrors.length > 0 ? searchErrors : undefined,
    }, corsHeaders);
  } catch (error) {
    logError("firecrawl-search-courses", error instanceof Error ? error : new Error(String(error)), { action: "search" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
