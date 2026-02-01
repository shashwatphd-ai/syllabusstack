import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { checkCache, saveToCache, trackApiUsage } from "../_shared/content-cache.ts";
import { getWebProvider } from "../_shared/web-provider.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
} from "../_shared/error-handler.ts";

// Khan Academy GraphQL endpoint (internal API - free, no quota)
const KHAN_GRAPHQL_URL = "https://www.khanacademy.org/api/internal/graphql/ContentForSearchQuery";

// Khan Academy topic tree API (public, always works)
const KHAN_TOPIC_API = "https://www.khanacademy.org/api/v1/topic";

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

// Browser-like headers to avoid 403 errors
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://www.khanacademy.org',
  'Referer': 'https://www.khanacademy.org/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Cache-Control': 'no-cache',
};

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
        ...BROWSER_HEADERS,
        'Content-Type': 'application/json',
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
      headers: BROWSER_HEADERS,
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
 * Search Khan Academy using their public topic tree API
 * This is the most reliable method as it doesn't require authentication
 */
async function searchKhanTopicTree(query: string): Promise<KhanVideo[]> {
  try {
    // Map common educational topics to Khan Academy's topic slugs
    const topicMappings: Record<string, string[]> = {
      'math': ['math', 'algebra', 'geometry', 'calculus', 'statistics'],
      'science': ['science', 'physics', 'chemistry', 'biology'],
      'economics': ['economics-finance-domain', 'microeconomics', 'macroeconomics'],
      'business': ['economics-finance-domain', 'entrepreneurship'],
      'computer': ['computing', 'computer-programming', 'computer-science'],
      'history': ['humanities', 'world-history', 'us-history'],
      'art': ['humanities', 'art-history'],
    };

    const queryLower = query.toLowerCase();
    let topicSlugs: string[] = [];

    // Find matching topics
    for (const [key, slugs] of Object.entries(topicMappings)) {
      if (queryLower.includes(key)) {
        topicSlugs = [...topicSlugs, ...slugs];
      }
    }

    // Default to searching across main subjects
    if (topicSlugs.length === 0) {
      topicSlugs = ['math', 'science', 'economics-finance-domain', 'computing', 'humanities'];
    }

    const videos: KhanVideo[] = [];
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    // Search each topic for matching content
    for (const slug of topicSlugs.slice(0, 3)) { // Limit to 3 topics
      try {
        const topicUrl = `${KHAN_TOPIC_API}/${slug}`;
        const response = await fetch(topicUrl, { headers: BROWSER_HEADERS });

        if (!response.ok) continue;

        const data = await response.json();
        const children = data?.children || data?.child_data || [];

        // Recursively find videos matching the query
        const findVideos = (items: any[], depth: number = 0): void => {
          if (depth > 2) return; // Limit recursion depth

          for (const item of items) {
            if (item.kind === 'Video' && item.title) {
              const titleLower = item.title.toLowerCase();
              const descLower = (item.description || '').toLowerCase();
              const matches = queryWords.some(w => titleLower.includes(w) || descLower.includes(w));

              if (matches) {
                videos.push({
                  id: item.slug || item.id,
                  contentId: item.id,
                  title: item.title,
                  description: item.description || '',
                  thumbnailUrl: item.thumbnail_url || item.image_url || '',
                  duration: item.duration || 0,
                  url: item.url || item.ka_url || `https://www.khanacademy.org/video/${item.slug}`,
                  slug: item.slug,
                  kind: 'Video',
                });
              }
            }

            // Recurse into children
            if (item.children) {
              findVideos(item.children, depth + 1);
            }
          }
        };

        findVideos(children);

        if (videos.length >= 10) break;
      } catch (e) {
        console.log(`Error searching topic ${slug}:`, e);
      }
    }

    console.log(`Khan topic tree found ${videos.length} videos`);
    return videos.slice(0, 10);
  } catch (error) {
    console.error('Khan topic tree search error:', error);
    return [];
  }
}

/**
 * Search using DuckDuckGo as a fallback (no API key needed)
 */
