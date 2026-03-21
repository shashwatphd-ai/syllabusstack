/**
 * Discover Companies Edge Function (Rewritten)
 * 
 * Replaces naive single-keyword Apollo search with EduThree1's multi-phase pipeline:
 * 1. SOC code mapping from course context
 * 2. Industry keyword + job title extraction from SOC
 * 3. Location normalization with variants
 * 4. 3-strategy Apollo discovery (technology → job titles → industry keywords)
 * 5. Context-aware industry filtering
 * 6. Company enrichment (job postings, technologies)
 * 7. Upsert into company_profiles
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { mapCourseToSOC, getIndustryKeywordsFromSOC, getJobTitlesFromSOC } from "../_shared/capstone/course-soc-mapping.ts";
import { normalizeLocationForApollo } from "../_shared/capstone/location-utils.ts";
import { classifyCourseDomain, shouldExcludeIndustry } from "../_shared/capstone/context-aware-industry-filter.ts";
import { extractIndustrySkills } from "../_shared/capstone/skill-extraction.ts";
import { discoverCompanies } from "../_shared/capstone/apollo-precise-discovery.ts";

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
    return createErrorResponse('CONFIG_ERROR', corsHeaders, 'Apollo API key not configured.');
  }

  // ── Phase 1: Fetch course data ──
  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, search_location, location_city, location_state, academic_level')
    .eq('id', instructor_course_id)
    .single();
  if (courseError || !course) return createErrorResponse('NOT_FOUND', corsHeaders, 'Course not found');

  // Fetch learning objectives
  const { data: los } = await supabase
    .from('learning_objectives')
    .select('id, text, bloom_level')
    .eq('instructor_course_id', instructor_course_id);
  const objectiveTexts = (los || []).map((lo: any) => lo.text).filter(Boolean);

  if (objectiveTexts.length === 0) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Course has no learning objectives for skill extraction');
  }

  const searchLocation = course.search_location ||
    (course.location_city && course.location_state ? `${course.location_city}, ${course.location_state}` : null);

  if (!searchLocation) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Course location not set. Please configure location first.');
  }

  console.log(`\n🔍 ═══════════════════════════════════════`);
  console.log(`   CAPSTONE COMPANY DISCOVERY PIPELINE`);
  console.log(`   Course: ${course.title}`);
  console.log(`   Location: ${searchLocation}`);
  console.log(`   Objectives: ${objectiveTexts.length}`);
  console.log(`═══════════════════════════════════════════\n`);

  // ── Phase 2: SOC Code Mapping ──
  console.log(`\n📋 PHASE 2: SOC CODE MAPPING`);
  const socMappings = mapCourseToSOC(course.title, objectiveTexts, course.academic_level || '');

  if (socMappings.length === 0) {
    console.warn('⚠️ No SOC mappings found — will rely on AI skill extraction only');
  }

  // ── Phase 3: Skill Extraction (AI-powered) ──
  console.log(`\n🧠 PHASE 3: SKILL EXTRACTION`);
  const skillResult = await extractIndustrySkills(objectiveTexts, course.title, course.academic_level || '');
  const skillKeywords = skillResult.skills.map(s => s.skill);
  console.log(`   Extracted ${skillResult.skills.length} skills via ${skillResult.extractionMethod}`);

  // ── Phase 4: Build Apollo Search Parameters ──
  const industryKeywords = getIndustryKeywordsFromSOC(socMappings);
  const jobTitles = getJobTitlesFromSOC(socMappings);
  const normalizedLocation = normalizeLocationForApollo(searchLocation);

  console.log(`\n🔧 PHASE 4: SEARCH PARAMETERS`);
  console.log(`   Industry keywords: ${industryKeywords.slice(0, 5).join(', ')}...`);
  console.log(`   Job titles: ${jobTitles.join(', ')}`);
  console.log(`   Location (normalized): ${normalizedLocation}`);

  // ── Phase 5: Apollo Multi-Strategy Discovery ──
  const discoveryResult = await discoverCompanies({
    industries: industryKeywords,
    jobTitles,
    skillKeywords: skillKeywords.slice(0, 10),
    location: normalizedLocation,
    targetCount: count,
  });

  console.log(`\n📦 PHASE 5 RESULTS: ${discoveryResult.companies.length} companies discovered`);

  if (discoveryResult.companies.length === 0) {
    return createSuccessResponse({
      success: true,
      companies_discovered: 0,
      companies_saved: 0,
      companies: [],
      message: 'No companies found matching the course criteria in this location.',
      debug: {
        socMappings: socMappings.map(s => s.title),
        industryKeywords,
        jobTitles,
        skillCount: skillResult.skills.length,
        extractionMethod: skillResult.extractionMethod,
        location: normalizedLocation,
      }
    }, corsHeaders);
  }

  // ── Phase 6: Context-Aware Industry Filtering ──
  console.log(`\n🏭 PHASE 6: INDUSTRY FILTERING`);
  const domainClassification = classifyCourseDomain(socMappings);
  console.log(`   Course domain: ${domainClassification.domain} (${(domainClassification.confidence * 100).toFixed(0)}%)`);

  const filteredCompanies = discoveryResult.companies.filter(company => {
    const decision = shouldExcludeIndustry(
      company.industry,
      domainClassification.domain,
      socMappings,
      company.jobPostings
    );
    if (decision.shouldExclude) {
      console.log(`   ❌ Excluded: ${company.name} (${decision.reason})`);
    }
    return !decision.shouldExclude;
  });

  console.log(`   Passed filtering: ${filteredCompanies.length}/${discoveryResult.companies.length}`);

  // ── Phase 7: Upsert into company_profiles ──
  console.log(`\n💾 PHASE 7: SAVING COMPANIES`);
  const insertedCompanies: any[] = [];

  for (const company of filteredCompanies.slice(0, count)) {
    const companyData = {
      name: company.name,
      sector: company.industry,
      size: company.employeeCount ? `${company.employeeCount} employees` : 'Unknown',
      description: company.description,
      website: company.website || null,
      full_address: [company.location.city, company.location.state, company.location.country].filter(Boolean).join(', ') || null,
      apollo_organization_id: company.apolloId,
      technologies_used: company.technologies,
      funding_stage: company.fundingStage || null,
      total_funding_usd: company.totalFunding ? Math.round(company.totalFunding) : null,
      employee_count: company.employeeCount?.toString() || null,
      industries: company.industryTags.slice(0, 10),
      keywords: skillKeywords.slice(0, 10),
      job_postings: company.jobPostings.slice(0, 5).map(jp => ({
        title: jp.title,
        location: jp.location,
        posted_date: jp.postedDate,
      })),
      data_completeness_score: calculateCompleteness(company),
    };

    const { data: savedCompany, error: insertError } = await supabase
      .from('company_profiles')
      .upsert(companyData, { onConflict: 'apollo_organization_id' })
      .select()
      .single();

    if (insertError) {
      console.warn(`   ⚠️ Failed to upsert ${companyData.name}:`, insertError.message);
      continue;
    }

    insertedCompanies.push(savedCompany);
    console.log(`   ✅ Saved: ${savedCompany.name} (${company.discoveryStrategy})`);
  }

  console.log(`\n✅ Discovery complete: ${insertedCompanies.length} companies saved`);

  return createSuccessResponse({
    success: true,
    companies_discovered: discoveryResult.companies.length,
    companies_saved: insertedCompanies.length,
    companies: insertedCompanies.map(c => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      size: c.size,
      website: c.website,
      technologies: c.technologies_used?.slice(0, 5),
    })),
    pipeline: {
      socMappings: socMappings.map(s => ({ title: s.title, socCode: s.socCode, confidence: s.confidence })),
      skillExtraction: {
        method: skillResult.extractionMethod,
        skillCount: skillResult.skills.length,
        topSkills: skillResult.skills.slice(0, 5).map(s => s.skill),
      },
      discovery: discoveryResult.stats,
      filtering: {
        domain: domainClassification.domain,
        inputCount: discoveryResult.companies.length,
        passedCount: filteredCompanies.length,
      },
      location: normalizedLocation,
    },
  }, corsHeaders);
};

function calculateCompleteness(company: any): number {
  let score = 0;
  if (company.name) score += 15;
  if (company.description) score += 15;
  if (company.website) score += 10;
  if (company.industry && company.industry !== 'Unknown') score += 10;
  if (company.employeeCount) score += 10;
  if (company.technologies?.length > 0) score += 15;
  if (company.fundingStage) score += 10;
  if (company.location?.city && company.location?.state) score += 5;
  if (company.jobPostings?.length > 0) score += 10;
  return score;
}

Deno.serve(withErrorHandling(handler, getCorsHeaders));
