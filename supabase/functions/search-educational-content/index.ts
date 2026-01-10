import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * UNIFIED EDUCATIONAL CONTENT SEARCH
 *
 * Searches multiple free sources in parallel for educational content:
 * 1. Invidious/Piped (YouTube without quota)
 * 2. Archive.org (Internet Archive)
 * 3. MIT OpenCourseWare
 * 4. Wikimedia Commons
 * 5. Open textbook sources
 */

// Invidious instances (YouTube alternative - NO QUOTA)
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.private.coffee",
  "https://vid.puffyan.us",
  "https://invidious.projectsegfau.lt",
  "https://invidious.protokolla.fi",
  "https://iv.melmac.space",
];

// Piped instances (YouTube alternative - NO QUOTA)
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.tokhmi.xyz",
  "https://api.piped.yt",
  "https://pipedapi.in.projectsegfau.lt",
];

interface ContentResult {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string;
  duration_seconds: number;
  source_type: 'youtube' | 'archive_org' | 'mit_ocw' | 'wikimedia' | 'khan_academy' | 'other';
  channel_name: string;
  view_count?: number;
  published_at?: string;
  quality_score: number;
}

/**
 * Search Invidious (YouTube without quota)
 */
async function searchInvidious(query: string): Promise<ContentResult[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query + ' educational lecture')}&type=video&sort=relevance`,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      return data.slice(0, 15).map((item: any) => ({
        id: item.videoId,
        title: item.title,
        description: item.description || '',
        url: `https://www.youtube.com/watch?v=${item.videoId}`,
        thumbnail_url: item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || '',
        duration_seconds: item.lengthSeconds || 0,
        source_type: 'youtube' as const,
        channel_name: item.author || '',
        view_count: item.viewCount,
        quality_score: 0.7,
      }));
    } catch (e) {
      console.log(`Invidious ${instance} failed:`, e);
      continue;
    }
  }
  return [];
}

/**
 * Search Piped (YouTube without quota)
 */
async function searchPiped(query: string): Promise<ContentResult[]> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(query + ' educational')}&filter=videos`,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      return (data.items || []).slice(0, 15).map((item: any) => {
        const videoId = item.url?.split('/watch?v=')[1] || '';
        return {
          id: videoId,
          title: item.title || '',
          description: item.shortDescription || '',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail_url: item.thumbnail || '',
          duration_seconds: item.duration || 0,
          source_type: 'youtube' as const,
          channel_name: item.uploaderName || '',
          view_count: item.views,
          quality_score: 0.7,
        };
      });
    } catch (e) {
      console.log(`Piped ${instance} failed:`, e);
      continue;
    }
  }
  return [];
}

/**
 * Search Archive.org (Internet Archive)
 * Massive free library of educational content
 */
async function searchArchiveOrg(query: string): Promise<ContentResult[]> {
  try {
    const response = await fetch(
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}+AND+mediatype:(movies)&fl[]=identifier,title,description,downloads,publicdate&rows=15&output=json`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.log('Archive.org search failed:', response.status);
      return [];
    }

    const data = await response.json();
    const docs = data.response?.docs || [];

    return docs.map((item: any) => ({
      id: `archive_${item.identifier}`,
      title: item.title || item.identifier,
      description: item.description || '',
      url: `https://archive.org/details/${item.identifier}`,
      thumbnail_url: `https://archive.org/services/img/${item.identifier}`,
      duration_seconds: 0, // Archive.org doesn't provide duration in search
      source_type: 'archive_org' as const,
      channel_name: 'Internet Archive',
      view_count: item.downloads || 0,
      published_at: item.publicdate,
      quality_score: 0.65,
    }));
  } catch (e) {
    console.error('Archive.org search error:', e);
    return [];
  }
}

/**
 * Search MIT OpenCourseWare via their API
 * High-quality university lectures
 */
async function searchMITOCW(query: string): Promise<ContentResult[]> {
  try {
    // MIT OCW doesn't have a public API, so we'll use their site search via DuckDuckGo
    const searchQuery = `site:ocw.mit.edu ${query} video lecture`;
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return [];

    const html = await response.text();
    const results: ContentResult[] = [];

    // Parse URLs from DuckDuckGo results
    const urlMatches = html.matchAll(/href="([^"]*ocw\.mit\.edu[^"]+)"/g);
    const seenUrls = new Set<string>();

    for (const match of urlMatches) {
      let url = match[1];
      if (url.includes('uddg=')) {
        const decoded = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || '');
        if (decoded && decoded.includes('ocw.mit.edu')) url = decoded;
      }

      if (seenUrls.has(url) || !url.includes('ocw.mit.edu')) continue;
      seenUrls.add(url);

      // Extract course info from URL
      const courseMatch = url.match(/courses\/([^/]+)/);
      const courseId = courseMatch?.[1] || '';

      results.push({
        id: `mit_${courseId}_${results.length}`,
        title: courseId.replace(/-/g, ' ').replace(/\d+-\d+/, '').trim() || 'MIT Course',
        description: 'MIT OpenCourseWare lecture',
        url: url,
        thumbnail_url: 'https://ocw.mit.edu/static_shared/images/ocw_logo_orange.png',
        duration_seconds: 0,
        source_type: 'mit_ocw' as const,
        channel_name: 'MIT OpenCourseWare',
        quality_score: 0.9, // High quality educational content
      });

      if (results.length >= 10) break;
    }

    return results;
  } catch (e) {
    console.error('MIT OCW search error:', e);
    return [];
  }
}

/**
 * Search Wikimedia Commons for educational videos
 */
