/**
 * Company Discovery Pipeline Orchestrator
 * Ported from projectify-syllabus/company-discovery-pipeline.ts
 *
 * Coordinates the 5-phase pipeline:
 * 1. Skill Extraction (Lightcast)
 * 2. Occupation Mapping (O*NET)
 * 3. Company Discovery (Apollo)
 * 4. Semantic Validation (Lightcast skill ID matching)
 * 5. Ranking & Selection
 *
 * This is the new pipeline entry point, gated behind USE_NEW_PIPELINE env var.
 * When USE_NEW_PIPELINE !== 'true', callers should use discovery-pipeline-legacy.ts.
 */

import type {
  PipelineInput,
  PipelineOutput,
  SkillExtractionOutput,
  CompanyDiscoveryOutput,
  DiscoveredCompany,
} from './pipeline-types.ts';

import type { OnetMappingResult } from './onet-service.ts';

import { extractSkills, isLightcastConfigured } from '../lightcast-client.ts';
import { mapSkillsToOnet } from './onet-service.ts';
import { discoverCompanies } from './apollo-precise-discovery.ts';
import { validateCompaniesSemanticly } from './semantic-validation-v2-service.ts';
import { rankAndSelectCompanies } from './company-ranking-service.ts';
import { fetchWithTimeout, API_TIMEOUT_MS } from './timeout-config.ts';

// ============================================================================
// FEATURE FLAG
// ============================================================================

/** Check whether the new pipeline is enabled via environment variable */
const useNewPipeline = Deno.env.get('USE_NEW_PIPELINE') === 'true';

export { useNewPipeline };

// ============================================================================
// TYPES (pipeline-internal, extending shared types)
// ============================================================================

