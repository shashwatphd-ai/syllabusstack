import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { checkCache, saveToCache, trackApiUsage } from "../_shared/content-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Khan Academy GraphQL endpoint (internal API - free, no quota)
const KHAN_GRAPHQL_URL = "https://www.khanacademy.org/api/internal/graphql/ContentForSearchQuery";

interface KhanVideo {
  id: string;
  contentId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  url: string;
  slug: string;
  kind: string;
  embedHtml?: string;
}

interface ScoredKhanContent {
  video: KhanVideo;
  scores: {
    semantic_similarity: number;
    channel_authority: number;
    total: number;
  };
}

/**
 * Search Khan Academy using their internal GraphQL API
 * This is the same API their website uses - free and no quota limits
 */
async function searchKhanGraphQL(query: string, limit: number = 10): Promise<KhanVideo[]> {
  const graphqlQuery = {
    operationName: "ContentForSearchQuery",
    variables: {
      query: query,
      first: limit,
      contentKinds: ["Video", "Article", "Exercise"],
    },
    query: `
      query ContentForSearchQuery($query: String!, $first: Int, $contentKinds: [ContentKind!]) {
        searchContent(query: $query, first: $first, filters: {contentKinds: $contentKinds}) {
          edges {
            node {
              ... on Video {
                id
                contentId
                title
                description
                slug
                kind
                duration
                thumbnailUrl
                url
                ka_url: url
              }
              ... on Article {
                id
                contentId
                title
                description
                slug
                kind
                url
                ka_url: url
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `
  };

  try {
    const response = await fetch(KHAN_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // These headers help bypass CORS and auth requirements
        'Origin': 'https://www.khanacademy.org',
        'Referer': 'https://www.khanacademy.org/',
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) {
      console.log(`Khan GraphQL request failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const edges = data?.data?.searchContent?.edges || [];

    return edges
      .map((edge: any) => edge.node)
      .filter((node: any) => node && node.title)
      .map((node: any) => ({
        id: node.slug || node.id,
        contentId: node.contentId || node.id,
        title: node.title,
        description: node.description || '',
        thumbnailUrl: node.thumbnailUrl || `https://img.youtube.com/vi/${node.slug}/hqdefault.jpg`,
        duration: node.duration || 0,
        url: node.ka_url || node.url || `https://www.khanacademy.org/video/${node.slug}`,
        slug: node.slug,
        kind: node.kind,
      }));
  } catch (error) {
    console.error('Khan GraphQL search error:', error);
    return [];
  }
}

/**
 * Alternative: Search using Khan Academy's public search URL
 * Falls back to this if GraphQL fails
 */
async function searchKhanPublic(query: string): Promise<KhanVideo[]> {
  try {
    // Use Khan Academy's search suggestions API
    const searchUrl = `https://www.khanacademy.org/api/internal/_search?query=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.log(`Khan public search failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results = data?.results || data?.hits || [];

    return results
      .filter((r: any) => r.kind === 'Video' || r.type === 'video')
      .slice(0, 10)
      .map((r: any) => ({
        id: r.slug || r.id,
        contentId: r.id,
        title: r.title,
        description: r.description || '',
        thumbnailUrl: r.thumbnail_url || r.thumbnailUrl || '',
        duration: r.duration || 0,
        url: r.url || r.ka_url || `https://www.khanacademy.org${r.relative_url || `/video/${r.slug}`}`,
        slug: r.slug,
        kind: r.kind || 'Video',
      }));
  } catch (error) {
    console.error('Khan public search error:', error);
    return [];
  }
}

/**
 * Fetch Khan Academy oEmbed data for a video URL
 */