async function searchWikimedia(query: string): Promise<ContentResult[]> {
  try {
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' filetype:video')}&srnamespace=6&srlimit=10&format=json&origin=*`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const results = data.query?.search || [];

    return results.map((item: any) => {
      const title = item.title.replace('File:', '').replace(/\.[^.]+$/, '');
      return {
        id: `wikimedia_${item.pageid}`,
        title: title,
        description: item.snippet?.replace(/<[^>]*>/g, '') || '',
        url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(item.title)}`,
        thumbnail_url: '',
        duration_seconds: 0,
        source_type: 'wikimedia' as const,
        channel_name: 'Wikimedia Commons',
        quality_score: 0.6,
      };
    });
  } catch (e) {
    console.error('Wikimedia search error:', e);
    return [];
  }
}

/**
 * Score results based on relevance to query
 */
function scoreResult(result: ContentResult, queryWords: string[]): number {
  let score = result.quality_score;
  const titleLower = result.title.toLowerCase();
  const descLower = result.description.toLowerCase();

  // Boost for query word matches
  for (const word of queryWords) {
    if (word.length > 3) {
      if (titleLower.includes(word)) score += 0.1;
      if (descLower.includes(word)) score += 0.05;
    }
  }

  // Boost for educational indicators
  const eduIndicators = ['lecture', 'course', 'tutorial', 'explained', 'introduction', 'learn', 'university', 'professor'];
  for (const indicator of eduIndicators) {
    if (titleLower.includes(indicator) || descLower.includes(indicator)) {
      score += 0.05;
    }
  }

  // Boost for known educational channels
  const eduChannels = ['khan academy', 'mit', 'stanford', 'harvard', 'yale', 'coursera', 'edx', 'crash course', 'ted-ed'];
  const channelLower = result.channel_name.toLowerCase();
  for (const channel of eduChannels) {
    if (channelLower.includes(channel)) {
      score += 0.15;
      break;
    }
  }

  return Math.min(score, 1.0);
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
      query,
      learning_objective_id,
      core_concept,
      search_keywords = [],
      sources = ['invidious', 'piped', 'archive_org', 'mit_ocw'],
      max_results = 20,
    } = await req.json();

    const searchQuery = query || core_concept || '';
    if (!searchQuery) {
      throw new Error("Query or core_concept is required");
    }

    console.log(`Unified search for: "${searchQuery}" across sources: ${sources.join(', ')}`);

    // Run searches in parallel across all sources
    const searchPromises: Promise<ContentResult[]>[] = [];

    if (sources.includes('invidious')) {
      searchPromises.push(searchInvidious(searchQuery).catch(() => []));
    }
    if (sources.includes('piped')) {
      searchPromises.push(searchPiped(searchQuery).catch(() => []));
    }
    if (sources.includes('archive_org')) {
      searchPromises.push(searchArchiveOrg(searchQuery).catch(() => []));
    }
    if (sources.includes('mit_ocw')) {
      searchPromises.push(searchMITOCW(searchQuery).catch(() => []));
    }
    if (sources.includes('wikimedia')) {
      searchPromises.push(searchWikimedia(searchQuery).catch(() => []));
    }

    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();

    console.log(`Found ${flatResults.length} total results from ${sources.length} sources`);

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueResults = flatResults.filter(r => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    // Score and sort results
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scoredResults = uniqueResults.map(r => ({
      ...r,
      quality_score: scoreResult(r, queryWords),
    }));

    scoredResults.sort((a, b) => b.quality_score - a.quality_score);
    const topResults = scoredResults.slice(0, max_results);

    // If learning_objective_id is provided, save results to database
    let savedMatches: any[] = [];
    if (learning_objective_id) {
      for (const result of topResults.slice(0, 6)) {
        try {
          // Check if content already exists
          const { data: existingContent } = await supabaseClient
            .from("content")
            .select("id")
            .eq("source_url", result.url)
            .maybeSingle();

          let contentId: string;
          if (existingContent) {
            contentId = existingContent.id;
          } else {
            // Create new content entry
            const { data: newContent, error: contentError } = await supabaseClient
              .from("content")
              .insert({
                source_type: result.source_type,
                source_id: result.id,
                source_url: result.url,
                title: result.title,
                description: result.description,
                duration_seconds: result.duration_seconds,
                thumbnail_url: result.thumbnail_url,
                channel_name: result.channel_name,
                view_count: result.view_count || 0,
                quality_score: result.quality_score,
                is_available: true,
                last_availability_check: new Date().toISOString(),
                created_by: user.id,
              })
              .select()
              .single();

            if (contentError) {
              console.error("Error saving content:", contentError);
              continue;
            }
            contentId = newContent.id;
          }

          // Create content match
          const autoApprove = result.quality_score >= 0.7;
          const { data: match, error: matchError } = await supabaseClient
            .from("content_matches")
            .upsert({
              learning_objective_id,
              content_id: contentId,
              match_score: result.quality_score,
              ai_reasoning: `Found via unified search (${result.source_type})`,
              status: autoApprove ? "auto_approved" : "pending",
              approved_by: autoApprove ? user.id : null,
              approved_at: autoApprove ? new Date().toISOString() : null,
            }, { onConflict: "learning_objective_id,content_id" })
            .select(`*, content:content_id(*)`)
            .single();

          if (!matchError && match) {
            savedMatches.push(match);
          }
        } catch (e) {
          console.error("Error saving result:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: topResults,
        total_found: uniqueResults.length,
        sources_searched: sources,
        content_matches: savedMatches,
        auto_approved_count: savedMatches.filter(m => m.status === "auto_approved").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in search-educational-content:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