interface SemanticValidationOutput {
  validatedCompanies: any[];
  stats: {
    inputCount: number;
    passedValidation: number;
    highConfidence: number;
    mediumConfidence: number;
    failedValidation: number;
    avgSemanticScore: number;
    processingTimeMs: number;
  };
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * MAIN EXPORT: Run the complete 5-phase pipeline
 *
 * Phases:
 * 1. Skill Extraction   - Extract skills from course via Lightcast
 * 2. Occupation Mapping  - Map skills to O*NET occupations
 * 3. Company Discovery   - Find companies via Apollo multi-strategy
 * 4. Semantic Validation - Validate companies via Lightcast skill ID matching
 * 5. Ranking & Selection - Score, rank, and select top companies
 */
export async function runCompanyDiscoveryPipeline(
  input: PipelineInput
): Promise<PipelineOutput> {
  const startTime = Date.now();

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     COMPANY DISCOVERY PIPELINE - 5 PHASE EXECUTION         ║`);
  console.log(`║     (NEW PIPELINE v2 - Lightcast + O*NET)                  ║`);
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

  const emptyValidationOutput: SemanticValidationOutput = {
    validatedCompanies: [],
    stats: {
      inputCount: 0,
      passedValidation: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      failedValidation: 0,
      avgSemanticScore: 0,
      processingTimeMs: 0,
    },
  };

  try {
    // ========================================
    // PHASE 1: SKILL EXTRACTION (Lightcast)
    // ========================================
    const phase1Start = Date.now();
    console.log(`\n🔬 PHASE 1: SKILL EXTRACTION (Lightcast)`);

    if (!isLightcastConfigured()) {
      console.warn(`  ⚠️ Lightcast not configured — using pattern-based extraction`);
    }

    // Build text from course metadata for skill extraction
    const courseText = [
      input.courseTitle,
      ...(input.learningObjectives || []),
    ].join('\n');

    const lightcastSkills = await extractSkills(courseText);
    const phase1Time = Date.now() - phase1Start;

    // Convert Lightcast skills into pipeline IndustrySkill format
    const skillOutput: SkillExtractionOutput = {
      skills: lightcastSkills.map((s) => ({
        skill: s.name,
        category: 'technical' as const,
        confidence: s.confidence ?? 0.8,
        source: 'lightcast',
        keywords: [s.name.toLowerCase()],
      })),
      extractionMethod: isLightcastConfigured() ? 'ai-translation' : 'pattern-fallback',
      processingTimeMs: phase1Time,
    };

    console.log(`   ✅ ${skillOutput.skills.length} skills extracted via ${skillOutput.extractionMethod} (${phase1Time}ms)`);

    if (skillOutput.skills.length === 0) {
      throw new Error('No skills extracted from course. Check learning objectives.');
    }

    // ========================================
    // PHASE 2: OCCUPATION MAPPING (O*NET)
    // ========================================
    const phase2Start = Date.now();
    console.log(`\n📋 PHASE 2: OCCUPATION MAPPING (O*NET)`);

    const skillKeywords = skillOutput.skills.map((s) => s.skill);
    const onetResult: OnetMappingResult = await mapSkillsToOnet(skillKeywords);

    const phase2Time = Date.now() - phase2Start;
    console.log(`   ✅ ${onetResult.occupations.length} occupations mapped (${phase2Time}ms)`);

    if (onetResult.occupations.length === 0) {
      console.warn(`  ⚠️ No occupations mapped from skills — continuing with skill keywords only`);
    }

    // Derive industry keywords and job titles from O*NET occupations
    const industryKeywords = onetResult.occupations
      .flatMap((occ) => occ.title ? [occ.title] : [])
      .slice(0, 10);
    const jobTitles = onetResult.occupations
      .map((occ) => occ.title)
      .filter(Boolean)
      .slice(0, 10);

    // ========================================
    // PHASE 3: COMPANY DISCOVERY (Apollo)
    // ========================================
    const phase3Start = Date.now();
    console.log(`\n🔍 PHASE 3: COMPANY DISCOVERY (Apollo)`);

    if (!Deno.env.get('APOLLO_API_KEY')) {
      throw new Error(
        'Pipeline requires Apollo API. Set APOLLO_API_KEY environment variable.'
      );
    }

    // Request 3x target count to allow for filtering/validation losses
    const discoveryOutput = await discoverCompanies({
      industries: industryKeywords,
      jobTitles,
      skillKeywords: skillKeywords.slice(0, 10),
      location: input.location,
      targetCount: input.targetCount * 3,
    });

    const phase3Time = Date.now() - phase3Start;
    console.log(`   ✅ ${discoveryOutput.companies.length} companies discovered (${phase3Time}ms)`);

    if (discoveryOutput.companies.length === 0) {
      console.warn(`  ⚠️ No companies discovered in Phase 3`);
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
    // PHASE 4: SEMANTIC VALIDATION (Lightcast)
    // ========================================
    const phase4Start = Date.now();
    console.log(`\n🏭 PHASE 4: SEMANTIC VALIDATION (Lightcast Skill IDs)`);

    let validationOutput: SemanticValidationOutput;

    if (discoveryOutput.companies.length > 0) {
      // Convert lightcast skills to the format expected by validation service
      const courseSkillIds = lightcastSkills.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type ?? 'Hard Skill',
        category: s.category ?? 'Unknown',
        confidence: s.confidence ?? 0.8,
        relatedSkillIds: [] as string[],
      }));

      const courseDWAs = onetResult.occupations.flatMap((occ) =>
        (occ.dwas || []).map((d: any) => ({
          id: d.id || d.name,
          name: d.name,
          importance: d.importance ?? 0.5,
        }))
      );

      validationOutput = await validateCompaniesSemanticly({
        companies: discoveryOutput.companies,
        courseSkillIds,
        courseDWAs,
      });
    } else {
      validationOutput = emptyValidationOutput;
    }

    const phase4Time = Date.now() - phase4Start;
    console.log(`   ✅ ${validationOutput.validatedCompanies.length} companies validated (${phase4Time}ms)`);

    // ========================================
    // PHASE 5: RANKING & SELECTION
    // ========================================
    const phase5Start = Date.now();
    console.log(`\n📊 PHASE 5: RANKING & SELECTION`);

    const rankingResult = await rankAndSelectCompanies(
      validationOutput.validatedCompanies,
      input.location,
      input.targetCount,
      skillKeywords
    );

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
    console.log(`║ Phase 2 (O*NET):       ${String(onetResult.occupations.length).padStart(3)} occupations mapped`.padEnd(54) + `║`);
    console.log(`║ Phase 3 (Discovery):   ${String(discoveryOutput.companies.length).padStart(3)} companies found`.padEnd(54) + `║`);
    console.log(`║ Phase 4 (Validation):  ${String(validationOutput.validatedCompanies.length).padStart(3)} companies validated`.padEnd(54) + `║`);
    console.log(`║ Phase 5 (Ranking):     ${String(rankingResult.selected.length).padStart(3)} companies selected`.padEnd(54) + `║`);
    console.log(`╠════════════════════════════════════════════════════════════╣`);
    console.log(`║ Total Time: ${(totalProcessingTimeMs / 1000).toFixed(2)}s`.padEnd(58) + `║`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);

    // Extract final companies from ranking result
    const selectedCompanies: DiscoveredCompany[] = rankingResult.selected.map((r: any) => {
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
        ? `No companies selected. Discovery found ${discoveryOutput.companies.length}, validation passed ${validationOutput.stats.passedValidation}`
        : undefined,
    };

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

  if (!Deno.env.get('LIGHTCAST_API_KEY')) missing.push('LIGHTCAST_API_KEY');
  if (!Deno.env.get('APOLLO_API_KEY')) missing.push('APOLLO_API_KEY');

  return {
    configured: missing.length === 0,
    missing,
  };
}

/**
 * Get pipeline health status
 */
export function getPipelineHealth(): {
  lightcast: boolean;
  apollo: boolean;
  onet: boolean;
  overall: 'healthy' | 'degraded' | 'unavailable';
} {
  const lightcast = isLightcastConfigured();
  const apollo = !!Deno.env.get('APOLLO_API_KEY');
  const onet = !!Deno.env.get('ONET_USERNAME') && !!Deno.env.get('ONET_PASSWORD');

  let overall: 'healthy' | 'degraded' | 'unavailable';

  if (lightcast && apollo && onet) {
    overall = 'healthy';
  } else if (apollo) {
    overall = 'degraded'; // Can still work with Apollo
  } else {
    overall = 'unavailable';
  }

  return {
    lightcast,
    apollo,
    onet,
    overall,
  };
}
