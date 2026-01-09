import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gaps, dreamJobId, dreamJobTitle } = await req.json();

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

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured. Please connect Firecrawl in Settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching courses for ${gaps.length} gaps for job: ${dreamJobTitle}`);

    const allCourses: CourseResult[] = [];

    // Search for each gap (limit to top 3 priority gaps to manage API calls)
    const gapsToSearch = gaps.slice(0, 3);

    for (const gap of gapsToSearch) {
      const gapText = gap.gap || gap.requirement || gap;
      const searchQuery = `${gapText} online course site:coursera.org OR site:udemy.com OR site:edx.org`;
      
      console.log(`Searching: ${searchQuery}`);

      try {
        const response = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 5,
            scrapeOptions: {
              formats: ["markdown"],
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Firecrawl search error for gap "${gapText}":`, response.status, errorText);
          continue;
        }

        const searchData = await response.json();
        console.log(`Found ${searchData.data?.length || 0} results for: ${gapText}`);

        if (searchData.success && searchData.data) {
          for (const result of searchData.data) {
            // Parse course info from search results
            const course: CourseResult = {
              title: result.title || "Untitled Course",
              provider: getProviderFromUrl(result.url),
              url: result.url,
              description: result.description || extractDescription(result.markdown) || "",
              duration: extractDuration(result.markdown || result.description),
              rating: extractRating(result.markdown || result.description),
              price: extractPrice(result.markdown || result.description),
            };

            // Avoid duplicates
            if (!allCourses.some(c => c.url === course.url)) {
              allCourses.push(course);
            }
          }
        }
      } catch (searchError) {
        console.error(`Error searching for gap "${gapText}":`, searchError);
      }
    }

    console.log(`Total unique courses found: ${allCourses.length}`);

    // Save courses as recommendations
    if (allCourses.length > 0 && dreamJobId) {
      const recommendationsToInsert = allCourses.slice(0, 10).map((course, index) => ({
        user_id: user.id,
        dream_job_id: dreamJobId,
        title: course.title,
        type: "course",
        description: course.description.slice(0, 500),
        provider: course.provider,
        url: course.url,
        duration: course.duration || "Self-paced",
        cost_usd: parseCost(course.price),
        priority: index < 3 ? "high" : index < 6 ? "medium" : "low",
        status: "pending",
        gap_addressed: gapsToSearch[Math.min(index, gapsToSearch.length - 1)]?.gap || "Skill gap",
      }));

      // Insert without deleting existing - append to recommendations
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

function getProviderFromUrl(url: string): string {
  if (url.includes("coursera.org")) return "Coursera";
  if (url.includes("udemy.com")) return "Udemy";
  if (url.includes("edx.org")) return "edX";
  if (url.includes("linkedin.com/learning")) return "LinkedIn Learning";
  if (url.includes("pluralsight.com")) return "Pluralsight";
  return "Online Course";
}

function extractDescription(markdown: string): string {
  if (!markdown) return "";
  // Get first meaningful paragraph
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
  if (/free\s*course|enroll\s*for\s*free/i.test(text)) return "Free";
  const match = text.match(/\$(\d+(?:\.\d{2})?)/);
  return match ? `$${match[1]}` : undefined;
}

function parseCost(price: string | undefined): number | null {
  if (!price) return null; // Unknown price, not free
  if (price.toLowerCase() === "free") return 0;
  const match = price.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
}
