import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ADD INSTRUCTOR CONTENT
 *
 * Allows instructors to add custom content links to learning objectives.
 * Automatically detects content type and extracts metadata from various sources:
 * - YouTube (via oEmbed + Invidious)
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

// Invidious instances for YouTube metadata extraction
// Updated Jan 2026 - inv.nadeko.net has multiple backends and is most resilient
// Note: Google actively blocks Invidious instances, so they may go up/down
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",           // Most resilient - multi-backend architecture
  "https://yewtu.be",                 // Long-standing, Germany-based
  "https://invidious.private.coffee", // Good backup
  "https://vid.puffyan.us",           // US-based
];

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
 * Get YouTube metadata via Invidious (no quota)
 * Note: Google actively blocks Invidious, so instances may fail frequently
 */
async function getYouTubeMetadata(videoId: string): Promise<ContentMetadata | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious instance for metadata: ${instance}`);
      const response = await fetch(
        `${instance}/api/v1/videos/${videoId}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) {
        console.log(`Invidious ${instance} returned status ${response.status}`);
        continue;
      }

      // Check content-type to avoid parsing HTML as JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.log(`Invidious ${instance} returned non-JSON content-type: ${contentType}`);
        continue;
      }

      const text = await response.text();

      // Double-check it's not HTML
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.log(`Invidious ${instance} returned HTML instead of JSON`);
        continue;
      }

      const data = JSON.parse(text);

      console.log(`Invidious ${instance} SUCCESS for video ${videoId}`);
      return {
        title: data.title || '',
        description: data.description || '',
        thumbnail_url: data.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url ||
                       `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration_seconds: data.lengthSeconds || 0,
        channel_name: data.author || '',
        source_type: 'youtube',
        source_id: videoId,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(`Invidious ${instance} failed: ${errorMsg}`);
      continue;
    }
  }

  console.log('All Invidious instances failed, trying YouTube oEmbed fallback...');

  // Fallback to YouTube oEmbed (limited info but reliable)
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`YouTube oEmbed SUCCESS for video ${videoId}`);
      return {
        title: data.title || '',
        description: '',
        thumbnail_url: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration_seconds: 0,
        channel_name: data.author_name || '',
        source_type: 'youtube',
        source_id: videoId,
      };
    } else {
      console.log(`YouTube oEmbed returned status ${response.status}`);
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log(`YouTube oEmbed failed: ${errorMsg}`);
  }

  return null;
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
      url,
      learning_objective_id,
      custom_title,       // Optional: override extracted title
      custom_description, // Optional: override extracted description
      auto_approve = true,
    } = await req.json();

    if (!url) {
      throw new Error("URL is required");
    }

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

    // If learning_objective_id provided, create content match
    let contentMatch = null;
    if (learning_objective_id) {
      const { data: match, error: matchError } = await supabaseClient
        .from("content_matches")
        .upsert({
          learning_objective_id,
          content_id: contentId,
          match_score: 0.95, // High score for instructor-added content
          ai_reasoning: 'Manually added by instructor',
          status: auto_approve ? "approved" : "pending",
          approved_by: auto_approve ? user.id : null,
          approved_at: auto_approve ? new Date().toISOString() : null,
        }, { onConflict: "learning_objective_id,content_id" })
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