async function fetchKhanOEmbed(videoUrl: string): Promise<any | null> {
  try {
    const oembedUrl = `https://www.khanacademy.org/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const response = await fetch(oembedUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log(`oEmbed failed for ${videoUrl}: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching oEmbed for ${videoUrl}:`, error);
    return null;
  }
}

/**
 * Extract video slug/ID from Khan Academy URL
 */
function extractKhanVideoId(url: string): string | null {
  // Patterns: /video/slug, /v/slug, /embed_video?v=ID
  const patterns = [
    /khanacademy\.org\/(?:video|v)\/([^/?#]+)/,
    /khanacademy\.org\/embed_video\?v=([^&]+)/,
    /khanacademy\.org\/.*\/v\/([^/?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Calculate semantic similarity between search query and video content
 */
function calculateSemanticSimilarity(videoText: string, searchTerms: string[]): number {
  const videoLower = videoText.toLowerCase();
  let matchCount = 0;
  
  for (const term of searchTerms) {
    if (term && term.length > 2 && videoLower.includes(term.toLowerCase())) {
      matchCount++;
    }
  }
  
  return Math.min(matchCount / Math.max(searchTerms.length, 1), 1.0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const {
      learning_objective_id,
      core_concept,
      search_keywords = [],
      lo_text,
      max_results = 4,
      skip_cache = false
    } = await req.json();

    if (!learning_objective_id || !core_concept) {
      throw new Error("learning_objective_id and core_concept are required");
    }

    console.log(`Searching Khan Academy for: ${core_concept}`);

    // Build search concept for caching
    const searchConcept = lo_text || core_concept;

    // Step 0: Check cache first (unless explicitly skipped)
    if (!skip_cache) {
      const cacheResult = await checkCache(searchConcept, 'khan_academy');

      if (cacheResult.found && cacheResult.results.length > 0) {
        console.log(`Khan Academy cache HIT for: "${searchConcept.substring(0, 50)}..."`);

        // Use cached results
        const cachedVideos = cacheResult.results.slice(0, max_results);
        const savedMatches = [];

        for (const video of cachedVideos) {
          let contentId: string;

          const { data: existingContent } = await supabaseClient
            .from("content")
            .select("id")
            .eq("source_id", video.id)
            .eq("source_type", "khan_academy")
            .maybeSingle();

          if (existingContent) {
            contentId = existingContent.id;
          } else {
            const { data: newContent, error: contentError } = await supabaseClient
              .from("content")
              .insert({
                source_type: "khan_academy",
                source_id: video.id,
                source_url: video.url,
                title: video.title,
                description: video.description,
                duration_seconds: 600, // Default estimate
                thumbnail_url: video.thumbnail_url,
                channel_name: "Khan Academy",
                channel_id: "khan_academy",
                quality_score: 0.85,
                is_available: true,
                last_availability_check: new Date().toISOString(),
                created_by: user.id,
              })
              .select()
              .single();

            if (contentError) {
              console.error("Error saving cached Khan content:", contentError);
              continue;
            }
            contentId = newContent.id;
          }

          const { data: match, error: matchError } = await supabaseClient
            .from("content_matches")
            .upsert({
              learning_objective_id,
              content_id: contentId,
              match_score: 0.85,
              ai_reasoning: "Khan Academy - trusted educational source (cached)",
              ai_recommendation: "highly_recommended",
              status: "auto_approved",
              approved_by: user.id,
              approved_at: new Date().toISOString(),
            }, { onConflict: "learning_objective_id,content_id" })
            .select(`*, content:content_id(*)`)
            .single();

          if (!matchError && match) {
            savedMatches.push(match);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            source: "khan_academy",
            cached: true,
            cache_source: cacheResult.source,
            content_matches: savedMatches,
            total_found: cachedVideos.length,
            auto_approved_count: savedMatches.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Khan Academy cache MISS - proceeding with API search`);

    // Get existing content IDs to avoid duplicates
    const existingVideoIds = new Set<string>();
    const { data: existingMatches } = await supabaseClient
      .from("content_matches")
      .select(`content:content_id(source_id)`)
      .eq("learning_objective_id", learning_objective_id);

    existingMatches?.forEach((m: any) => {
      if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
    });

    // Step 1: Try GraphQL API first (fastest, most reliable)
    const searchQuery = `${core_concept} ${search_keywords.slice(0, 2).join(' ')}`.trim();
    let khanVideos: KhanVideo[] = await searchKhanGraphQL(searchQuery, max_results * 2);

    console.log(`GraphQL found ${khanVideos.length} Khan Academy results`);

    // Step 2: Fall back to public search API if GraphQL fails
    if (khanVideos.length === 0) {
      console.log('GraphQL returned no results, trying public search API...');
      khanVideos = await searchKhanPublic(searchQuery);
      console.log(`Public search found ${khanVideos.length} Khan Academy results`);
    }

    // Step 3: Last resort - use Firecrawl if available
    if (khanVideos.length === 0) {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (FIRECRAWL_API_KEY) {
        console.log('Trying Firecrawl fallback...');
        const firecrawlQuery = `site:khanacademy.org video ${core_concept}`;

        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: firecrawlQuery,
            limit: 10,
            scrapeOptions: { formats: ['markdown'] }
          }),
        });

        if (firecrawlResponse.ok) {
          const firecrawlData = await firecrawlResponse.json();
          const searchResults = firecrawlData.data || [];

          for (const result of searchResults) {
            const url = result.url || result.metadata?.sourceURL;
            if (!url || !url.includes('khanacademy.org')) continue;

            const videoId = extractKhanVideoId(url);
            if (!videoId || existingVideoIds.has(videoId)) continue;

            const oembed = await fetchKhanOEmbed(url);
            if (!oembed) continue;

            khanVideos.push({
              id: videoId,
              contentId: videoId,
              title: oembed.title || result.title || videoId,
              description: result.description || oembed.author_name || '',
              thumbnailUrl: oembed.thumbnail_url || '',
              duration: 0,
              url: url,
              slug: videoId,
              kind: 'Video',
              embedHtml: oembed.html,
            });

            if (khanVideos.length >= max_results * 2) break;
          }
          console.log(`Firecrawl found ${khanVideos.length} Khan Academy results`);
        }
      }
    }

    // Filter out already matched videos
    khanVideos = khanVideos.filter(v => !existingVideoIds.has(v.id));

    console.log(`Found ${khanVideos.length} valid Khan Academy videos after filtering`);

    // Score the videos
    const searchTerms = [core_concept, ...search_keywords, ...(lo_text?.split(/\s+/) || [])].filter(Boolean);
    
    const scoredVideos: ScoredKhanContent[] = khanVideos.map(video => {
      const semanticSimilarity = calculateSemanticSimilarity(
        `${video.title} ${video.description}`,
        searchTerms
      );
      // Khan Academy always gets high authority score
      const channelAuthority = 0.95;
      const total = semanticSimilarity * 0.6 + channelAuthority * 0.4;
      
      return {
        video,
        scores: {
          semantic_similarity: Math.round(semanticSimilarity * 100) / 100,
          channel_authority: channelAuthority,
          total: Math.round(total * 100) / 100,
        }
      };
    });

    // Sort and limit
    scoredVideos.sort((a, b) => b.scores.total - a.scores.total);
    const topVideos = scoredVideos.slice(0, max_results);

    // Save to database
    const savedMatches = [];
    
    for (const candidate of topVideos) {
      let contentId: string;
      
      const { data: existingContent } = await supabaseClient
        .from("content")
        .select("id")
        .eq("source_id", candidate.video.id)
        .eq("source_type", "khan_academy")
        .maybeSingle();

      if (existingContent) {
        contentId = existingContent.id;
      } else {
        const { data: newContent, error: contentError } = await supabaseClient
          .from("content")
          .insert({
            source_type: "khan_academy",
            source_id: candidate.video.id,
            source_url: candidate.video.url,
            title: candidate.video.title,
            description: candidate.video.description,
            duration_seconds: candidate.video.duration || 600, // Default 10 min estimate
            thumbnail_url: candidate.video.thumbnailUrl,
            channel_name: "Khan Academy",
            channel_id: "khan_academy",
            view_count: 0,
            like_count: 0,
            quality_score: candidate.scores.total,
            is_available: true,
            last_availability_check: new Date().toISOString(),
            created_by: user.id,
          })
          .select()
          .single();

        if (contentError) {
          console.error("Error saving Khan content:", contentError);
          continue;
        }
        contentId = newContent.id;
      }

      // Khan Academy videos auto-approve with lower threshold due to trusted source
      const autoApprove = candidate.scores.total >= 0.45;
      
      const { data: match, error: matchError } = await supabaseClient
        .from("content_matches")
        .upsert({
          learning_objective_id,
          content_id: contentId,
          match_score: candidate.scores.total,
          semantic_similarity_score: candidate.scores.semantic_similarity,
          channel_authority_score: candidate.scores.channel_authority,
          ai_reasoning: "Khan Academy - trusted educational source",
          ai_recommendation: autoApprove ? "highly_recommended" : "recommended",
          status: autoApprove ? "auto_approved" : "pending",
          approved_by: autoApprove ? user.id : null,
          approved_at: autoApprove ? new Date().toISOString() : null,
        }, { onConflict: "learning_objective_id,content_id" })
        .select(`
          *,
          content:content_id(*)
        `)
        .single();

      if (matchError) {
        console.error("Error saving Khan content match:", matchError);
      } else {
        savedMatches.push(match);
      }
    }

    console.log(`Saved ${savedMatches.length} Khan Academy content matches`);

    // Save results to cache for future searches
    if (topVideos.length > 0) {
      const cacheableResults = topVideos.map(candidate => ({
        id: candidate.video.id,
        title: candidate.video.title,
        description: candidate.video.description,
        url: candidate.video.url,
        thumbnail_url: candidate.video.thumbnailUrl,
        duration: `PT${Math.floor((candidate.video.duration || 600) / 60)}M`,
        channel_title: 'Khan Academy',
        source: 'khan_academy' as const,
      }));

      try {
        await saveToCache(searchConcept, cacheableResults, 'khan_academy');
        console.log(`Cached ${cacheableResults.length} Khan Academy results for: "${searchConcept.substring(0, 50)}..."`);
      } catch (cacheError) {
        console.error('Error saving to cache:', cacheError);
      }
    }

    // Track Khan Academy API usage (free, but good to monitor)
    try {
      await trackApiUsage('khan_academy', 1);
    } catch (e) {
      // Non-blocking
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: "khan_academy",
        cached: false,
        content_matches: savedMatches,
        total_found: khanVideos.length,
        auto_approved_count: savedMatches.filter((m) => m.status === "auto_approved").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in search-khan-academy:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
