/**
 * Company Discovery Pipeline Orchestrator
 * Ported from EduThree1's company-discovery-pipeline.ts (326 lines)
 *
 * Coordinates the 5-phase pipeline:
 * 1. Skill Extraction (AI-powered via Gemini)
 * 2. SOC Code Mapping (curated discipline map)
 * 3. Company Discovery (Apollo multi-strategy)
 * 4. Validation & Filtering (AI + context-aware)
 * 5. Ranking & Selection (multi-factor scoring)
 *
 * This orchestrator provides:
 * - Structured logging with phase timing
 * - Error isolation (phase failure doesn't crash pipeline)
 * - Full phase data output for debugging
 */

import type {
  PipelineInput,
  PipelineOutput,
  SkillExtractionOutput,
  CompanyDiscoveryOutput,
  DiscoveredCompany,
  IndustrySkill,
} from './pipeline-types.ts';

import { extractIndustrySkills } from './skill-extraction.ts';
import { mapCourseToSOC, getIndustryKeywordsFromSOC, getJobTitlesFromSOC } from './course-soc-mapping.ts';
import { normalizeLocationForApollo } from './location-utils.ts';
import { discoverCompanies } from './apollo-precise-discovery.ts';
import { classifyCourseDomain, shouldExcludeIndustry } from './context-aware-industry-filter.ts';
import { filterValidCompanies } from './company-validation-service.ts';
import { rankAndSelectCompanies } from './company-ranking-service.ts';

/**
 * MAIN EXPORT: Run the complete 5-phase pipeline
 */
