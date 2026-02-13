import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

interface EnrollmentWithCourse {
  id: string;
  instructor_course_id: string;
  overall_progress: number;
  instructor_course: {
    id: string;
    title: string;
    code: string | null;
  };
}

interface LearningObjective {
  id: string;
  text: string;
  core_concept: string | null;
  search_keywords: string[] | null;
  instructor_course_id: string;
}

interface Recommendation {
  id: string;
  title: string;
  gap_addressed: string | null;
  dream_job_id: string;
  type: string;
  status: string;
}

interface DreamJob {
  id: string;
  title: string;
  requirements_keywords: string[] | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    const body = await req.json();
    const { dreamJobId, instructorCourseId } = body;

    logInfo('auto-link-courses', 'starting', { userId: user.id, dreamJobId, courseId: instructorCourseId });

    // 1. Get user's enrolled courses
    let enrollmentQuery = supabase
      .from("course_enrollments")
      .select(`
        id,
        instructor_course_id,
        overall_progress,
        instructor_course:instructor_courses (
          id,
          title,
          code
        )
      `)
      .eq("student_id", user.id);

    // If a specific course was just enrolled, filter to that
    if (instructorCourseId) {
      enrollmentQuery = enrollmentQuery.eq("instructor_course_id", instructorCourseId);
    }

    const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
    if (enrollmentError) {
      console.error("[auto-link-courses] Failed to fetch enrollments:", enrollmentError);
      throw enrollmentError;
    }

    if (!enrollments || enrollments.length === 0) {
      logInfo('auto-link-courses', 'no_enrollments');
      return createSuccessResponse({ suggestedLinks: 0, message: "No enrolled courses found" }, corsHeaders);
    }

    // 2. Get learning objectives for enrolled courses
    const courseIds = enrollments.map((e) => (e.instructor_course as any)?.id).filter(Boolean);
    
    const { data: learningObjectives, error: loError } = await supabase
      .from("learning_objectives")
      .select("id, text, core_concept, search_keywords, instructor_course_id")
      .in("instructor_course_id", courseIds);

    if (loError) {
      console.error("[auto-link-courses] Failed to fetch LOs:", loError);
      throw loError;
    }

    // 3. Get user's pending recommendations (optionally for a specific dream job)
    let recQuery = supabase
      .from("recommendations")
      .select("id, title, gap_addressed, dream_job_id, type, status")
      .eq("user_id", user.id)
      .eq("type", "course")
      .in("status", ["pending", "not_started", "in_progress"])
      .is("deleted_at", null);

    if (dreamJobId) {
      recQuery = recQuery.eq("dream_job_id", dreamJobId);
    }

    const { data: recommendations, error: recError } = await recQuery;
    if (recError) {
      console.error("[auto-link-courses] Failed to fetch recommendations:", recError);
      throw recError;
    }

    if (!recommendations || recommendations.length === 0) {
      logInfo('auto-link-courses', 'no_recommendations');
      return createSuccessResponse({ suggestedLinks: 0, message: "No pending recommendations to link" }, corsHeaders);
    }

    // 4. Get existing links to avoid duplicates
    const recIds = recommendations.map(r => r.id);
    const { data: existingLinks } = await supabase
      .from("recommendation_course_links")
      .select("recommendation_id, instructor_course_id")
      .in("recommendation_id", recIds);

    const existingLinkSet = new Set(
      (existingLinks || []).map(l => `${l.recommendation_id}:${l.instructor_course_id}`)
    );

    // 5. Get dream jobs for keyword matching
    const dreamJobIds = [...new Set(recommendations.map(r => r.dream_job_id))];
    const { data: dreamJobs } = await supabase
      .from("dream_jobs")
      .select("id, title, requirements_keywords")
      .in("id", dreamJobIds);

    const dreamJobMap = new Map((dreamJobs || []).map(dj => [dj.id, dj]));

    // 6. Match recommendations to courses based on keyword overlap
    const suggestedLinks: Array<{
      recommendation_id: string;
      instructor_course_id: string;
      match_score: number;
      match_reason: string;
    }> = [];

