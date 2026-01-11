import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Search for jobs using Active Jobs DB (RapidAPI)
 *
 * This replaces the need to paste job URLs and scrape them.
 * Returns pre-structured job data with requirements, salary, and apply links.
 *
 * Usage:
 *   POST /search-jobs
 *   { "title": "Software Engineer", "location": "Remote", "skills": ["python", "react"] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, location, skills, limit = 20 } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ success: false, error: "Job title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

    if (!RAPIDAPI_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RAPIDAPI_KEY not configured",
          message: "Job search not available. Please paste a job URL instead.",
          fallback: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching jobs: title="${title}", location="${location}", skills=${skills?.length || 0}`);

    // Build filter for skills
    const descriptionFilter = skills?.length > 0 ? skills.join(" OR ") : undefined;

    const response = await fetch("https://active-jobs-db.p.rapidapi.com/active-ats-7d", {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "active-jobs-db.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title_filter: title,
        location_filter: location || undefined,
        description_filter: descriptionFilter,
        limit,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Active Jobs DB error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Job search API error: ${response.status}`,
          fallback: true,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawJobs = await response.json();
    console.log(`Active Jobs DB returned ${rawJobs?.length || 0} jobs`);

    // Transform to our format
    const jobs = (rawJobs || []).map((job: any) => ({
      id: job.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: job.title || "Unknown Position",
      company: job.company || job.organization || "Unknown Company",
      location: job.location || "Not specified",
      salary_min: job.salary_min || job.min_salary || null,
      salary_max: job.salary_max || job.max_salary || null,
      salary_currency: job.salary_currency || "USD",
      employment_type: job.employment_type || job.job_type || "Full-time",
      experience_level: job.experience_level || job.seniority || null,
      description: job.description || job.job_description || "",
      requirements: extractRequirements(job),
      skills: job.skills || job.required_skills || [],
      benefits: job.benefits || [],
      apply_url: job.apply_url || job.application_url || job.url || null,
      company_url: job.company_url || null,
      posted_date: job.posted_date || job.date_posted || null,
      source: "active_jobs_db",
    }));

    return new Response(
      JSON.stringify({
        success: true,
        jobs,
        total: jobs.length,
        query: { title, location, skills },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-jobs:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Extract requirements from various job data formats
 */
function extractRequirements(job: any): string[] {
  // Try different fields where requirements might be stored
  if (Array.isArray(job.requirements)) {
    return job.requirements;
  }

  if (Array.isArray(job.qualifications)) {
    return job.qualifications;
  }

  if (typeof job.requirements === "string") {
    return job.requirements.split(/[•\n]/).filter((r: string) => r.trim().length > 10);
  }

  if (typeof job.qualifications === "string") {
    return job.qualifications.split(/[•\n]/).filter((r: string) => r.trim().length > 10);
  }

  // Extract from description if no dedicated field
  if (job.description) {
    const reqSection = job.description.match(
      /(?:requirements|qualifications|must have|required skills)[:\s]*([^]*?)(?:responsibilities|benefits|about|$)/i
    );
    if (reqSection) {
      return reqSection[1]
        .split(/[•\n-]/)
        .map((r: string) => r.trim())
        .filter((r: string) => r.length > 10 && r.length < 200);
    }
  }

  return [];
}
