import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchResult {
  id: string;
  type: "course" | "dream_job" | "recommendation" | "capability";
  title: string;
  subtitle?: string;
  url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const searchTerm = `%${query.trim().toLowerCase()}%`;
    const results: SearchResult[] = [];

    // Search courses
    const { data: courses } = await supabase
      .from("courses")
      .select("id, title, code, instructor")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},code.ilike.${searchTerm},instructor.ilike.${searchTerm}`)
      .limit(5);

    if (courses) {
      for (const course of courses) {
        results.push({
          id: course.id,
          type: "course",
          title: course.title,
          subtitle: course.code || course.instructor,
          url: `/courses/${course.id}`,
        });
      }
    }

    // Search dream jobs
    const { data: dreamJobs } = await supabase
      .from("dream_jobs")
      .select("id, title, company_type, location")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},company_type.ilike.${searchTerm},location.ilike.${searchTerm}`)
      .limit(5);

    if (dreamJobs) {
      for (const job of dreamJobs) {
        results.push({
          id: job.id,
          type: "dream_job",
          title: job.title,
          subtitle: job.company_type || job.location,
          url: `/dream-jobs/${job.id}`,
        });
      }
    }

    // Search recommendations
    const { data: recommendations } = await supabase
      .from("recommendations")
      .select("id, title, type, provider")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},provider.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .limit(5);

    if (recommendations) {
      for (const rec of recommendations) {
        results.push({
          id: rec.id,
          type: "recommendation",
          title: rec.title,
          subtitle: rec.provider || rec.type,
          url: `/recommendations`,
        });
      }
    }

    // Search capabilities
    const { data: capabilities } = await supabase
      .from("capabilities")
      .select("id, name, category, proficiency_level")
      .eq("user_id", user.id)
      .or(`name.ilike.${searchTerm},category.ilike.${searchTerm}`)
      .limit(5);

    if (capabilities) {
      for (const cap of capabilities) {
        results.push({
          id: cap.id,
          type: "capability",
          title: cap.name,
          subtitle: cap.category || cap.proficiency_level,
          url: `/analysis`,
        });
      }
    }

    console.log(`Search for "${query}" returned ${results.length} results`);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        results,
        totalCount: results.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in global-search:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