    for (const rec of recommendations) {
      const gapText = (rec.gap_addressed || rec.title).toLowerCase();
      const gapWords: string[] = gapText.split(/\s+/).filter((w: string) => w.length > 3);
      
      const dreamJob = dreamJobMap.get(rec.dream_job_id);
      const reqKeywords: string[] = (dreamJob?.requirements_keywords || []).map((k: string) => k.toLowerCase());

      for (const enrollment of enrollments) {
        const course = enrollment.instructor_course as unknown as { id: string; title: string; code: string | null } | null;
        if (!course) continue;

        const linkKey = `${rec.id}:${course.id}`;
        if (existingLinkSet.has(linkKey)) continue;

        // Get LOs for this course
        const courseLOs = (learningObjectives || []).filter(
          lo => lo.instructor_course_id === course.id
        );

        let matchScore = 0;
        const matchReasons: string[] = [];

        // Check course title similarity
        const courseTitle = course.title.toLowerCase();
        const titleOverlap = gapWords.filter((w: string) => courseTitle.includes(w)).length;
        if (titleOverlap > 0) {
          matchScore += titleOverlap * 20;
          matchReasons.push(`Course title matches ${titleOverlap} keywords`);
        }

        // Check LO text and keywords
        for (const lo of courseLOs) {
          const loText = lo.text.toLowerCase();
          const loKeywords: string[] = (lo.search_keywords || []).map((k: string) => k.toLowerCase());
          const coreConcept = (lo.core_concept || "").toLowerCase();

          // Gap addressed matches LO text
          const loOverlap = gapWords.filter((w: string) => loText.includes(w) || coreConcept.includes(w)).length;
          if (loOverlap > 0) {
            matchScore += loOverlap * 10;
          }

          // Gap keywords match LO search keywords
          const keywordOverlap = gapWords.filter((w: string) => loKeywords.some((k: string) => k.includes(w))).length;
          if (keywordOverlap > 0) {
            matchScore += keywordOverlap * 15;
          }

          // Dream job requirements match LO
          const reqOverlap = reqKeywords.filter((k: string) => loText.includes(k) || loKeywords.includes(k)).length;
          if (reqOverlap > 0) {
            matchScore += reqOverlap * 5;
          }
        }

        // Require minimum match score
        if (matchScore >= 20) {
          suggestedLinks.push({
            recommendation_id: rec.id,
            instructor_course_id: course.id,
            match_score: matchScore,
            match_reason: matchReasons.join("; ") || `Keyword overlap score: ${matchScore}`,
          });
        }
      }
    }

    // Sort by match score and take best match per recommendation
    suggestedLinks.sort((a, b) => b.match_score - a.match_score);
    const bestLinks = new Map<string, typeof suggestedLinks[0]>();
    for (const link of suggestedLinks) {
      if (!bestLinks.has(link.recommendation_id)) {
        bestLinks.set(link.recommendation_id, link);
      }
    }

    // 7. Insert suggested links
    const linksToInsert = Array.from(bestLinks.values()).map(link => ({
      recommendation_id: link.recommendation_id,
      instructor_course_id: link.instructor_course_id,
      link_type: "suggested",
      link_status: "suggested",
      progress_percentage: 0,
    }));

    if (linksToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("recommendation_course_links")
        .upsert(linksToInsert, {
          onConflict: "recommendation_id",
          ignoreDuplicates: true,
        });

      if (insertError) {
        console.error("[auto-link-courses] Failed to insert links:", insertError);
        throw insertError;
      }
    }

    logInfo('auto-link-courses', 'complete', { linksCreated: linksToInsert.length });

    return createSuccessResponse({
      suggestedLinks: linksToInsert.length,
      message: linksToInsert.length > 0
        ? `Found ${linksToInsert.length} potential course matches for your recommendations`
        : "No matching courses found for your recommendations",
    }, corsHeaders);
  } catch (error) {
    logError('auto-link-courses', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
