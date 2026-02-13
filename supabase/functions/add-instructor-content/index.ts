import { createClient } from "@supabase/supabase-js";
import { enrichVideoMetadata, YouTubeSearchResult } from "../_shared/youtube-search/index.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { validateRequest, addInstructorContentSchema } from "../_shared/validators/index.ts";

/**
 * ADD INSTRUCTOR CONTENT
 *
 * Allows instructors to add custom content links to learning objectives.
 * Automatically detects content type and extracts metadata from various sources:
 * - YouTube (via orchestrator's metadata enricher - oEmbed + Invidious + Firecrawl)
 * - Vimeo (via oEmbed)
 * - Archive.org
 * - Khan Academy
 * - MIT OpenCourseWare
 * - Generic URLs (via Open Graph / meta tags)
 */

interface ContentMetadata {
  title: string;
  description: string;
  thumbnail_url: string;
  duration_seconds: number;
  channel_name: string;
  source_type: string;
  source_id: string;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract Vimeo video ID
 */
function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract Archive.org identifier
 */
function extractArchiveId(url: string): string | null {
  const match = url.match(/archive\.org\/details\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Extract Khan Academy content info
 */
function extractKhanInfo(url: string): { slug: string; type: string } | null {
  // Video: /video/video-slug or /v/video-slug
  const videoMatch = url.match(/khanacademy\.org\/(?:video|v)\/([^/?]+)/);
  if (videoMatch) return { slug: videoMatch[1], type: 'video' };

  // Article or exercise
  const contentMatch = url.match(/khanacademy\.org\/[^/]+\/[^/]+\/([^/]+)\/([^/?]+)/);
  if (contentMatch) return { slug: contentMatch[2], type: contentMatch[1] };

  return null;
}

/**
 * Get YouTube metadata using the orchestrator's metadata enricher
 * This uses the shared pipeline: oEmbed → Invidious → Firecrawl
 */
async function getYouTubeMetadata(videoId: string): Promise<ContentMetadata | null> {
  console.log(`Using orchestrator metadata enricher for video: ${videoId}`);

  try {
    // Create a minimal video object for the enricher
    const videoStub: YouTubeSearchResult = {
      video_id: videoId,
      title: '',
      description: '',
      channel_name: '',
      channel_id: '',
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      duration_seconds: 0,
      view_count: 0,
      source: 'manual',
      metadata_complete: false,
    };

    // Use the orchestrator's enricher for multi-source metadata extraction
    const enriched = await enrichVideoMetadata(videoStub, {
      useOEmbed: true,
      useInvidious: true,
      useFirecrawl: true, // Allow Firecrawl for single video enrichment
    });

    if (enriched.title || enriched.channel_name) {
      console.log(`Orchestrator enricher SUCCESS for video ${videoId}`);
      return {
        title: enriched.title || '',
        description: enriched.description || '',
        thumbnail_url: enriched.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration_seconds: enriched.duration_seconds || 0,
        channel_name: enriched.channel_name || '',
        source_type: 'youtube',
        source_id: videoId,
      };
    }

    console.log(`Orchestrator enricher returned incomplete data for ${videoId}`);
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`Orchestrator metadata enricher failed: ${errorMsg}`);
    return null;
  }
}

/**
 * Get Vimeo metadata via oEmbed
 */
async function getVimeoMetadata(videoId: string): Promise<ContentMetadata | null> {
  try {
    const response = await fetch(
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      title: data.title || '',
      description: data.description || '',
      thumbnail_url: data.thumbnail_url || '',
      duration_seconds: data.duration || 0,
      channel_name: data.author_name || '',
      source_type: 'vimeo',
      source_id: videoId,
    };
  } catch (e) {
    console.error('Vimeo metadata error:', e);
    return null;
  }
}

/**
 * Get Archive.org metadata
 */
async function getArchiveMetadata(identifier: string): Promise<ContentMetadata | null> {
  try {
    const response = await fetch(
      `https://archive.org/metadata/${identifier}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const metadata = data.metadata || {};

    // Try to get duration from files
    let duration = 0;
    const files = data.files || [];
    const videoFile = files.find((f: any) =>
      f.format?.toLowerCase().includes('mp4') ||
      f.format?.toLowerCase().includes('video')
    );
    if (videoFile?.length) {
      const parts = videoFile.length.split(':');
      if (parts.length === 3) {
        duration = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      } else if (parts.length === 2) {
        duration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    }

    return {
      title: metadata.title || identifier,
      description: metadata.description || '',
      thumbnail_url: `https://archive.org/services/img/${identifier}`,
      duration_seconds: duration,
      channel_name: metadata.creator || metadata.uploader || 'Internet Archive',
      source_type: 'archive_org',
      source_id: identifier,
    };
  } catch (e) {
    console.error('Archive.org metadata error:', e);
    return null;
  }
}

/**
 * Get Khan Academy metadata
 */
async function getKhanMetadata(slug: string, type: string): Promise<ContentMetadata | null> {
  try {
    // Try the content API
    const response = await fetch(
      `https://www.khanacademy.org/api/v1/videos/${slug}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || slug,
        description: data.description || '',
        thumbnail_url: data.image_url || data.thumbnail_url || '',
        duration_seconds: data.duration || 0,
        channel_name: 'Khan Academy',
        source_type: 'khan_academy',
        source_id: data.id || slug,
      };
    }
  } catch (e) {
    console.log('Khan Academy API failed:', e);
  }

  // Fallback: return basic info
  return {
    title: slug.replace(/-/g, ' '),
    description: `Khan Academy ${type}`,
    thumbnail_url: '',
    duration_seconds: 0,
    channel_name: 'Khan Academy',
    source_type: 'khan_academy',
    source_id: slug,
  };
}

/**
 * Get generic URL metadata via Open Graph / HTML meta tags
 */
async function getGenericMetadata(url: string): Promise<ContentMetadata | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Extract Open Graph and meta tags
    const getMetaContent = (property: string): string => {
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      const metaMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
      if (metaMatch) return metaMatch[1];

      return '';
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = getMetaContent('title') || (titleMatch ? titleMatch[1].trim() : '');

    // Try to extract duration from schema.org data
    let duration = 0;
    const durationMatch = html.match(/"duration":\s*"PT(\d+)M(\d+)?S?"/i);
    if (durationMatch) {
      duration = parseInt(durationMatch[1]) * 60 + (parseInt(durationMatch[2]) || 0);
    }

    // Determine source type from URL
    let sourceType = 'other';
    if (url.includes('ocw.mit.edu')) sourceType = 'mit_ocw';
    else if (url.includes('coursera.org')) sourceType = 'coursera';
    else if (url.includes('edx.org')) sourceType = 'edx';
    else if (url.includes('commons.wikimedia.org')) sourceType = 'wikimedia';

    return {
      title: title,
      description: getMetaContent('description'),
      thumbnail_url: getMetaContent('image'),
      duration_seconds: duration,
      channel_name: getMetaContent('site_name') || new URL(url).hostname,
      source_type: sourceType,
      source_id: url,
    };
  } catch (e) {
    console.error('Generic metadata extraction error:', e);
    return null;
  }
}

/**
 * Main metadata extraction function - detects source type and extracts
 */
async function extractMetadata(url: string): Promise<ContentMetadata | null> {
  // YouTube
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    console.log(`Detected YouTube video: ${youtubeId}`);
    return getYouTubeMetadata(youtubeId);
  }

  // Vimeo
  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    console.log(`Detected Vimeo video: ${vimeoId}`);
    return getVimeoMetadata(vimeoId);
  }

  // Archive.org
  const archiveId = extractArchiveId(url);
  if (archiveId) {
    console.log(`Detected Archive.org: ${archiveId}`);
    return getArchiveMetadata(archiveId);
  }

  // Khan Academy
  const khanInfo = extractKhanInfo(url);
  if (khanInfo) {
    console.log(`Detected Khan Academy: ${khanInfo.slug}`);
    return getKhanMetadata(khanInfo.slug, khanInfo.type);
  }

  // Generic URL - try to extract metadata from HTML
  console.log('Attempting generic metadata extraction');
  return getGenericMetadata(url);
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
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

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(addInstructorContentSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }

    const {
      url,
      learning_objective_id,
      custom_title,
      custom_description,
      auto_approve,
    } = validation.data;

    console.log(`Extracting metadata for: ${url}`);

    // Extract metadata from URL
    const metadata = await extractMetadata(url);

    if (!metadata) {
      // Even if extraction fails, allow manual entry
      console.log('Metadata extraction failed, using URL as fallback');
    }

    const finalMetadata = {
      title: custom_title || metadata?.title || url,
      description: custom_description || metadata?.description || '',
      thumbnail_url: metadata?.thumbnail_url || '',
      duration_seconds: metadata?.duration_seconds || 0,
      channel_name: metadata?.channel_name || '',
      source_type: metadata?.source_type || 'other',
      source_id: metadata?.source_id || url,
    };

    // Check if content already exists
    const { data: existingContent } = await supabaseClient
      .from("content")
      .select("id")
      .eq("source_url", url)
      .maybeSingle();

    let contentId: string;

    if (existingContent) {
      contentId = existingContent.id;
      console.log(`Content already exists: ${contentId}`);
    } else {
      // Create new content entry
      const { data: newContent, error: contentError } = await supabaseClient
        .from("content")
        .insert({
          source_type: finalMetadata.source_type,
          source_id: finalMetadata.source_id,
          source_url: url,
          title: finalMetadata.title,
          description: finalMetadata.description,
          duration_seconds: finalMetadata.duration_seconds,
          thumbnail_url: finalMetadata.thumbnail_url,
          channel_name: finalMetadata.channel_name,
          quality_score: 0.8, // Instructor-added content gets high base score
          is_available: true,
          last_availability_check: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (contentError) {
        console.error("Error saving content:", contentError);
        throw new Error(`Failed to save content: ${contentError.message}`);
      }

      contentId = newContent.id;
      console.log(`Created new content: ${contentId}`);
    }

    // If learning_objective_id provided, create content match with AI evaluation
    let contentMatch = null;
    if (learning_objective_id) {
      // Fetch learning objective details for AI evaluation
      const { data: loData } = await supabaseClient
        .from("learning_objectives")
        .select("text, bloom_level, core_concept, action_verb, expected_duration_minutes")
        .eq("id", learning_objective_id)
        .single();

      // Perform AI evaluation for consistent reasoning display
      let aiEvaluation = null;
      if (loData?.text) {
        try {
          console.log(`[INSTRUCTOR CONTENT] Requesting AI evaluation for: ${finalMetadata.title}`);
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
                text: loData.text,
                bloom_level: loData.bloom_level,
                core_concept: loData.core_concept,
                action_verb: loData.action_verb,
                expected_duration_minutes: loData.expected_duration_minutes,
              },
              videos: [{
                video_id: finalMetadata.source_id,
                title: finalMetadata.title,
                description: finalMetadata.description,
                channel_name: finalMetadata.channel_name,
                duration_seconds: finalMetadata.duration_seconds,
              }],
            }),
          });

          if (evalResponse.ok) {
            const evalData = await evalResponse.json();
            if (evalData.evaluations && evalData.evaluations.length > 0) {
              aiEvaluation = evalData.evaluations[0];
              console.log(`[INSTRUCTOR CONTENT] AI evaluation: ${aiEvaluation.recommendation}`);
            }
          }
        } catch (evalError) {
          console.log(`[INSTRUCTOR CONTENT] AI evaluation error:`, evalError);
        }
      }

      // Build match data with AI evaluation results
      const matchData: Record<string, unknown> = {
        learning_objective_id,
        content_id: contentId,
        match_score: 0.95, // High score for instructor-added content
        ai_reasoning: aiEvaluation?.reasoning || 'Manually added by instructor',
        ai_recommendation: aiEvaluation?.recommendation || 'highly_recommended',
        ai_concern: aiEvaluation?.concern || null,
        ai_relevance_score: aiEvaluation?.relevance_score ?? null,
        ai_pedagogy_score: aiEvaluation?.pedagogy_score ?? null,
        ai_quality_score: aiEvaluation?.quality_score ?? null,
        status: auto_approve ? "approved" : "pending",
        approved_by: auto_approve ? user.id : null,
        approved_at: auto_approve ? new Date().toISOString() : null,
      };

      // Update match_score if AI provided scores
      if (aiEvaluation?.relevance_score != null) {
        const aiScore = (
          (aiEvaluation.relevance_score || 0) * 0.4 +
          (aiEvaluation.pedagogy_score || 0) * 0.35 +
          (aiEvaluation.quality_score || 0) * 0.25
        ) / 100;
        matchData.match_score = Math.round(aiScore * 100) / 100;
      }

      const { data: match, error: matchError } = await supabaseClient
        .from("content_matches")
        .upsert(matchData, { onConflict: "learning_objective_id,content_id" })
        .select(`*, content:content_id(*)`)
        .single();

      if (matchError) {
        console.error("Error creating content match:", matchError);
      } else {
        contentMatch = match;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        content_id: contentId,
        metadata: finalMetadata,
        content_match: contentMatch,
        message: learning_objective_id
          ? `Content added and linked to learning objective`
          : `Content added successfully`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in add-instructor-content:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