export async function runCompanyDiscoveryPipeline(
  input: PipelineInput
): Promise<PipelineOutput> {
  const startTime = Date.now();

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     COMPANY DISCOVERY PIPELINE - 5 PHASE EXECUTION         ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);
  console.log(`║ Course: ${input.courseTitle.substring(0, 48).padEnd(48)} ║`);
  console.log(`║ Location: ${input.location.substring(0, 46).padEnd(46)} ║`);
  console.log(`║ Target: ${input.targetCount} companies`.padEnd(59) + `║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const emptySkillOutput: SkillExtractionOutput = {
    skills: [],
    extractionMethod: 'pattern-fallback',
    processingTimeMs: 0,
  };

  const emptyDiscoveryOutput: CompanyDiscoveryOutput = {
    companies: [],
    stats: {
      totalDiscovered: 0,
      byStrategy: { technology_filter: 0, job_title_search: 0, industry_search: 0 },
      processingTimeMs: 0,
    },
  };

  try {
    // ========================================
    // PHASE 1: SKILL EXTRACTION
    // ========================================
    const phase1Start = Date.now();
    console.log(`\n🔬 PHASE 1: SKILL EXTRACTION`);

    const skillOutput = await extractIndustrySkills(
      input.learningObjectives,
      input.courseTitle,
      input.courseLevel
    );

    const phase1Time = Date.now() - phase1Start;
    console.log(`   ✅ ${skillOutput.skills.length} skills extracted via ${skillOutput.extractionMethod} (${phase1Time}ms)`);

    if (skillOutput.skills.length === 0) {
      throw new Error('No skills extracted from course. Check learning objectives.');
    }

    // ========================================
    // PHASE 2: SOC CODE MAPPING
    // ========================================
    const phase2Start = Date.now();
    console.log(`\n📋 PHASE 2: SOC CODE MAPPING`);

    const socMappings = mapCourseToSOC(
      input.courseTitle,
      input.learningObjectives,
      input.courseLevel
    );

    const industryKeywords = getIndustryKeywordsFromSOC(socMappings);
    const jobTitles = getJobTitlesFromSOC(socMappings);
    const normalizedLocation = normalizeLocationForApollo(input.location);

    const phase2Time = Date.now() - phase2Start;
    console.log(`   ✅ ${socMappings.length} SOC codes, ${industryKeywords.length} industries, ${jobTitles.length} job titles (${phase2Time}ms)`);

    // ========================================
    // PHASE 3: COMPANY DISCOVERY (Apollo)
    // ========================================
    const phase3Start = Date.now();
    console.log(`\n🔍 PHASE 3: COMPANY DISCOVERY (Apollo)`);

    const skillKeywords = skillOutput.skills.map(s => s.skill);

    // Request 3x target count to allow for filtering/validation losses
    const discoveryOutput = await discoverCompanies({
      industries: industryKeywords,
      jobTitles,
      skillKeywords: skillKeywords.slice(0, 10),
      location: normalizedLocation,
      targetCount: input.targetCount * 3,
    });

    const phase3Time = Date.now() - phase3Start;
    console.log(`   ✅ ${discoveryOutput.companies.length} companies discovered (${phase3Time}ms)`);

    if (discoveryOutput.companies.length === 0) {
      console.warn(`   ⚠️ No companies discovered in Phase 3`);
      return {
        success: false,
        companies: [],
        companiesSaved: 0,
        phases: {
          skillExtraction: skillOutput,
          discovery: discoveryOutput,
        },
        totalProcessingTimeMs: Date.now() - startTime,
        error: `No companies found matching "${input.courseTitle}" criteria in ${input.location}`,
      };
    }

    // ========================================
    // PHASE 4: VALIDATION & FILTERING
    // ========================================
    const phase4Start = Date.now();
    console.log(`\n🏭 PHASE 4: VALIDATION & FILTERING`);

    // 4a: Context-aware industry filtering
    const domainClassification = classifyCourseDomain(socMappings);
    console.log(`   Domain: ${domainClassification.domain} (${(domainClassification.confidence * 100).toFixed(0)}%)`);

    const filteredCompanies = discoveryOutput.companies.filter(company => {
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

    console.log(`   Industry filter: ${filteredCompanies.length}/${discoveryOutput.companies.length} passed`);

    // 4b: AI company-course validation
    const companiesForValidation = filteredCompanies.map(c => ({
      name: c.name,
      description: c.description,
      sector: c.industry,
      industries: c.industryTags,
      keywords: skillKeywords.slice(0, 10),
      job_postings: c.jobPostings.map(jp => ({ title: jp.title })),
      technologies_used: c.technologies,
      website: c.website,
      _original: c,
    }));

    const { validCompanies: validated, rejectedCompanies: rejected } = await filterValidCompanies(
      companiesForValidation,
      input.courseTitle,
      input.courseLevel || 'undergraduate',
      input.learningObjectives
    );

    const phase4Time = Date.now() - phase4Start;
    console.log(`   AI validation: ${validated.length} valid, ${rejected.length} rejected (${phase4Time}ms)`);

    // ========================================
    // PHASE 5: RANKING & SELECTION
    // ========================================
    const phase5Start = Date.now();
    console.log(`\n📊 PHASE 5: RANKING & SELECTION`);

    const rankingResult = rankAndSelectCompanies(validated, input.location, input.targetCount);

    const phase5Time = Date.now() - phase5Start;
    console.log(`   ✅ ${rankingResult.selected.length} selected, ${rankingResult.alternates.length} alternates (${phase5Time}ms)`);

    // ========================================
    // PIPELINE COMPLETE
    // ========================================
    const totalProcessingTimeMs = Date.now() - startTime;

    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║              PIPELINE EXECUTION COMPLETE                   ║`);
    console.log(`╠════════════════════════════════════════════════════════════╣`);
    console.log(`║ Phase 1 (Skills):      ${String(skillOutput.skills.length).padStart(3)} skills extracted`.padEnd(54) + `║`);
    console.log(`║ Phase 2 (SOC):         ${String(socMappings.length).padStart(3)} SOC codes mapped`.padEnd(54) + `║`);
    console.log(`║ Phase 3 (Discovery):   ${String(discoveryOutput.companies.length).padStart(3)} companies found`.padEnd(54) + `║`);
    console.log(`║ Phase 4 (Validation):  ${String(validated.length).padStart(3)} companies validated`.padEnd(54) + `║`);
    console.log(`║ Phase 5 (Ranking):     ${String(rankingResult.selected.length).padStart(3)} companies selected`.padEnd(54) + `║`);
    console.log(`╠════════════════════════════════════════════════════════════╣`);
    console.log(`║ Total Time: ${(totalProcessingTimeMs / 1000).toFixed(2)}s`.padEnd(58) + `║`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);

    // Extract final companies from ranking result
    const selectedCompanies: DiscoveredCompany[] = rankingResult.selected.map(r => {
      const company = r.company;
      return company._original || company;
    });

    return {
      success: rankingResult.selected.length > 0,
      companies: selectedCompanies,
      companiesSaved: 0, // Caller handles DB upsert
      phases: {
        skillExtraction: skillOutput,
        discovery: discoveryOutput,
      },
      totalProcessingTimeMs,
      error: rankingResult.selected.length === 0
        ? `No companies selected. Discovery found ${discoveryOutput.companies.length}, validation passed ${validated.length}`
        : undefined,
      // Extended data for caller
      _rankingResult: rankingResult,
      _validated: validated,
      _rejected: rejected,
      _socMappings: socMappings,
      _domainClassification: domainClassification,
      _skillKeywords: skillKeywords,
      _normalizedLocation: normalizedLocation,
    } as PipelineOutput & Record<string, any>;

  } catch (error) {
    const totalProcessingTimeMs = Date.now() - startTime;
    console.error(`\n❌ PIPELINE ERROR: ${error}`);

    return {
      success: false,
      companies: [],
      companiesSaved: 0,
      phases: {
        skillExtraction: emptySkillOutput,
        discovery: emptyDiscoveryOutput,
      },
      totalProcessingTimeMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if pipeline is fully configured
 */
export function isPipelineConfigured(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!Deno.env.get('APOLLO_API_KEY')) missing.push('APOLLO_API_KEY');
  // Lovable AI is always available via unified-ai-client

  return {
    configured: missing.length === 0,
    missing,
  };
}

/**
 * Get pipeline health status
 */
export function getPipelineHealth(): {
  apollo: boolean;
  ai: boolean;
  overall: 'healthy' | 'degraded' | 'unavailable';
} {
  const apollo = !!Deno.env.get('APOLLO_API_KEY');
  const ai = !!Deno.env.get('LOVABLE_API_KEY');

  let overall: 'healthy' | 'degraded' | 'unavailable';
  if (apollo && ai) {
    overall = 'healthy';
  } else if (apollo) {
    overall = 'degraded'; // Can work without AI (pattern fallback)
  } else {
    overall = 'unavailable';
  }

  return { apollo, ai, overall };
}
