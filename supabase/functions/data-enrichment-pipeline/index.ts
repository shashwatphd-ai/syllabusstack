/**
 * Data Enrichment Pipeline
 * Batch enriches company profiles with additional data from web search.
 * Ported from EduThree1 (simplified — removes Google Places dependency,
 * focuses on Apollo-based enrichment which SS already uses).
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

interface EnrichmentRequest {
  companyIds?: string[];       // Specific company IDs to enrich
  instructorCourseId?: string; // Enrich all companies for a course
  forceRefresh?: boolean;
  maxCompanies?: number;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const {
      companyIds,
      instructorCourseId,
      forceRefresh = false,
      maxCompanies = 25,
    }: EnrichmentRequest = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build query for companies to enrich
    let query = supabase
      .from("company_profiles")
      .select("id, name, website, city, state, description, last_enriched_at, apollo_organization_id")
      .order("last_enriched_at", { ascending: true, nullsFirst: true })
      .limit(maxCompanies);

    if (companyIds && companyIds.length > 0) {
      query = query.in("id", companyIds);
    } else if (instructorCourseId) {
      query = query.eq("instructor_course_id", instructorCourseId);
    }

    if (!forceRefresh) {
      // Only enrich companies not enriched in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`last_enriched_at.is.null,last_enriched_at.lt.${sevenDaysAgo}`);
    }

    const { data: companies, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No companies need enrichment", enriched: 0 }),
        { headers }
      );
    }

    console.log(`🔄 Enriching ${companies.length} companies...`);

    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    let enrichedCount = 0;
    let errorCount = 0;
    const results: Array<{ id: string; name: string; status: string }> = [];

    for (const company of companies) {
      try {
        const updateData: Record<string, unknown> = {
          last_enriched_at: new Date().toISOString(),
        };

        // If we have Apollo org ID, try to refresh org data
        if (APOLLO_API_KEY && company.apollo_organization_id) {
          try {
            const orgResponse = await fetch("https://api.apollo.io/api/v1/organizations/enrich", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
              body: JSON.stringify({ organization_id: company.apollo_organization_id }),
            });

            if (orgResponse.ok) {
              const orgData = await orgResponse.json();
              const org = orgData.organization;
              if (org) {
                if (org.estimated_num_employees) updateData.employee_count = String(org.estimated_num_employees);
                if (org.industry) updateData.sector = org.industry;
                if (org.short_description) updateData.seo_description = org.short_description;
                if (org.founded_year) updateData.organization_founded_year = org.founded_year;
                if (org.linkedin_url) updateData.organization_linkedin_url = org.linkedin_url;
                if (org.logo_url) updateData.organization_logo_url = org.logo_url;
                if (org.estimated_annual_revenue) updateData.organization_revenue_range = org.estimated_annual_revenue;
                updateData.data_enrichment_level = "apollo_verified";
              }
            }
          } catch (apolloErr) {
            console.warn(`Apollo enrich failed for ${company.name}:`, apolloErr);
          }
        } else if (APOLLO_API_KEY && company.website) {
          // Try domain-based enrichment
          try {
            const domain = new URL(company.website).hostname.replace("www.", "");
            const orgResponse = await fetch("https://api.apollo.io/api/v1/organizations/enrich", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
              body: JSON.stringify({ domain }),
            });

            if (orgResponse.ok) {
              const orgData = await orgResponse.json();
              const org = orgData.organization;
              if (org) {
                if (org.id) updateData.apollo_organization_id = org.id;
                if (org.estimated_num_employees) updateData.employee_count = String(org.estimated_num_employees);
                if (org.industry) updateData.sector = org.industry;
                if (org.short_description) updateData.seo_description = org.short_description;
                updateData.data_enrichment_level = "apollo_verified";
              }
            }
          } catch {
            // Domain enrichment failed silently
          }
        }

        if (!updateData.data_enrichment_level) {
          updateData.data_enrichment_level = "basic";
        }

        const { error: updateError } = await supabase
          .from("company_profiles")
          .update(updateData)
          .eq("id", company.id);

        if (updateError) throw updateError;

        enrichedCount++;
        results.push({ id: company.id, name: company.name, status: "enriched" });
        console.log(`  ✅ ${company.name}`);
      } catch (err) {
        errorCount++;
        results.push({ id: company.id, name: company.name, status: "error" });
        console.error(`  ❌ ${company.name}:`, err);
      }

      // Rate limiting between companies
      if (APOLLO_API_KEY) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    console.log(`✅ Enrichment complete: ${enrichedCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed: companies.length,
        enriched: enrichedCount,
        errors: errorCount,
        results,
      }),
      { headers }
    );
  } catch (error) {
    console.error("❌ Enrichment pipeline error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
