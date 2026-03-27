/**
 * Discover Companies Edge Function — Full EduThree-Parity Pipeline
 *
 * When USE_NEW_PIPELINE=false (default):
 *   10-phase pipeline (legacy):
 *   1. Fetch course data
 *   2. SOC code mapping from course context
 *   2b. O*NET occupational enrichment (skills, DWAs, tools, technologies)
 *   3. AI-powered skill extraction + O*NET skill merge
 *   4. Build Apollo search parameters
 *   5. Apollo multi-strategy discovery
 *   6. Context-aware industry filtering
 *   6b. AI company-course validation
 *   6c. Semantic matching (TF-IDF + adaptive threshold)
 *   6d. Multi-factor ranking & selection
 *   7. 3-stage enrichment + upsert
 *   8. Signal scoring (4 parallel signals)
 *   9. Career page validation (Firecrawl)
 *   10. Inferred needs synthesis + final update
 *
 * When USE_NEW_PIPELINE=true:
 *   Existing Apollo discovery (Phases 1-6b) runs first, then the NEW
 *   5-phase enhancement pipeline takes over:
 *   Phase 2b*: O*NET STRUCTURED occupational enrichment (DWAs, technologies, industries)
 *   Phase 6c*: Semantic validation via Lightcast skill ID matching
 *   Phase 6d*: Multi-factor ranking with re-scored companies
 *   Phase 8*:  Signal scoring (4 parallel signals via signal-orchestrator)
 *   Phase 9*:  Career page validation (Firecrawl) on top 5
 *   Phase 10*: Inferred needs synthesis from job postings + tech stack
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

// Legacy EduThree-parity services (used when USE_NEW_PIPELINE is false)
import { mapSkillsToOnet } from "../_shared/capstone/onet-service.ts";
import { rankCompaniesBySimilarity } from "../_shared/capstone/semantic-matching-service.ts";
import { calculateBatchSignals, toStorableSignalData } from "../_shared/capstone/signals/index.ts";
import { validateCareerPage } from "../_shared/capstone/career-page-validator.ts";
import { inferCompanyNeeds } from "../_shared/capstone/inferred-needs-service.ts";
import type { CompanyForSignal } from "../_shared/capstone/signal-types.ts";

// NEW pipeline services (used when USE_NEW_PIPELINE is true)
import { mapSkillsToOccupations } from "../_shared/capstone/onet-structured-service.ts";
import { validateCompaniesSemanticly } from "../_shared/capstone/semantic-validation-v2-service.ts";
import type { SemanticValidationOutput } from "../_shared/capstone/semantic-validation-v2-service.ts";
import { calculateBatchSignals as calculateBatchSignalsV2, toStorableSignalData as toStorableSignalDataV2 } from "../_shared/capstone/signals/signal-orchestrator.ts";
import { validateCareerPage as validateCareerPageV2 } from "../_shared/capstone/career-page-validator.ts";
import { inferCompanyNeeds as inferCompanyNeedsV2 } from "../_shared/capstone/inferred-needs-service.ts";
import { extractSkills, isLightcastConfigured } from "../_shared/lightcast-client.ts";

// Rate-limit headers
import { checkInMemoryRateLimit, getEstimatedRateLimitHeaders } from "../_shared/capstone/rate-limit-headers.ts";

// ── Feature flag ──
const useNewPipeline = Deno.env.get('USE_NEW_PIPELINE') === 'true';

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

  // ── Rate-limit check (sliding window per user) ──
  const rateLimit = checkInMemoryRateLimit(
    `discover:${user.id}`,
    20, // max 20 discovery runs per 60 s
    60_000
  );
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' }),
      {
        status: 429,
        headers: { ...corsHeaders, ...rateLimit.headers, 'Content-Type': 'application/json' },
      }
    );
  }

  /** Merge rate-limit + CORS headers into every response */
  const responseHeaders = { ...corsHeaders, ...rateLimit.headers };

  const { instructor_course_id, count = 10 } = await req.json();
  if (!instructor_course_id) {
    return createErrorResponse('BAD_REQUEST', responseHeaders, 'instructor_course_id is required');
  }

  // Verify instructor ownership
  const { data: isInstructor } = await supabase.rpc('is_course_instructor', {
    _user_id: user.id,
    _course_id: instructor_course_id,
  });
  if (!isInstructor) return createErrorResponse('FORBIDDEN', responseHeaders);

  // Check Apollo API key
  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  if (!APOLLO_API_KEY) {
    return createErrorResponse('CONFIG_ERROR', responseHeaders, 'Apollo API key not configured.');
  }

  console.log(`\n🔬 Pipeline mode: ${useNewPipeline ? 'NEW (5-phase enhancement)' : 'LEGACY (10-phase)'}`);

  const pipelineStart = Date.now();
  const phaseTimings: Record<string, number> = {};
  const phasesCompleted: string[] = [];
  let generationRunId: string | null = null;

  // ── Create Generation Run for audit trail ──
  try {
    const { data: run } = await supabase
      .from('capstone_generation_runs')
      .insert({
        instructor_course_id,
        started_by: user.id,
        status: 'running',
        current_phase: 'initialization',
      })
      .select('id')
      .single();
    generationRunId = run?.id || null;
  } catch (e) {
    console.warn('⚠️ Could not create generation run:', e);
  }

  const updateRun = async (updates: Record<string, unknown>) => {
    if (!generationRunId) return;
    try {
      await supabase.from('capstone_generation_runs').update(updates).eq('id', generationRunId);
    } catch { /* non-critical */ }
  };

  // ── Phase 1: Fetch course data ──
  let phaseStart = Date.now();
  await updateRun({ current_phase: 'fetch_course' });

  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, search_location, location_city, location_state, academic_level')
    .eq('id', instructor_course_id)
    .single();
  if (courseError || !course) {
    await updateRun({ status: 'failed', error_details: { phase: 'fetch_course', error: 'Course not found' } });
    return createErrorResponse('NOT_FOUND', responseHeaders, 'Course not found');
  }

  const { data: los } = await supabase
    .from('learning_objectives')
    .select('id, text, bloom_level, search_keywords, core_concept')
    .eq('instructor_course_id', instructor_course_id);
  const objectiveTexts = (los || []).map((lo: any) => lo.text).filter(Boolean);
  const loSearchKeywords = (los || []).flatMap((lo: any) => lo.search_keywords || []).filter(Boolean);

  if (objectiveTexts.length === 0) {
    await updateRun({ status: 'failed', error_details: { phase: 'fetch_course', error: 'No learning objectives' } });
    return createErrorResponse('BAD_REQUEST', responseHeaders, 'Course has no learning objectives for skill extraction');
  }

  const searchLocation = course.search_location ||
    (course.location_city && course.location_state ? `${course.location_city}, ${course.location_state}` : null);

  if (!searchLocation) {
    await updateRun({ status: 'failed', error_details: { phase: 'fetch_course', error: 'No location' } });
    return createErrorResponse('BAD_REQUEST', responseHeaders, 'Course location not set.');
  }

  phaseTimings['fetch_course'] = Date.now() - phaseStart;
  phasesCompleted.push('fetch_course');

  console.log(`\n🔍 ═══════════════════════════════════════`);
  console.log(`   CAPSTONE COMPANY DISCOVERY PIPELINE (v2)`);
  console.log(`   Course: ${course.title}`);
  console.log(`   Location: ${searchLocation}`);
  console.log(`   Objectives: ${objectiveTexts.length}`);
  console.log(`   Run ID: ${generationRunId}`);
  console.log(`═══════════════════════════════════════════\n`);

  // ── Phase 2: SOC Code Mapping ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'soc_mapping' });
  console.log(`\n📋 PHASE 2: SOC CODE MAPPING`);
  const socMappings = mapCourseToSOC(course.title, objectiveTexts, course.academic_level || '');
  console.log(`   Found ${socMappings.length} SOC mappings`);
  phaseTimings['soc_mapping'] = Date.now() - phaseStart;
  phasesCompleted.push('soc_mapping');

  // ── Phase 2b: O*NET Occupational Enrichment ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'onet_mapping' });
  console.log(`\n🏛️ PHASE 2b: O*NET OCCUPATIONAL ENRICHMENT`);
  let onetResult = await mapSkillsToOnet(loSearchKeywords.length > 0 ? loSearchKeywords.slice(0, 10) : objectiveTexts.slice(0, 5));

  // Merge O*NET skills/technologies into our keyword pool
  const onetSkills = onetResult.occupations.flatMap(o => o.skills.map(s => s.name));
  const onetTechnologies = onetResult.occupations.flatMap(o => o.technologies);
  console.log(`   O*NET occupations: ${onetResult.occupations.length}, skills: ${onetSkills.length}, tech: ${onetTechnologies.length}`);
  phaseTimings['onet_mapping'] = Date.now() - phaseStart;
  phasesCompleted.push('onet_mapping');

  // Store O*NET data in generation run
  await updateRun({
    onet_data: {
      occupations: onetResult.occupations.map(o => ({ code: o.code, title: o.title, matchScore: o.matchScore })),
      totalMapped: onetResult.totalMapped,
      unmappedSkills: onetResult.unmappedSkills,
      apiCalls: onetResult.apiCalls,
      cacheHits: onetResult.cacheHits,
    },
  });

  // ── Phase 3: Skill Extraction (AI + LO keywords + O*NET) ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'skill_extraction' });
  console.log(`\n🧠 PHASE 3: SKILL EXTRACTION`);
  const skillResult = await extractIndustrySkills(objectiveTexts, course.title, course.academic_level || '', loSearchKeywords);
  const skillKeywords = skillResult.skills.map(s => s.skill);

  // Merge all keyword sources: extracted skills + LO keywords + O*NET skills + O*NET technologies
  const combinedKeywords = [...new Set([
    ...skillKeywords,
    ...loSearchKeywords.slice(0, 10),
    ...onetSkills.slice(0, 10),
    ...onetTechnologies.slice(0, 10),
  ])];
  console.log(`   Extracted ${skillResult.skills.length} skills via ${skillResult.extractionMethod}`);
  console.log(`   + ${onetSkills.length} O*NET skills, ${onetTechnologies.length} O*NET tech`);
  console.log(`   Combined keywords: ${combinedKeywords.length}`);
  phaseTimings['skill_extraction'] = Date.now() - phaseStart;
  phasesCompleted.push('skill_extraction');

  // ── Phase 4: Build Apollo Search Parameters ──
  const industryKeywords = getIndustryKeywordsFromSOC(socMappings);
  const jobTitles = getJobTitlesFromSOC(socMappings);
  const normalizedLocation = normalizeLocationForApollo(searchLocation);

  console.log(`\n🔧 PHASE 4: SEARCH PARAMETERS`);
  console.log(`   Industry keywords: ${industryKeywords.slice(0, 5).join(', ')}...`);
  console.log(`   Job titles: ${jobTitles.join(', ')}`);
  console.log(`   Location (normalized): ${normalizedLocation}`);

  // ── Phase 5: Apollo Multi-Strategy Discovery ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'discovery' });
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
  phaseTimings['discovery'] = Date.now() - phaseStart;
  phasesCompleted.push('discovery');
  await updateRun({ companies_discovered: discoveryResult.companies.length });

  if (discoveryResult.companies.length === 0) {
    await updateRun({ status: 'completed', completed_at: new Date().toISOString(), companies_discovered: 0 });
    return createSuccessResponse({
      success: true, companies_discovered: 0, companies_saved: 0, companies: [],
      message: 'No companies found matching the course criteria in this location.',
      debug: { socMappings: socMappings.map(s => s.title), industryKeywords, jobTitles, skillCount: skillResult.skills.length, extractionMethod: skillResult.extractionMethod, location: normalizedLocation },
    }, responseHeaders);
  }

  // ── Phase 6: Context-Aware Industry Filtering ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'filtering' });
  console.log(`\n🏭 PHASE 6: INDUSTRY FILTERING`);
  const domainClassification = classifyCourseDomain(socMappings);
  console.log(`   Course domain: ${domainClassification.domain} (${(domainClassification.confidence * 100).toFixed(0)}%)`);

  const filteredCompanies = discoveryResult.companies.filter(company => {
    const decision = shouldExcludeIndustry(company.industry, domainClassification.domain, socMappings, company.jobPostings);
    if (decision.shouldExclude) console.log(`   ❌ Excluded: ${company.name} (${decision.reason})`);
    return !decision.shouldExclude;
  });
  console.log(`   Passed filtering: ${filteredCompanies.length}/${discoveryResult.companies.length}`);
  phaseTimings['filtering'] = Date.now() - phaseStart;
  phasesCompleted.push('filtering');

  // ── Phase 6b: AI Company-Course Validation ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'validation' });
  console.log(`\n🔍 PHASE 6b: AI COMPANY-COURSE VALIDATION`);

  const companiesForValidation = filteredCompanies.map(c => ({
    name: c.name, description: c.description, sector: c.industry,
    industries: c.industryTags, keywords: skillKeywords.slice(0, 10),
    job_postings: c.jobPostings.map(jp => ({ title: jp.title })),
    technologies_used: c.technologies, website: c.website, _original: c,
  }));

  const { validCompanies: validated, rejectedCompanies: rejected } = await filterValidCompanies(
    companiesForValidation, course.title, course.academic_level || 'undergraduate', objectiveTexts
  );
  console.log(`   Validated: ${validated.length} | Rejected: ${rejected.length}`);
  phaseTimings['validation'] = Date.now() - phaseStart;
  phasesCompleted.push('validation');
  await updateRun({ companies_validated: validated.length });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW PIPELINE PATH — 5-phase enhancement after Apollo discovery
  // Gated behind USE_NEW_PIPELINE env var
  // ═══════════════════════════════════════════════════════════════════════════
  if (useNewPipeline) {
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  NEW PIPELINE: 5-Phase Enhancement (Lightcast + O*NET)    ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);

    // ── Phase 2b*: O*NET STRUCTURED Occupational Enrichment ──
    phaseStart = Date.now();
    await updateRun({ current_phase: 'onet_structured' });
    console.log(`\n🏛️ PHASE 2b*: O*NET STRUCTURED ENRICHMENT`);

    // Build Lightcast-style skill objects from extracted skills + LO keywords
    const lightcastSkillInputs = combinedKeywords.map((kw, idx) => ({
      id: `skill-${idx}`,
      name: kw,
      type: 'Hard Skill',
      category: 'Technical',
      confidence: 0.8,
      relatedSkillIds: [] as string[],
    }));

    let onetStructuredResult: Awaited<ReturnType<typeof mapSkillsToOccupations>>;
    try {
      onetStructuredResult = await mapSkillsToOccupations({
        courseTitle: course.title,
        skills: lightcastSkillInputs,
      });
      console.log(`   Occupations: ${onetStructuredResult.occupations.length}`);
      console.log(`   Technologies: ${onetStructuredResult.allTechnologies.length}`);
      console.log(`   DWAs: ${onetStructuredResult.allDWAs.length}`);
      console.log(`   Industries: ${onetStructuredResult.allIndustries.length}`);
    } catch (e) {
      console.warn(`   ⚠️ O*NET structured enrichment failed, continuing without:`, e);
      onetStructuredResult = {
        occupations: [],
        allIndustries: [],
        allTechnologies: [],
        allDWAs: [],
        processingTimeMs: Date.now() - phaseStart,
      };
    }

    phaseTimings['onet_structured'] = Date.now() - phaseStart;
    phasesCompleted.push('onet_structured');

    await updateRun({
      onet_structured_data: {
        occupations: onetStructuredResult.occupations.map(o => ({
          socCode: o.socCode,
          title: o.title,
          confidence: o.confidence,
          dwaCount: o.dwas.length,
          techCount: o.technologies.length,
        })),
        totalIndustries: onetStructuredResult.allIndustries.length,
        totalTechnologies: onetStructuredResult.allTechnologies.length,
        totalDWAs: onetStructuredResult.allDWAs.length,
      },
    });

    // ── Phase 6c*: Semantic Validation (Lightcast Skill ID Matching) ──
    phaseStart = Date.now();
    await updateRun({ current_phase: 'semantic_validation_v2' });
    console.log(`\n🧠 PHASE 6c*: SEMANTIC VALIDATION (Lightcast Skill IDs)`);

    // Prepare course skill IDs for the validation service
    const courseSkillIds = lightcastSkillInputs;
    const courseDWAs = onetStructuredResult.allDWAs.map(d => ({
      id: d.id,
      name: d.name,
      importance: d.importance,
    }));

    // Convert validated companies to the format expected by semantic-validation-v2
    const companiesForSemanticV2 = validated.map((c: any) => {
      const orig = c._original || c;
      return {
        name: orig.name || c.name,
        jobPostings: (orig.jobPostings || c.job_postings || []).map((jp: any, idx: number) => ({
          id: jp.id || `jp-${idx}`,
          title: jp.title || '',
          description: jp.description || '',
        })),
        technologies: orig.technologies || c.technologies_used || [],
        industry: orig.industry || c.sector,
        description: orig.description || c.description,
        _original: orig,
      };
    });

    let semanticV2Result: SemanticValidationOutput;
    try {
      semanticV2Result = await validateCompaniesSemanticly({
        companies: companiesForSemanticV2,
        courseSkillIds,
        courseDWAs,
      });
      console.log(`   Passed validation: ${semanticV2Result.stats.passedValidation}/${semanticV2Result.stats.inputCount}`);
      console.log(`   High confidence: ${semanticV2Result.stats.highConfidence}`);
      console.log(`   Avg semantic score: ${(semanticV2Result.stats.avgSemanticScore * 100).toFixed(0)}%`);
    } catch (e) {
      console.warn(`   ⚠️ Semantic validation v2 failed, using all validated companies:`, e);
      semanticV2Result = {
        validatedCompanies: companiesForSemanticV2 as any,
        stats: {
          inputCount: companiesForSemanticV2.length,
          passedValidation: companiesForSemanticV2.length,
          highConfidence: 0,
          mediumConfidence: companiesForSemanticV2.length,
          failedValidation: 0,
          avgSemanticScore: 0,
          processingTimeMs: Date.now() - phaseStart,
        },
      };
    }

    phaseTimings['semantic_validation_v2'] = Date.now() - phaseStart;
    phasesCompleted.push('semantic_validation_v2');

    // ── Phase 6d*: Multi-Factor Ranking (re-rank with semantic scores) ──
    phaseStart = Date.now();
    await updateRun({ current_phase: 'ranking_v2' });
    console.log(`\n📊 PHASE 6d*: MULTI-FACTOR RANKING (re-ranked)`);

    const companiesForRanking = semanticV2Result.validatedCompanies.map((vc: any) => ({
      ...vc,
      _original: vc._original || vc,
    }));

    const rankingResult = await rankAndSelectCompanies(
      companiesForRanking,
      searchLocation,
      count,
      combinedKeywords
    );
    console.log(`   Selected: ${rankingResult.selected.length} | Alternates: ${rankingResult.alternates.length}`);

    phaseTimings['ranking_v2'] = Date.now() - phaseStart;
    phasesCompleted.push('ranking_v2');

    // ── Phase 7*: Enrich + Upsert (same as legacy Phase 7) ──
    phaseStart = Date.now();
    await updateRun({ current_phase: 'enrichment' });
    console.log(`\n💾 PHASE 7*: ENRICHMENT + SAVING COMPANIES`);
    const insertedCompanies: any[] = [];
    const APOLLO_KEY = Deno.env.get('APOLLO_API_KEY')!;
    const courseDomainForEnrich = classifyDomainForEnrich(socMappings).domain;

    for (const ranked of rankingResult.selected) {
      const company = ranked.company;
      const original = company._original || company;

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

      // Get semantic validation data for this company
      const semValCompany = semanticV2Result.validatedCompanies.find(
        (vc: any) => (vc.name || vc._original?.name) === (original.name || company.name)
      ) as any;
      const validationData = semValCompany?.validation;

      const companyData: Record<string, unknown> = {
        name: original.name || company.name,
        sector: original.industry || company.sector,
        size: (enrichData?.enrichment?.employeeCount || original.employeeCount)
          ? `${enrichData?.enrichment?.employeeCount || original.employeeCount} employees` : 'Unknown',
        description: enrichData?.enrichment?.shortDescription || original.description || company.description,
        website: original.website || company.website || null,
        full_address: (() => {
          const enrich = enrichData?.enrichment;
          if (enrich && (enrich.streetAddress || enrich.city)) {
            return [enrich.streetAddress, enrich.city, enrich.state, enrich.postalCode].filter(Boolean).join(', ');
          }
          const loc = original.location;
          if (loc) return [loc.streetAddress, loc.city, loc.state, loc.postalCode, loc.country].filter(Boolean).join(', ');
          return company.full_address || searchLocation || null;
        })(),
        city: enrichData?.enrichment?.city || original.location?.city || null,
        state: enrichData?.enrichment?.state || original.location?.state || null,
        zip: enrichData?.enrichment?.postalCode || original.location?.postalCode || null,
        country: enrichData?.enrichment?.country || original.location?.country || null,
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
          title: jp.title, location: jp.location,
          posted_date: jp.postedDate || jp.posted_date || jp.posted_at,
          description: jp.description?.substring(0, 200),
        })),
        data_completeness_score: enrichData?.completenessScore ?? calculateEnrichmentCompleteness(null, null, (original.jobPostings || []).length, (original.technologies || []).length),
        match_score: ranked.scores.composite,
        match_reason: ranked.selectionReason,
        instructor_course_id,
        generation_run_id: generationRunId,
        discovery_source: original.discoveryStrategy || 'unknown',
        seo_description: enrichData?.enrichment?.seoDescription || null,
        buying_intent_signals: enrichData?.buyingIntent || original.buyingIntentSignals || null,
        // Contact fields
        contact_first_name: enrichData?.contact?.firstName || null,
        contact_last_name: enrichData?.contact?.lastName || null,
        contact_email: enrichData?.contact?.email || null,
        contact_title: enrichData?.contact?.title || null,
        contact_phone: enrichData?.contact?.phone || null,
        contact_person: enrichData?.contact ? `${enrichData.contact.firstName} ${enrichData.contact.lastName}`.trim() : null,
        contact_headline: enrichData?.contact?.headline || null,
        contact_photo_url: enrichData?.contact?.photoUrl || null,
        contact_city: enrichData?.contact?.city || null,
        contact_state: enrichData?.contact?.state || null,
        contact_country: enrichData?.contact?.country || null,
        contact_email_status: enrichData?.contact?.emailStatus || null,
        contact_twitter_url: enrichData?.contact?.twitterUrl || null,
        contact_phone_numbers: enrichData?.contact?.phoneNumbers?.length ? enrichData.contact.phoneNumbers : null,
        contact_employment_history: enrichData?.contact?.employmentHistory?.length ? enrichData.contact.employmentHistory : null,
        // Organization metadata
        linkedin_profile: enrichData?.contact?.linkedinUrl || enrichData?.enrichment?.linkedinUrl || null,
        organization_linkedin_url: enrichData?.enrichment?.linkedinUrl || null,
        organization_twitter_url: enrichData?.enrichment?.twitterUrl || null,
        organization_facebook_url: enrichData?.enrichment?.facebookUrl || null,
        organization_logo_url: enrichData?.enrichment?.logoUrl || null,
        organization_founded_year: enrichData?.enrichment?.foundedYear || null,
        organization_industry_keywords: enrichData?.enrichment?.industryKeywords?.length ? enrichData.enrichment.industryKeywords : null,
        departmental_head_count: enrichData?.enrichment?.departmentalHeadCount || null,
        organization_revenue_range: enrichData?.enrichment?.revenueRange || null,
        funding_events: enrichData?.enrichment?.fundingEvents?.length ? enrichData.enrichment.fundingEvents : null,
        // Enrichment metadata
        last_enriched_at: enrichData ? new Date().toISOString() : null,
        data_enrichment_level: enrichData ? 'apollo_verified' : 'basic',
        matching_skills: validationData?.skillMatches?.map((m: any) => m.courseSkillName) || combinedKeywords.slice(0, 15),
        similarity_score: validationData?.overallScore ?? ranked.scores.semantic,
        match_confidence: ranked.scores.composite >= 0.7 ? 'high' : ranked.scores.composite >= 0.4 ? 'medium' : 'low',
        // NEW: Semantic validation V2 data
        semantic_validation: validationData ? {
          overallScore: validationData.overallScore,
          confidence: validationData.confidence,
          skillMatchScore: validationData.skillMatchScore,
          dwaMatchScore: validationData.dwaMatchScore,
          technologyMatchScore: validationData.technologyMatchScore,
          explanation: validationData.explanation,
          missingSkills: validationData.missingSkills,
        } : null,
      };

      const { data: savedCompany, error: insertError } = await supabase
        .from('company_profiles')
        .upsert(companyData, { onConflict: 'apollo_organization_id' })
        .select()
        .single();

      if (insertError) {
        console.warn(`   ⚠️ Failed to upsert ${companyData.name}:`, insertError.message);
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

    phaseTimings['enrichment'] = Date.now() - phaseStart;
    phasesCompleted.push('enrichment');
    await updateRun({ companies_saved: insertedCompanies.length });

    // ── Phase 8*: Signal Scoring (4 parallel signals via signal-orchestrator) ──
    phaseStart = Date.now();
    await updateRun({ current_phase: 'signal_scoring_v2' });
    console.log(`\n📡 PHASE 8*: SIGNAL SCORING (4 parallel signals)`);

    const companiesForSignals: CompanyForSignal[] = insertedCompanies.map((c: any) => ({
      id: c.id,
      name: c.name,
      apollo_organization_id: c.apollo_organization_id,
      industries: c.industries,
      departmental_head_count: c.departmental_head_count,
      technologies: c.technologies_used,
      technologies_used: c.technologies_used,
      job_postings: c.job_postings,
      description: c.description,
      size: c.size,
      sector: c.sector,
      funding_stage: c.funding_stage,
      total_funding_usd: c.total_funding_usd,
      contact_email: c.contact_email,
      contact_person: c.contact_person,
      contact_title: c.contact_title,
    }));

    const syllabusDomain = domainClassification.domain;
    const signalResults = await calculateBatchSignalsV2(
      companiesForSignals, combinedKeywords, syllabusDomain, APOLLO_API_KEY
    );

    let signalSummary: Record<string, unknown> = {};
    for (const [companyId, composite] of signalResults) {
      const storable = toStorableSignalDataV2(composite);
      const { error: signalError } = await supabase
        .from('company_profiles')
        .update({
          skill_match_score: storable.skill_match_score,
          market_signal_score: storable.market_signal_score,
          department_fit_score: storable.department_fit_score,
          contact_quality_score: storable.contact_quality_score,
          composite_signal_score: storable.composite_signal_score,
          signal_confidence: storable.signal_confidence,
          signal_data: storable.signal_data,
        })
        .eq('id', companyId);

      if (signalError) {
        console.warn(`   ⚠️ Signal update failed for ${companyId}:`, signalError.message);
      } else {
        const company = insertedCompanies.find((c: any) => c.id === companyId);
        console.log(`   📊 ${company?.name}: composite=${composite.overall}, confidence=${composite.confidence}`);
      }
    }

    const signalScores = [...signalResults.values()];
    signalSummary = {
      companiesScored: signalScores.length,
      avgComposite: signalScores.length > 0 ? Math.round(signalScores.reduce((s, c) => s + c.overall, 0) / signalScores.length) : 0,
      confidenceDistribution: {
        high: signalScores.filter(s => s.confidence === 'high').length,
        medium: signalScores.filter(s => s.confidence === 'medium').length,
        low: signalScores.filter(s => s.confidence === 'low').length,
      },
    };

    phaseTimings['signal_scoring_v2'] = Date.now() - phaseStart;
    phasesCompleted.push('signal_scoring_v2');

    // ── Phase 9*: Career Page Validation (Firecrawl) — top 5 only ──
    phaseStart = Date.now();
    await updateRun({ current_phase: 'career_validation_v2' });
    console.log(`\n🔥 PHASE 9*: CAREER PAGE VALIDATION`);

    const topCompaniesForCareer = insertedCompanies
      .filter((c: any) => c.website)
      .slice(0, 5);

    for (const company of topCompaniesForCareer) {
      try {
        const careerResult = await validateCareerPageV2(company.website, company.name);
        if (careerResult.success && careerResult.jobCount > 0) {
          await supabase
            .from('company_profiles')
            .update({
              signal_data: {
                ...(typeof company.signal_data === 'object' ? company.signal_data : {}),
                careerPageValidation: {
                  careerPageUrl: careerResult.careerPageUrl,
                  jobCount: careerResult.jobCount,
                  hiringVelocity: careerResult.hiringVelocitySignal,
                  hiringDepartments: careerResult.hiringDepartments,
                  techStack: careerResult.techStack,
                },
              },
            })
            .eq('id', company.id);
          console.log(`   ✅ ${company.name}: ${careerResult.jobCount} jobs on career page (${careerResult.hiringVelocitySignal})`);
        }
      } catch (e) {
        console.warn(`   ⚠️ Career validation failed for ${company.name}:`, e);
      }
    }

    phaseTimings['career_validation_v2'] = Date.now() - phaseStart;
    phasesCompleted.push('career_validation_v2');

    // ── Phase 10*: Inferred Needs Synthesis ──
    phaseStart = Date.now();
    await updateRun({ current_phase: 'inferred_needs_v2' });
    console.log(`\n💡 PHASE 10*: INFERRED NEEDS SYNTHESIS`);

    for (const company of insertedCompanies) {
      try {
        const needs = inferCompanyNeedsV2(
          Array.isArray(company.job_postings) ? company.job_postings : [],
          Array.isArray(company.technologies_used) ? company.technologies_used : [],
          company.description || '',
          company.funding_stage,
          company.employee_count,
          company.name,
          company.sector || company.industry
        );

        if (needs.needs.length > 0) {
          await supabase
            .from('company_profiles')
            .update({ inferred_needs: needs.needs })
            .eq('id', company.id);
          console.log(`   💡 ${company.name}: ${needs.needs.length} needs, ${needs.growthAreas.length} growth areas`);
        }
      } catch (e) {
        console.warn(`   ⚠️ Needs inference failed for ${company.name}:`, e);
      }
    }

    phaseTimings['inferred_needs_v2'] = Date.now() - phaseStart;
    phasesCompleted.push('inferred_needs_v2');

    // ── Finalize Generation Run (new pipeline) ──
    const totalTime = Date.now() - pipelineStart;
    await updateRun({
      status: 'completed',
      completed_at: new Date().toISOString(),
      phases_completed: phasesCompleted,
      phase_timings: phaseTimings,
      total_processing_time_ms: totalTime,
      signal_summary: signalSummary,
      pipeline_version: 'v3-new-pipeline',
    });

    console.log(`\n✅ NEW PIPELINE complete in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   Phases: ${phasesCompleted.join(' → ')}`);
    console.log(`   Companies saved: ${insertedCompanies.length}`);

    return createSuccessResponse({
      success: true,
      generation_run_id: generationRunId,
      pipeline_version: 'v3-new-pipeline',
      companies_discovered: discoveryResult.companies.length,
      companies_filtered: filteredCompanies.length,
      companies_validated: validated.length,
      companies_semantic_validated: semanticV2Result.stats.passedValidation,
      companies_rejected: rejected.length,
      companies_saved: insertedCompanies.length,
      companies: insertedCompanies.map((c: any) => ({
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
        version: 'v3-new-pipeline',
        totalTimeMs: totalTime,
        phases: phaseTimings,
        socMappings: socMappings.map(s => ({ title: s.title, socCode: s.socCode, confidence: s.confidence })),
        onetStructured: {
          occupations: onetStructuredResult.occupations.length,
          industries: onetStructuredResult.allIndustries.length,
          technologies: onetStructuredResult.allTechnologies.length,
          dwas: onetStructuredResult.allDWAs.length,
          processingTimeMs: onetStructuredResult.processingTimeMs,
        },
        onet: {
          occupations: onetResult.occupations.length,
          skills: onetSkills.length,
          technologies: onetTechnologies.length,
          apiCalls: onetResult.apiCalls,
        },
        skillExtraction: {
          method: skillResult.extractionMethod,
          skillCount: skillResult.skills.length,
          topSkills: skillResult.skills.slice(0, 5).map(s => s.skill),
          combinedKeywords: combinedKeywords.length,
        },
        discovery: discoveryResult.stats,
        filtering: {
          domain: domainClassification.domain,
          inputCount: discoveryResult.companies.length,
          passedCount: filteredCompanies.length,
        },
        semanticValidationV2: {
          inputCount: semanticV2Result.stats.inputCount,
          passedValidation: semanticV2Result.stats.passedValidation,
          highConfidence: semanticV2Result.stats.highConfidence,
          mediumConfidence: semanticV2Result.stats.mediumConfidence,
          avgSemanticScore: semanticV2Result.stats.avgSemanticScore,
          processingTimeMs: semanticV2Result.stats.processingTimeMs,
        },
        validation: {
          validated: validated.length,
          rejected: rejected.length,
          rejectionReasons: rejected.slice(0, 5).map(r => `${r.company.name}: ${r.reason}`),
        },
        ranking: rankingResult.selectionSummary,
        signals: signalSummary,
        location: normalizedLocation,
      },
    }, responseHeaders);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY PIPELINE PATH (USE_NEW_PIPELINE !== 'true')
  // Everything below is the original 10-phase pipeline — untouched.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Phase 6c: Semantic Matching (O*NET-enriched) ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'semantic_matching' });
  console.log(`\n🧠 PHASE 6c: SEMANTIC MATCHING`);

  const semanticResult = rankCompaniesBySimilarity(
    combinedKeywords,
    onetResult.occupations,
    validated,
    0.5 // Moderate threshold — job posting filtering in generation catches the rest
  );

  // Re-order validated companies by semantic score
  const semanticMap = new Map(semanticResult.allMatches.map(m => [m.companyName, m]));
  validated.sort((a: any, b: any) => {
    const aScore = semanticMap.get(a.name)?.similarityScore || 0;
    const bScore = semanticMap.get(b.name)?.similarityScore || 0;
    return bScore - aScore;
  });

  console.log(`   Average similarity: ${(semanticResult.averageSimilarity * 100).toFixed(0)}%`);
  console.log(`   Threshold: ${(semanticResult.threshold * 100).toFixed(0)}%`);
  phaseTimings['semantic_matching'] = Date.now() - phaseStart;
  phasesCompleted.push('semantic_matching');

  // ── Phase 6d: Multi-Factor Ranking ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'ranking' });
  console.log(`\n📊 PHASE 6d: RANKING & SELECTION`);
  const rankingResult = await rankAndSelectCompanies(validated, searchLocation, count, combinedKeywords);
  console.log(`   Selected: ${rankingResult.selected.length} | Alternates: ${rankingResult.alternates.length}`);
  phaseTimings['ranking'] = Date.now() - phaseStart;
  phasesCompleted.push('ranking');

  // ── Phase 7: Enrich + Upsert into company_profiles ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'enrichment' });
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

    // Get semantic match data for this company
    const semanticData = semanticMap.get(original.name || company.name);

    const companyData: Record<string, unknown> = {
      name: original.name || company.name,
      sector: original.industry || company.sector,
      size: (enrichData?.enrichment?.employeeCount || original.employeeCount)
        ? `${enrichData?.enrichment?.employeeCount || original.employeeCount} employees` : 'Unknown',
      description: enrichData?.enrichment?.shortDescription || original.description || company.description,
      website: original.website || company.website || null,
      full_address: (() => {
        const enrich = enrichData?.enrichment;
        if (enrich && (enrich.streetAddress || enrich.city)) {
          return [enrich.streetAddress, enrich.city, enrich.state, enrich.postalCode].filter(Boolean).join(', ');
        }
        const loc = original.location;
        if (loc) return [loc.streetAddress, loc.city, loc.state, loc.postalCode, loc.country].filter(Boolean).join(', ');
        return company.full_address || searchLocation || null;
      })(),
      city: enrichData?.enrichment?.city || original.location?.city || null,
      state: enrichData?.enrichment?.state || original.location?.state || null,
      zip: enrichData?.enrichment?.postalCode || original.location?.postalCode || null,
      country: enrichData?.enrichment?.country || original.location?.country || null,
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
        title: jp.title, location: jp.location,
        posted_date: jp.postedDate || jp.posted_date || jp.posted_at,
        description: jp.description?.substring(0, 200),
      })),
      data_completeness_score: enrichData?.completenessScore ?? calculateEnrichmentCompleteness(null, null, (original.jobPostings || []).length, (original.technologies || []).length),
      match_score: ranked.scores.composite,
      match_reason: ranked.selectionReason,
      instructor_course_id,
      generation_run_id: generationRunId,
      discovery_source: original.discoveryStrategy || 'unknown',
      seo_description: enrichData?.enrichment?.seoDescription || null,
      buying_intent_signals: enrichData?.buyingIntent || original.buyingIntentSignals || null,
      // Contact fields
      contact_first_name: enrichData?.contact?.firstName || null,
      contact_last_name: enrichData?.contact?.lastName || null,
      contact_email: enrichData?.contact?.email || null,
      contact_title: enrichData?.contact?.title || null,
      contact_phone: enrichData?.contact?.phone || null,
      contact_person: enrichData?.contact ? `${enrichData.contact.firstName} ${enrichData.contact.lastName}`.trim() : null,
      contact_headline: enrichData?.contact?.headline || null,
      contact_photo_url: enrichData?.contact?.photoUrl || null,
      contact_city: enrichData?.contact?.city || null,
      contact_state: enrichData?.contact?.state || null,
      contact_country: enrichData?.contact?.country || null,
      contact_email_status: enrichData?.contact?.emailStatus || null,
      contact_twitter_url: enrichData?.contact?.twitterUrl || null,
      contact_phone_numbers: enrichData?.contact?.phoneNumbers?.length ? enrichData.contact.phoneNumbers : null,
      contact_employment_history: enrichData?.contact?.employmentHistory?.length ? enrichData.contact.employmentHistory : null,
      // Organization metadata
      linkedin_profile: enrichData?.contact?.linkedinUrl || enrichData?.enrichment?.linkedinUrl || null,
      organization_linkedin_url: enrichData?.enrichment?.linkedinUrl || null,
      organization_twitter_url: enrichData?.enrichment?.twitterUrl || null,
      organization_facebook_url: enrichData?.enrichment?.facebookUrl || null,
      organization_logo_url: enrichData?.enrichment?.logoUrl || null,
      organization_founded_year: enrichData?.enrichment?.foundedYear || null,
      organization_industry_keywords: enrichData?.enrichment?.industryKeywords?.length ? enrichData.enrichment.industryKeywords : null,
      departmental_head_count: enrichData?.enrichment?.departmentalHeadCount || null,
      organization_revenue_range: enrichData?.enrichment?.revenueRange || null,
      funding_events: enrichData?.enrichment?.fundingEvents?.length ? enrichData.enrichment.fundingEvents : null,
      // Enrichment metadata
      last_enriched_at: enrichData ? new Date().toISOString() : null,
      data_enrichment_level: enrichData ? 'apollo_verified' : 'basic',
      matching_skills: semanticData?.matchingSkills || combinedKeywords.slice(0, 15),
      similarity_score: semanticData?.similarityScore ?? ranked.scores.semantic,
      match_confidence: ranked.scores.composite >= 0.7 ? 'high' : ranked.scores.composite >= 0.4 ? 'medium' : 'low',
    };

    const { data: savedCompany, error: insertError } = await supabase
      .from('company_profiles')
      .upsert(companyData, { onConflict: 'apollo_organization_id' })
      .select()
      .single();

    if (insertError) {
      console.warn(`   ⚠️ Failed to upsert ${companyData.name}:`, insertError.message);
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

  phaseTimings['enrichment'] = Date.now() - phaseStart;
  phasesCompleted.push('enrichment');
  await updateRun({ companies_saved: insertedCompanies.length });

  // ── Phase 8: Signal Scoring (4 parallel signals) ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'signal_scoring' });
  console.log(`\n📡 PHASE 8: SIGNAL SCORING (4 parallel signals)`);

  const companiesForSignals: CompanyForSignal[] = insertedCompanies.map((c: any) => ({
    id: c.id,
    name: c.name,
    apollo_organization_id: c.apollo_organization_id,
    industries: c.industries,
    departmental_head_count: c.departmental_head_count,
    technologies: c.technologies_used,
    technologies_used: c.technologies_used,
    job_postings: c.job_postings,
    description: c.description,
    size: c.size,
    sector: c.sector,
    funding_stage: c.funding_stage,
    total_funding_usd: c.total_funding_usd,
    contact_email: c.contact_email,
    contact_person: c.contact_person,
    contact_title: c.contact_title,
  }));

  const syllabusDomain = domainClassification.domain;
  const signalResults = await calculateBatchSignals(
    companiesForSignals, combinedKeywords, syllabusDomain, APOLLO_API_KEY
  );

  // Update each company with signal scores
  let signalSummary: Record<string, unknown> = {};
  for (const [companyId, composite] of signalResults) {
    const storable = toStorableSignalData(composite);
    const { error: signalError } = await supabase
      .from('company_profiles')
      .update({
        skill_match_score: storable.skill_match_score,
        market_signal_score: storable.market_signal_score,
        department_fit_score: storable.department_fit_score,
        contact_quality_score: storable.contact_quality_score,
        composite_signal_score: storable.composite_signal_score,
        signal_confidence: storable.signal_confidence,
        signal_data: storable.signal_data,
      })
      .eq('id', companyId);

    if (signalError) {
      console.warn(`   ⚠️ Signal update failed for ${companyId}:`, signalError.message);
    } else {
      const company = insertedCompanies.find((c: any) => c.id === companyId);
      console.log(`   📊 ${company?.name}: composite=${composite.overall}, confidence=${composite.confidence}`);
    }
  }

  // Build signal summary for the generation run
  const signalScores = [...signalResults.values()];
  signalSummary = {
    companiesScored: signalScores.length,
    avgComposite: signalScores.length > 0 ? Math.round(signalScores.reduce((s, c) => s + c.overall, 0) / signalScores.length) : 0,
    confidenceDistribution: {
      high: signalScores.filter(s => s.confidence === 'high').length,
      medium: signalScores.filter(s => s.confidence === 'medium').length,
      low: signalScores.filter(s => s.confidence === 'low').length,
    },
  };

  phaseTimings['signal_scoring'] = Date.now() - phaseStart;
  phasesCompleted.push('signal_scoring');

  // ── Phase 9: Career Page Validation (Firecrawl) — top 5 only ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'career_validation' });
  console.log(`\n🔥 PHASE 9: CAREER PAGE VALIDATION`);

  const topCompaniesForCareer = insertedCompanies
    .filter((c: any) => c.website)
    .slice(0, 5); // Limit to top 5 to conserve Firecrawl credits

  for (const company of topCompaniesForCareer) {
    try {
      const careerResult = await validateCareerPage(company.website, company.name);
      if (careerResult.success && careerResult.jobCount > 0) {
        // Update the company with career validation data
        await supabase
          .from('company_profiles')
          .update({
            signal_data: {
              ...(typeof company.signal_data === 'object' ? company.signal_data : {}),
              careerPageValidation: {
                careerPageUrl: careerResult.careerPageUrl,
                jobCount: careerResult.jobCount,
                hiringVelocity: careerResult.hiringVelocitySignal,
                hiringDepartments: careerResult.hiringDepartments,
                techStack: careerResult.techStack,
              },
            },
          })
          .eq('id', company.id);
        console.log(`   ✅ ${company.name}: ${careerResult.jobCount} jobs on career page (${careerResult.hiringVelocitySignal})`);
      }
    } catch (e) {
      console.warn(`   ⚠️ Career validation failed for ${company.name}:`, e);
    }
  }

  phaseTimings['career_validation'] = Date.now() - phaseStart;
  phasesCompleted.push('career_validation');

  // ── Phase 10: Inferred Needs Synthesis ──
  phaseStart = Date.now();
  await updateRun({ current_phase: 'inferred_needs' });
  console.log(`\n💡 PHASE 10: INFERRED NEEDS SYNTHESIS`);

  for (const company of insertedCompanies) {
    try {
      const needs = inferCompanyNeeds(
        Array.isArray(company.job_postings) ? company.job_postings : [],
        Array.isArray(company.technologies_used) ? company.technologies_used : [],
        company.description || '',
        company.funding_stage,
        company.employee_count,
        company.name,
        company.sector || company.industry
      );

      if (needs.needs.length > 0) {
        await supabase
          .from('company_profiles')
          .update({ inferred_needs: needs.needs })
          .eq('id', company.id);
        console.log(`   💡 ${company.name}: ${needs.needs.length} needs, ${needs.growthAreas.length} growth areas`);
      }
    } catch (e) {
      console.warn(`   ⚠️ Needs inference failed for ${company.name}:`, e);
    }
  }

  phaseTimings['inferred_needs'] = Date.now() - phaseStart;
  phasesCompleted.push('inferred_needs');

  // ── Finalize Generation Run ──
  const totalTime = Date.now() - pipelineStart;
  await updateRun({
    status: 'completed',
    completed_at: new Date().toISOString(),
    phases_completed: phasesCompleted,
    phase_timings: phaseTimings,
    total_processing_time_ms: totalTime,
    signal_summary: signalSummary,
  });

  console.log(`\n✅ Discovery pipeline complete in ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   Phases: ${phasesCompleted.join(' → ')}`);
  console.log(`   Companies saved: ${insertedCompanies.length}`);

  return createSuccessResponse({
    success: true,
    generation_run_id: generationRunId,
    companies_discovered: discoveryResult.companies.length,
    companies_filtered: filteredCompanies.length,
    companies_validated: validated.length,
    companies_rejected: rejected.length,
    companies_saved: insertedCompanies.length,
    companies: insertedCompanies.map((c: any) => ({
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
      version: 'v2-eduthree-parity',
      totalTimeMs: totalTime,
      phases: phaseTimings,
      socMappings: socMappings.map(s => ({ title: s.title, socCode: s.socCode, confidence: s.confidence })),
      onet: {
        occupations: onetResult.occupations.length,
        skills: onetSkills.length,
        technologies: onetTechnologies.length,
        apiCalls: onetResult.apiCalls,
      },
      skillExtraction: {
        method: skillResult.extractionMethod,
        skillCount: skillResult.skills.length,
        topSkills: skillResult.skills.slice(0, 5).map(s => s.skill),
        combinedKeywords: combinedKeywords.length,
      },
      discovery: discoveryResult.stats,
      filtering: {
        domain: domainClassification.domain,
        inputCount: discoveryResult.companies.length,
        passedCount: filteredCompanies.length,
      },
      semanticMatching: {
        averageSimilarity: semanticResult.averageSimilarity,
        threshold: semanticResult.threshold,
        processingTimeMs: semanticResult.processingTimeMs,
      },
      validation: {
        validated: validated.length,
        rejected: rejected.length,
        rejectionReasons: rejected.slice(0, 5).map(r => `${r.company.name}: ${r.reason}`),
      },
      ranking: rankingResult.selectionSummary,
      signals: signalSummary,
      location: normalizedLocation,
    },
  }, responseHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