async function searchDuckDuckGo(query: string): Promise<KhanVideo[]> {
  try {
    const searchQuery = `site:khanacademy.org/video ${query}`;
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    const response = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });

    if (!response.ok) {
      console.log(`DuckDuckGo search failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const videos: KhanVideo[] = [];

    // Parse URLs from DuckDuckGo results
    const urlMatches = html.matchAll(/href="([^"]*khanacademy\.org\/(?:video|v)\/[^"]+)"/g);
    const seenUrls = new Set<string>();

    for (const match of urlMatches) {
      let url = match[1];
      // DuckDuckGo wraps URLs, extract the actual URL
      if (url.includes('uddg=')) {
        const decoded = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || '');
        if (decoded) url = decoded;
      }

      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const videoId = extractKhanVideoId(url);
      if (!videoId) continue;

      // Try to get oEmbed data for title
      const oembed = await fetchKhanOEmbed(url);

      videos.push({
        id: videoId,
        contentId: videoId,
        title: oembed?.title || videoId.replace(/-/g, ' '),
        description: oembed?.author_name || 'Khan Academy',
        thumbnailUrl: oembed?.thumbnail_url || '',
        duration: 0,
        url: url,
        slug: videoId,
        kind: 'Video',
        embedHtml: oembed?.html,
      });

      if (videos.length >= 8) break;
    }

    console.log(`DuckDuckGo found ${videos.length} Khan Academy videos`);
    return videos;
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
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
  const corsHeaders = getCorsHeaders(req);
  
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

    // Build search query
    const searchQuery = `${core_concept} ${search_keywords.slice(0, 2).join(' ')}`.trim();
    let khanVideos: KhanVideo[] = [];

    // Step 1: Try GraphQL API first (fastest when it works)
    console.log('Trying Khan GraphQL API...');
    khanVideos = await searchKhanGraphQL(searchQuery, max_results * 2);
    console.log(`GraphQL found ${khanVideos.length} Khan Academy results`);

    // Step 2: Fall back to public search API if GraphQL fails
    if (khanVideos.length === 0) {
      console.log('GraphQL returned no results, trying public search API...');
      khanVideos = await searchKhanPublic(searchQuery);
      console.log(`Public search found ${khanVideos.length} Khan Academy results`);
    }

    // Step 3: Try topic tree API (most reliable, doesn't require auth)
    if (khanVideos.length === 0) {
      console.log('Public search failed, trying topic tree API...');
      khanVideos = await searchKhanTopicTree(searchQuery);
      console.log(`Topic tree found ${khanVideos.length} Khan Academy results`);
    }

    // Step 4: Try DuckDuckGo site search (no API key needed)
    if (khanVideos.length === 0) {
      console.log('Topic tree returned no results, trying DuckDuckGo...');
      khanVideos = await searchDuckDuckGo(searchQuery);
      console.log(`DuckDuckGo found ${khanVideos.length} Khan Academy results`);
    }

    // Step 5: Last resort - use web provider (Firecrawl or Jina) if available
    if (khanVideos.length === 0) {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      const webProvider = getWebProvider();

      // Only try fallback if we have a configured provider
      if (FIRECRAWL_API_KEY || webProvider.name === 'jina') {
        console.log(`Trying ${webProvider.name} fallback...`);
        const siteSearchQuery = `site:khanacademy.org video ${core_concept}`;

        try {
          const searchResults = await webProvider.search(siteSearchQuery, { limit: 10 });

          for (const result of searchResults) {
            const url = result.url;
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
          console.log(`${webProvider.name} found ${khanVideos.length} Khan Academy results`);
        } catch (error) {
          console.error(`${webProvider.name} fallback error:`, error);
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

    // Perform AI evaluation for consistent reasoning display
    let aiEvaluations: Record<string, any> = {};
    if (topVideos.length > 0) {
      try {
        console.log(`[KHAN] Requesting AI evaluation for ${topVideos.length} videos`);
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        
        const evalResponse = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-content-batch`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            learning_objective: {
              id: learning_objective_id,
              text: lo_text || core_concept,
              core_concept: core_concept,
            },
            videos: topVideos.map(v => ({
              video_id: v.video.id,
              title: v.video.title,
              description: v.video.description,
              channel_name: "Khan Academy",
              duration_seconds: v.video.duration || 600,
            })),
          }),
        });

        if (evalResponse.ok) {
          const evalData = await evalResponse.json();
          if (evalData.evaluations) {
            for (const e of evalData.evaluations) {
              aiEvaluations[e.video_id] = e;
            }
            console.log(`[KHAN] AI evaluation complete for ${evalData.evaluations.length} videos`);
          }
        }
      } catch (evalError) {
        console.log(`[KHAN] AI evaluation error:`, evalError);
      }
    }

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

      // Get AI evaluation for this video
      const aiEval = aiEvaluations[candidate.video.id];
      
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
          ai_reasoning: aiEval?.reasoning || "Khan Academy - trusted educational source with high-quality curated content",
          ai_recommendation: aiEval?.recommendation || (autoApprove ? "highly_recommended" : "recommended"),
          ai_concern: aiEval?.concern || null,
          ai_relevance_score: aiEval?.relevance_score ?? null,
          ai_pedagogy_score: aiEval?.pedagogy_score ?? null,
          ai_quality_score: aiEval?.quality_score ?? null,
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
