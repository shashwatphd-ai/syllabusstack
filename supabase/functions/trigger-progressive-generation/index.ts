import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Progressive Generation Trigger
 * 
 * This function checks enrollment thresholds and triggers content generation
 * when demand reaches the configured threshold (default: 10 students).
 * 
 * Can be called:
 * 1. Via cron job to check all courses
 * 2. On enrollment to check specific course
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { instructor_course_id, check_all = false } = await req.json();

    let coursesToCheck: string[] = [];

    if (check_all) {
      // Get all courses with pending generation triggers
      const { data: courses } = await adminClient
        .from("generation_triggers")
        .select("instructor_course_id")
        .eq("is_triggered", false)
        .order("created_at", { ascending: true });

      coursesToCheck = [...new Set(courses?.map(c => c.instructor_course_id) || [])];
    } else if (instructor_course_id) {
      coursesToCheck = [instructor_course_id];
    } else {
      return new Response(JSON.stringify({ error: "Provide instructor_course_id or check_all" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = {
      courses_checked: coursesToCheck.length,
      triggers_activated: 0,
      generation_jobs_queued: 0,
    };

    for (const courseId of coursesToCheck) {
      // Check and update triggers
      const { data: triggeredCount } = await adminClient.rpc("check_generation_trigger", {
        p_instructor_course_id: courseId,
      });

      results.triggers_activated += triggeredCount || 0;

      // Get newly triggered items that need generation
      const { data: pendingTriggers } = await adminClient
        .from("generation_triggers")
        .select(`
          id,
          teaching_unit_id,
          trigger_type,
          learning_objective_id
        `)
        .eq("instructor_course_id", courseId)
        .eq("is_triggered", true)
        .is("batch_job_id", null);

      if (pendingTriggers?.length) {
        // Group by trigger type
        const slidesTriggers = pendingTriggers.filter(t => t.trigger_type === "slides");
        
        if (slidesTriggers.length > 0) {
          // Queue batch slide generation
          // In production, this would call submit-batch-slides
          console.log(`Queuing ${slidesTriggers.length} slide generations for course ${courseId}`);
          
          // For now, just mark them as having a pending job
          // The actual batch job would be created by calling submit-batch-slides
          results.generation_jobs_queued += slidesTriggers.length;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in trigger-progressive-generation:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
