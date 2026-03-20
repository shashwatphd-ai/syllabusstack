/**
 * Discover Companies Edge Function
 * Discovers local companies via Apollo API for capstone project matching
 * Adapted from EduThree1's discover-companies (1,727 lines) — simplified
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { extractSkillsFromObjectives } from "../_shared/capstone/skill-extraction.ts";
import { withApolloCircuit } from "../_shared/capstone/circuit-breaker.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  const { instructor_course_id, count = 10 } = await req.json();
  if (!instructor_course_id) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'instructor_course_id is required');
  }

  // Verify instructor ownership
  const { data: isInstructor } = await supabase.rpc('is_course_instructor', {
    _user_id: user.id,
    _course_id: instructor_course_id,
  });
  if (!isInstructor) return createErrorResponse('FORBIDDEN', corsHeaders);

  // Check Apollo API key
  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  if (!APOLLO_API_KEY) {
    return createErrorResponse('CONFIG_ERROR', corsHeaders, 'Apollo API key not configured. Please add APOLLO_API_KEY to enable company discovery.');
  }

  // Fetch course data
  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, search_location, location_city, location_state, academic_level')
    .eq('id', instructor_course_id)
    .single();
  if (courseError || !course) return createErrorResponse('NOT_FOUND', corsHeaders, 'Course not found');

  // Fetch learning objectives
  const { data: los } = await supabase
    .from('learning_objectives')
    .select('id, objective_text, bloom_level')
    .eq('instructor_course_id', instructor_course_id);
  const objectiveTexts = (los || []).map(lo => lo.objective_text);

  if (objectiveTexts.length === 0) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Course has no learning objectives for skill extraction');
  }

  const searchLocation = course.search_location || 
    (course.location_city && course.location_state ? `${course.location_city}, ${course.location_state}` : null);

  if (!searchLocation) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Course location not set. Please configure location first.');
  }

  console.log(`🔍 Discovering companies for: ${course.title}`);
  console.log(`📍 Location: ${searchLocation}`);

  // Extract skills from learning objectives
  const skills = extractSkillsFromObjectives(objectiveTexts, course.title);
  const skillKeywords = skills.map(s => s.skill);
  console.log(`🧠 Extracted ${skills.length} skills: ${skillKeywords.slice(0, 5).join(', ')}...`);

  // Build Apollo search industries from skills
  const industryKeywords = inferIndustries(course.title, objectiveTexts);

  // Apollo API: Search for companies
  const apolloResult = await withApolloCircuit(async () => {
    const searchBody = {
      api_key: APOLLO_API_KEY,
      q_organization_keyword_tags: skillKeywords.slice(0, 5),
      organization_locations: [searchLocation],
      organization_num_employees_ranges: ["11,50", "51,200", "201,500", "501,1000", "1001,5000"],
      page: 1,
      per_page: Math.min(count * 2, 25), // Fetch extra for filtering
    };

    const response = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${text.substring(0, 200)}`);
    }

    return response.json();
  });

  if (!apolloResult.success) {
    console.error('Apollo search failed:', apolloResult.error);
    return createErrorResponse('SERVICE_UNAVAILABLE', corsHeaders, `Company discovery failed: ${apolloResult.error}`);
  }

  const apolloOrgs = apolloResult.data?.organizations || apolloResult.data?.accounts || [];
  console.log(`📦 Apollo returned ${apolloOrgs.length} organizations`);

  if (apolloOrgs.length === 0) {
    return createSuccessResponse({
      success: true,
      companies_discovered: 0,
      companies: [],
      message: 'No companies found matching the course criteria in this location.',
    }, corsHeaders);
  }

  // Upsert companies into company_profiles
  const insertedCompanies: any[] = [];

  for (const org of apolloOrgs.slice(0, count)) {
    const companyData = {
      name: org.name || 'Unknown',
      sector: org.industry || org.organization_industry || 'Unknown',
      size: org.estimated_num_employees ? `${org.estimated_num_employees} employees` : 'Unknown',
      description: org.short_description || org.seo_description || '',
      website: org.website_url || org.domain || null,
      contact_email: org.primary_phone?.sanitized_number ? null : null, // Apollo org search doesn't return contacts
      full_address: [org.street_address, org.city, org.state, org.country].filter(Boolean).join(', ') || null,
      linkedin_profile: org.linkedin_url || null,
      apollo_organization_id: org.id || org.organization_id || null,
      technologies_used: (org.current_technologies || []).map((t: any) => typeof t === 'string' ? t : t.name || '').filter(Boolean),
      funding_stage: org.latest_funding_stage || null,
      total_funding_usd: org.total_funding ? parseInt(org.total_funding) : null,
      employee_count: org.estimated_num_employees?.toString() || null,
      revenue_range: org.annual_revenue_printed || null,
      industries: org.industry ? [org.industry] : [],
      keywords: org.keywords || [],
      data_completeness_score: calculateCompleteness(org),
    };

    // Upsert on apollo_organization_id
    const { data: company, error: insertError } = await supabase
      .from('company_profiles')
      .upsert(companyData, { onConflict: 'apollo_organization_id' })
      .select()
      .single();

    if (insertError) {
      console.warn(`Failed to upsert ${companyData.name}:`, insertError.message);
      continue;
    }

    // Also create a placeholder capstone_project linking them to the course
    // (status: 'generated' means not yet fully generated)
    insertedCompanies.push(company);
  }

  console.log(`✅ Discovered and stored ${insertedCompanies.length} companies`);

  return createSuccessResponse({
    success: true,
    companies_discovered: insertedCompanies.length,
    companies: insertedCompanies.map(c => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      size: c.size,
      website: c.website,
      technologies: c.technologies_used?.slice(0, 5),
    })),
    location: searchLocation,
    skills_used: skillKeywords.slice(0, 10),
  }, corsHeaders);
};

function calculateCompleteness(org: any): number {
  let score = 0;
  if (org.name) score += 15;
  if (org.short_description || org.seo_description) score += 15;
  if (org.website_url || org.domain) score += 10;
  if (org.industry) score += 10;
  if (org.estimated_num_employees) score += 10;
  if (org.linkedin_url) score += 10;
  if (org.current_technologies?.length > 0) score += 15;
  if (org.latest_funding_stage) score += 10;
  if (org.city && org.state) score += 5;
  return score;
}

function inferIndustries(courseTitle: string, objectives: string[]): string[] {
  const text = `${courseTitle} ${objectives.join(' ')}`.toLowerCase();
  const industries: string[] = [];
  
  const mapping: Record<string, string[]> = {
    'technology': ['software', 'programming', 'computer', 'data', 'ai', 'machine learning', 'cloud'],
    'engineering': ['engineering', 'mechanical', 'electrical', 'civil', 'chemical'],
    'finance': ['finance', 'banking', 'investment', 'accounting'],
    'healthcare': ['health', 'medical', 'clinical', 'pharma'],
    'marketing': ['marketing', 'advertising', 'brand'],
    'manufacturing': ['manufacturing', 'production', 'supply chain', 'logistics'],
  };

  for (const [industry, keywords] of Object.entries(mapping)) {
    if (keywords.some(kw => text.includes(kw))) {
      industries.push(industry);
    }
  }

  return industries.length > 0 ? industries : ['technology'];
}

Deno.serve(withErrorHandling(handler, getCorsHeaders));
