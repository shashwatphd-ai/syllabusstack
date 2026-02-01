import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
} from "../_shared/error-handler.ts";

interface SearchResult {
  id: string;
  type: "course" | "dream_job" | "recommendation" | "capability";
  title: string;
  subtitle?: string;
  url: string;
}

const handler = async (req: Request): Promise<Response> => {
  // CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  const { query } = await req.json();

  if (!query || query.trim().length < 2) {
    return createSuccessResponse({ results: [] }, corsHeaders);
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

  logInfo('global-search', 'searching', { userId: user.id, query });

  const searchTerm = `%${query.trim().toLowerCase()}%`;
  const results: SearchResult[] = [];

  // Run all 4 searches in PARALLEL (4x faster than sequential)
  const [coursesResult, dreamJobsResult, recommendationsResult, capabilitiesResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, code, instructor")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},code.ilike.${searchTerm},instructor.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from("dream_jobs")
      .select("id, title, company_type, location")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},company_type.ilike.${searchTerm},location.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from("recommendations")
      .select("id, title, type, provider")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},provider.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from("capabilities")
      .select("id, name, category, proficiency_level")
      .eq("user_id", user.id)
      .or(`name.ilike.${searchTerm},category.ilike.${searchTerm}`)
      .limit(5),
  ]);

  // Process courses
  if (coursesResult.data) {
    for (const course of coursesResult.data) {
      results.push({
        id: course.id,
        type: "course",
        title: course.title,
        subtitle: course.code || course.instructor,
        url: `/courses/${course.id}`,
      });
    }
  }

  // Process dream jobs
  if (dreamJobsResult.data) {
    for (const job of dreamJobsResult.data) {
      results.push({
        id: job.id,
        type: "dream_job",
        title: job.title,
        subtitle: job.company_type || job.location,
        url: `/dream-jobs/${job.id}`,
      });
    }
  }

  // Process recommendations
  if (recommendationsResult.data) {
    for (const rec of recommendationsResult.data) {
      results.push({
        id: rec.id,
        type: "recommendation",
        title: rec.title,
        subtitle: rec.provider || rec.type,
        url: `/recommendations`,
      });
    }
  }

  // Process capabilities
  if (capabilitiesResult.data) {
    for (const cap of capabilitiesResult.data) {
      results.push({
        id: cap.id,
        type: "capability",
        title: cap.name,
        subtitle: cap.category || cap.proficiency_level,
        url: `/analysis`,
      });
    }
  }

  logInfo('global-search', 'complete', { userId: user.id, resultCount: results.length });

  return createSuccessResponse({
    success: true,
    query,
    results,
    totalCount: results.length,
  }, corsHeaders);
};

serve(withErrorHandling(handler, getCorsHeaders));
