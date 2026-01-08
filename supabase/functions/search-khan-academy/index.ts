import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KhanVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  url: string;
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
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }

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
      max_results = 4
    } = await req.json();
    
    if (!learning_objective_id || !core_concept) {
      throw new Error("learning_objective_id and core_concept are required");
    }

    console.log(`Searching Khan Academy for: ${core_concept}`);

    // Get existing content IDs to avoid duplicates
    const existingVideoIds = new Set<string>();
    const { data: existingMatches } = await supabaseClient
      .from("content_matches")
      .select(`content:content_id(source_id)`)
      .eq("learning_objective_id", learning_objective_id);
    
    existingMatches?.forEach((m: any) => {
      if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
    });

    // Use Firecrawl to search Khan Academy
    const searchQuery = `site:khanacademy.org video ${core_concept} ${search_keywords.slice(0, 2).join(' ')}`;
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 10,
        scrapeOptions: {
          formats: ['markdown'],
        }
      }),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error('Firecrawl search failed:', errorText);
      throw new Error(`Firecrawl search failed: ${firecrawlResponse.status}`);
    }

    const firecrawlData = await firecrawlResponse.json();
    const searchResults = firecrawlData.data || [];
    
    console.log(`Firecrawl found ${searchResults.length} Khan Academy results`);

    // Filter to video pages and fetch oEmbed data
    const khanVideos: KhanVideo[] = [];
    
    for (const result of searchResults) {
      const url = result.url || result.metadata?.sourceURL;
      if (!url || !url.includes('khanacademy.org')) continue;
      
      // Check if it's a video page
      const videoId = extractKhanVideoId(url);
      if (!videoId || existingVideoIds.has(videoId)) continue;
      
      // Fetch oEmbed metadata
      const oembed = await fetchKhanOEmbed(url);
      if (!oembed) continue;
      
      khanVideos.push({
        id: videoId,
        title: oembed.title || result.title || videoId,
        description: result.description || oembed.author_name || '',
        thumbnailUrl: oembed.thumbnail_url || '',
        duration: 0, // oEmbed doesn't provide duration, estimate later
        url: url,
        embedHtml: oembed.html,
      });
      
      // Limit API calls
      if (khanVideos.length >= max_results * 2) break;
    }

    console.log(`Found ${khanVideos.length} valid Khan Academy videos`);

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

    return new Response(
      JSON.stringify({
        success: true,
        source: "khan_academy",
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
