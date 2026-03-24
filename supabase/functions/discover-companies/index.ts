/**
 * Discover Companies Edge Function (Enhanced with Validation + Ranking)
 * 
 * Full EduThree1-parity pipeline:
 * 1. SOC code mapping from course context
 * 2. AI-powered skill extraction
 * 3. Location normalization with variants
 * 4. 3-strategy Apollo discovery
 * 5. Context-aware industry filtering
 * 6. AI company-course validation (NEW)
 * 7. Multi-factor ranking & selection (NEW)
 * 8. Upsert into company_profiles
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { mapCourseToSOC, getIndustryKeywordsFromSOC, getJobTitlesFromSOC } from "../_shared/capstone/course-soc-mapping.ts";
import { normalizeLocationForApollo } from "../_shared/capstone/location-utils.ts";
import { classifyCourseDomain, shouldExcludeIndustry } from "../_shared/capstone/context-aware-industry-filter.ts";
import { extractIndustrySkills } from "../_shared/capstone/skill-extraction.ts";
import { discoverCompanies } from "../_shared/capstone/apollo-precise-discovery.ts";
import type { EnhancedDiscoveryInput } from "../_shared/capstone/apollo-precise-discovery.ts";
import { filterValidCompanies } from "../_shared/capstone/company-validation-service.ts";
import { rankAndSelectCompanies } from "../_shared/capstone/company-ranking-service.ts";
import { enrichCompanyFull, calculateEnrichmentCompleteness } from "../_shared/capstone/apollo-enrichment-service.ts";
import { classifyCourseDomain as classifyDomainForEnrich } from "../_shared/capstone/context-aware-industry-filter.ts";

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

  const { data: los } = await supabase
    .from('learning_objectives')
    .select('id, text, bloom_level, search_keywords, core_concept')
    .eq('instructor_course_id', instructor_course_id);
  const objectiveTexts = (los || []).map((lo: any) => lo.text).filter(Boolean);
  const loSearchKeywords = (los || []).flatMap((lo: any) => lo.search_keywords || []).filter(Boolean);
  const bloomLevels = (los || []).map((lo: any) => lo.bloom_level).filter(Boolean);

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

  // ── Phase 3: Skill Extraction (AI-powered + LO search_keywords) ──
  console.log(`\n🧠 PHASE 3: SKILL EXTRACTION`);
  const skillResult = await extractIndustrySkills(objectiveTexts, course.title, course.academic_level || '', loSearchKeywords);
  const skillKeywords = skillResult.skills.map(s => s.skill);
  // Merge LO search_keywords for extra Apollo precision
  const combinedKeywords = [...new Set([...skillKeywords, ...loSearchKeywords.slice(0, 10)])];
  console.log(`   Extracted ${skillResult.skills.length} skills via ${skillResult.extractionMethod}`);
  if (loSearchKeywords.length > 0) {
    console.log(`   + ${loSearchKeywords.length} LO search_keywords merged`);
  }

  // ── Phase 4: Build Apollo Search Parameters ──
  const industryKeywords = getIndustryKeywordsFromSOC(socMappings);
  const jobTitles = getJobTitlesFromSOC(socMappings);
  const normalizedLocation = normalizeLocationForApollo(searchLocation);

  console.log(`\n🔧 PHASE 4: SEARCH PARAMETERS`);
  console.log(`   Industry keywords: ${industryKeywords.slice(0, 5).join(', ')}...`);
  console.log(`   Job titles: ${jobTitles.join(', ')}`);
  console.log(`   Location (normalized): ${normalizedLocation}`);

  // ── Phase 5: Apollo Multi-Strategy Discovery (Enhanced) ──
  // Request 3x target count to allow for validation filtering
  const socCodes = socMappings.map(s => s.socCode);
  const discoveryResult = await discoverCompanies({
    industries: industryKeywords,
    jobTitles,
    skillKeywords: combinedKeywords.slice(0, 15),
    location: normalizedLocation,
    targetCount: count * 3,
    socCodes,
    socMappings,
    courseTitle: course.title,
  } as EnhancedDiscoveryInput);

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

  // ── Phase 6b: AI Company-Course Validation ──
  console.log(`\n🔍 PHASE 6b: AI COMPANY-COURSE VALIDATION`);

  // Convert discovered companies to format expected by validation
  const companiesForValidation = filteredCompanies.map(c => ({
    name: c.name,
    description: c.description,
    sector: c.industry,
    industries: c.industryTags,
    keywords: skillKeywords.slice(0, 10),
    job_postings: c.jobPostings.map(jp => ({ title: jp.title })),
    technologies_used: c.technologies,
    website: c.website,
    // Preserve original data for upsert
    _original: c,
  }));

  const { validCompanies: validated, rejectedCompanies: rejected } = await filterValidCompanies(
    companiesForValidation,
    course.title,
    course.academic_level || 'undergraduate',
    objectiveTexts
  );

  console.log(`   Validated: ${validated.length} | Rejected: ${rejected.length}`);

  // ── Phase 6c: Multi-Factor Ranking ──
  console.log(`\n📊 PHASE 6c: RANKING & SELECTION`);
  const rankingResult = rankAndSelectCompanies(validated, searchLocation, count, combinedKeywords);
  console.log(`   Selected: ${rankingResult.selected.length} | Alternates: ${rankingResult.alternates.length}`);

  // ── Phase 7: Enrich + Upsert into company_profiles ──
  console.log(`\n💾 PHASE 7: ENRICHMENT + SAVING COMPANIES`);
  const insertedCompanies: any[] = [];
  const APOLLO_KEY = Deno.env.get('APOLLO_API_KEY')!;
  const courseDomainForEnrich = classifyDomainForEnrich(socMappings).domain;

  for (const ranked of rankingResult.selected) {
    const company = ranked.company;
    const original = company._original || company;

    // ── Enrichment: 3-stage Apollo enrichment per company ──
    let enrichData: Awaited<ReturnType<typeof enrichCompanyFull>> | null = null;
    try {
      const orgId = original.apolloId;
      const domain = original.website || original.primary_domain;
      if (orgId) {
        console.log(`   🔄 Enriching: ${original.name || company.name}...`);
        enrichData = await enrichCompanyFull(orgId, domain, courseDomainForEnrich, APOLLO_KEY);
      }
    } catch (e) {
      console.warn(`   ⚠️ Enrichment failed for ${original.name || company.name}:`, e);
    }

    const companyData: Record<string, unknown> = {
      name: original.name || company.name,
      sector: original.industry || company.sector,
      size: (enrichData?.enrichment?.employeeCount || original.employeeCount)
        ? `${enrichData?.enrichment?.employeeCount || original.employeeCount} employees` : 'Unknown',
      description: enrichData?.enrichment?.shortDescription || original.description || company.description,
      website: original.website || company.website || null,
      full_address: (() => {
        // Build from discovery location data (city/state/country from Apollo search)
        const loc = original.location;
        if (loc && (loc.city || loc.state)) {
          return [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
        }
        // Fallback to any existing address
        return company.full_address || searchLocation || null;
      })(),
      apollo_organization_id: original.apolloId || null,
      technologies_used: enrichData?.enrichment?.technologies?.length
        ? enrichData.enrichment.technologies
        : (original.technologies || company.technologies_used || []),
      funding_stage: enrichData?.enrichment?.fundingStage || original.fundingStage || null,
      total_funding_usd: enrichData?.enrichment?.totalFunding
        ? Math.round(enrichData.enrichment.totalFunding)
        : (original.totalFunding ? Math.round(original.totalFunding) : null),
      employee_count: (enrichData?.enrichment?.employeeCount || original.employeeCount)?.toString() || null,
      industries: enrichData?.enrichment?.industries?.length
        ? enrichData.enrichment.industries.slice(0, 10)
        : (original.industryTags || company.industries || []).slice(0, 10),
      keywords: combinedKeywords.slice(0, 10),
      job_postings: (enrichData?.jobPostings?.length
        ? enrichData.jobPostings
        : (original.jobPostings || company.job_postings || [])
      ).slice(0, 10).map((jp: any) => ({
        title: jp.title,
        location: jp.location,
        posted_date: jp.postedDate || jp.posted_date || jp.posted_at,
        description: jp.description?.substring(0, 200),
      })),
      data_completeness_score: enrichData?.completenessScore ?? calculateEnrichmentCompleteness(null, null, (original.jobPostings || []).length, (original.technologies || []).length),
      match_score: ranked.scores.composite,
      match_reason: ranked.selectionReason,
      // Phase 1 new columns
      instructor_course_id,
      discovery_source: original.discoveryStrategy || 'unknown',
      seo_description: enrichData?.enrichment?.seoDescription || null,
      buying_intent_signals: enrichData?.buyingIntent || original.buyingIntentSignals || null,
      contact_first_name: enrichData?.contact?.firstName || null,
      contact_last_name: enrichData?.contact?.lastName || null,
      contact_email: enrichData?.contact?.email || null,
      contact_title: enrichData?.contact?.title || null,
      contact_phone: enrichData?.contact?.phone || null,
      contact_person: enrichData?.contact
        ? `${enrichData.contact.firstName} ${enrichData.contact.lastName}`.trim()
        : null,
      linkedin_profile: enrichData?.contact?.linkedinUrl || enrichData?.enrichment?.linkedinUrl || null,
      departmental_head_count: enrichData?.enrichment?.departmentalHeadCount || null,
      organization_revenue_range: enrichData?.enrichment?.revenueRange || null,
      last_enriched_at: enrichData ? new Date().toISOString() : null,
      similarity_score: ranked.scores.semantic,
      match_confidence: ranked.scores.composite >= 0.7 ? 'high' : ranked.scores.composite >= 0.4 ? 'medium' : 'low',
    };

    const { data: savedCompany, error: insertError } = await supabase
      .from('company_profiles')
      .upsert(companyData, { onConflict: 'apollo_organization_id' })
      .select()
      .single();

    if (insertError) {
      console.warn(`   ⚠️ Failed to upsert ${companyData.name}:`, insertError.message);
      // Fallback: try insert without upsert constraint
      const { data: fallbackCompany, error: fallbackError } = await supabase
        .from('company_profiles')
        .insert({ ...companyData, apollo_organization_id: null })
        .select()
        .single();

      if (fallbackError) {
        console.error(`   ❌ Fallback insert also failed:`, fallbackError.message);
        continue;
      }
      insertedCompanies.push(fallbackCompany);
      console.log(`   ✅ Saved (fallback): ${fallbackCompany.name}`);
      continue;
    }

    insertedCompanies.push(savedCompany);
    console.log(`   ✅ Saved: ${savedCompany.name} (rank #${ranked.rank}, score: ${(ranked.scores.composite * 100).toFixed(0)}%)`);
  }

  console.log(`\n✅ Discovery complete: ${insertedCompanies.length} companies saved`);

  return createSuccessResponse({
    success: true,
    companies_discovered: discoveryResult.companies.length,
    companies_filtered: filteredCompanies.length,
    companies_validated: validated.length,
    companies_rejected: rejected.length,
    companies_saved: insertedCompanies.length,
    companies: insertedCompanies.map(c => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      size: c.size,
      website: c.website,
      technologies: c.technologies_used?.slice(0, 5),
      match_score: c.match_score,
      match_reason: c.match_reason,
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
      validation: {
        validated: validated.length,
        rejected: rejected.length,
        rejectionReasons: rejected.slice(0, 5).map(r => `${r.company.name}: ${r.reason}`),
      },
      ranking: rankingResult.selectionSummary,
      location: normalizedLocation,
    },
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
