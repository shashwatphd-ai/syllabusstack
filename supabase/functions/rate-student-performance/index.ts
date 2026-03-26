/**
 * Rate Student Performance
 * Allows employers to rate student work on capstone projects.
 * Ported from EduThree1.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

interface RatingRequest {
  student_id: string;
  project_id: string;
  rating: number; // 1-5
  skill_name?: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    // Verify user is an employer
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "employer");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Only employers can rate students" }), { status: 403, headers });
    }

    const { student_id, project_id, rating, skill_name }: RatingRequest = await req.json();

    // Validate inputs
    if (!student_id || !project_id) {
      return new Response(JSON.stringify({ error: "student_id and project_id are required" }), { status: 400, headers });
    }
    if (rating === undefined || rating === null || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: "Rating must be between 1 and 5" }), { status: 400, headers });
    }

    const sanitizedSkillName = skill_name ? skill_name.trim().substring(0, 255) : undefined;

    console.log(`⭐ Rating student ${student_id} on project ${project_id}: ${rating}/5`);

    // Service role client for writes
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify project exists
    const { data: project, error: projectError } = await supabaseAdmin
      .from("capstone_projects")
      .select("id, company_profile_id, title")
      .eq("id", project_id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers });
    }

    // Insert or update student_ratings
    const { error: ratingError } = await supabaseAdmin
      .from("student_ratings")
      .upsert({
        employer_user_id: user.id,
        student_id,
        capstone_project_id: project_id,
        rating,
        skill_name: sanitizedSkillName || "Project Completion",
        rated_at: new Date().toISOString(),
      }, {
        onConflict: "employer_user_id,student_id,capstone_project_id,skill_name"
      });

    if (ratingError) {
      console.error("Rating upsert error:", ratingError);
      // Fallback: insert without onConflict
      const { error: insertError } = await supabaseAdmin
        .from("student_ratings")
        .insert({
          employer_user_id: user.id,
          student_id,
          capstone_project_id: project_id,
          rating,
          skill_name: sanitizedSkillName || "Project Completion",
          rated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Rating insert fallback error:", insertError);
        throw insertError;
      }
    }

    console.log(`✅ Rated student on "${project.title}": ${rating}/5`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Rated ${sanitizedSkillName || "Project Completion"} with ${rating}/5`,
        rating,
      }),
      { status: 200, headers }
    );
  } catch (error: unknown) {
    console.error("❌ Error in rate-student-performance:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers });
  }
});
