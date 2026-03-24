/**
 * Re-Enrich Addresses Edge Function
 * Calls Apollo Organization Enrich API + Contact Search for existing companies.
 * Updates ALL enrichment fields (not just address).
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { enrichCompanyFull } from "../_shared/capstone/apollo-enrichment-service.ts";
import { classifyCourseDomain } from "../_shared/capstone/context-aware-industry-filter.ts";
import { mapCourseToSOC } from "../_shared/capstone/course-soc-mapping.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  const { instructor_course_id } = await req.json();
  if (!instructor_course_id) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'instructor_course_id required');
  }

  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  if (!APOLLO_API_KEY) {
    return createErrorResponse('CONFIG_ERROR', corsHeaders, 'Apollo API key not configured');
  }

  // Get course info for domain classification
  const { data: course } = await supabase
    .from('instructor_courses')
    .select('title, academic_level')
    .eq('id', instructor_course_id)
    .single();

  const { data: los } = await supabase
    .from('learning_objectives')
    .select('text, bloom_level')
    .eq('instructor_course_id', instructor_course_id);

  const objectiveTexts = (los || []).map((lo: any) => lo.text).filter(Boolean);
  const socMappings = course ? mapCourseToSOC(course.title, objectiveTexts, course.academic_level || '') : [];
  const courseDomain = classifyCourseDomain(socMappings).domain;

  // Fetch companies
  const { data: companies, error } = await supabase
    .from('company_profiles')
    .select('id, name, website, apollo_organization_id, full_address')
    .eq('instructor_course_id', instructor_course_id)
    .not('website', 'is', null);

  if (error || !companies) {
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error?.message);
  }

  console.log(`Re-enriching ${companies.length} companies with full EduThree-level data...`);

  let updated = 0;

  for (const company of companies) {
    const orgId = company.apollo_organization_id;
    const domain = company.website;
    if (!domain) continue;

    try {
      const enrichData = orgId
        ? await enrichCompanyFull(orgId, domain, courseDomain, APOLLO_API_KEY)
        : null;

      if (!enrichData?.enrichment) continue;

      const enrich = enrichData.enrichment;
      const contact = enrichData.contact;
      const fullAddress = [enrich.streetAddress, enrich.city, enrich.state, enrich.postalCode]
        .filter(Boolean).join(', ');

      const updateData: Record<string, unknown> = {
        full_address: fullAddress || company.full_address,
        city: enrich.city || null,
        state: enrich.state || null,
        zip: enrich.postalCode || null,
        country: enrich.country || null,
        description: enrich.shortDescription || undefined,
        seo_description: enrich.seoDescription || null,
        organization_logo_url: enrich.logoUrl || null,
        organization_linkedin_url: enrich.linkedinUrl || null,
        organization_twitter_url: enrich.twitterUrl || null,
        organization_facebook_url: enrich.facebookUrl || null,
        organization_founded_year: enrich.foundedYear || null,
        organization_industry_keywords: enrich.industryKeywords?.length ? enrich.industryKeywords : null,
        organization_revenue_range: enrich.revenueRange || null,
        employee_count: enrich.employeeCount ? enrich.employeeCount.toString() : undefined,
        technologies_used: enrich.technologies?.length ? enrich.technologies : undefined,
        industries: enrich.industries?.length ? enrich.industries.slice(0, 10) : undefined,
        funding_stage: enrich.fundingStage || undefined,
        funding_events: enrich.fundingEvents?.length ? enrich.fundingEvents : null,
        departmental_head_count: enrich.departmentalHeadCount || null,
        buying_intent_signals: enrichData.buyingIntent || null,
        job_postings: enrichData.jobPostings?.length
          ? enrichData.jobPostings.slice(0, 10).map((jp: any) => ({
              title: jp.title, location: jp.location,
              posted_date: jp.posted_at, description: jp.description?.substring(0, 200),
            }))
          : undefined,
        data_completeness_score: enrichData.completenessScore,
        last_enriched_at: new Date().toISOString(),
        data_enrichment_level: 'apollo_verified',
      };

      // Contact fields
      if (contact) {
        Object.assign(updateData, {
          contact_first_name: contact.firstName || null,
          contact_last_name: contact.lastName || null,
          contact_email: contact.email || null,
          contact_title: contact.title || null,
          contact_phone: contact.phone || null,
          contact_person: `${contact.firstName} ${contact.lastName}`.trim() || null,
          contact_headline: contact.headline || null,
          contact_photo_url: contact.photoUrl || null,
          contact_city: contact.city || null,
          contact_state: contact.state || null,
          contact_country: contact.country || null,
          contact_email_status: contact.emailStatus || null,
          contact_twitter_url: contact.twitterUrl || null,
          contact_phone_numbers: contact.phoneNumbers?.length ? contact.phoneNumbers : null,
          contact_employment_history: contact.employmentHistory?.length ? contact.employmentHistory : null,
          linkedin_profile: contact.linkedinUrl || enrich.linkedinUrl || null,
        });
      }

      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([, v]) => v !== undefined)
      );

      const { error: updateError } = await supabase
        .from('company_profiles')
        .update(cleanData)
        .eq('id', company.id);

      if (!updateError) {
        updated++;
        console.log(`  ✅ ${company.name}: ${fullAddress || 'enriched'}`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Failed: ${company.name}:`, e);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`Re-enrichment complete: ${updated}/${companies.length} companies updated`);

  return createSuccessResponse({ total: companies.length, updated }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
