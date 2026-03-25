/**
 * COMPANY-COURSE VALIDATION SERVICE (v2 — Batch Processing)
 * 
 * AI-powered validation to ensure company-course fit BEFORE project generation.
 * 
 * v2 Changes:
 * - Batch validation: single AI call for ~15 companies instead of sequential
 * - Numeric confidence scores instead of binary valid/invalid
 * - No sleep delays between companies
 * - Handles token limits by splitting into batches of 15
 */

import { generateText, MODELS } from '../unified-ai-client.ts';
import { withAICircuit } from './circuit-breaker.ts';

export interface CompanyValidationInput {
  companyName: string;
  companyDescription: string;
  companySector: string;
  companyIndustries: string[];
  companyKeywords: string[];
  companyJobPostings: any[];
  companyTechnologies: string[];
  courseTitle: string;
  courseLevel: string;
  courseOutcomes: string[];
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reason: string;
  suggestedProjectType?: string;
  skillsOverlap: string[];
}

/**
 * Batch validate multiple companies for a course in a single AI call.
 * Returns only companies that pass validation.
 */
export async function filterValidCompanies(
  companies: any[],
  courseTitle: string,
  courseLevel: string,
  courseOutcomes: string[]
): Promise<{ validCompanies: any[]; rejectedCompanies: { company: any; reason: string }[] }> {
  console.log(`\n🔍 AI Company-Course Validation (${companies.length} companies)`);
  console.log(`   Course: "${courseTitle}" (${courseLevel})`);

  if (companies.length === 0) {
    return { validCompanies: [], rejectedCompanies: [] };
  }

  // Split into batches of 15 to stay within token limits
  const BATCH_SIZE = 15;
  const batches: any[][] = [];
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    batches.push(companies.slice(i, i + BATCH_SIZE));
  }

  const validCompanies: any[] = [];
  const rejectedCompanies: { company: any; reason: string }[] = [];

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`   Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} companies)...`);

    const results = await validateBatch(batch, courseTitle, courseLevel, courseOutcomes);

    for (let i = 0; i < batch.length; i++) {
      const company = batch[i];
      const result = results[i];

      if (result && result.isValid && result.confidence >= 0.6) {
        validCompanies.push({
          ...company,
          validation_confidence: result.confidence,
          validation_reason: result.reason,
          suggested_project_type: result.suggestedProjectType,
          skills_overlap: result.skillsOverlap
        });
      } else {
        rejectedCompanies.push({
          company,
          reason: result?.reason || 'Validation failed'
        });
      }
    }
  }

  console.log(`\n📊 Validation Results:`);
  console.log(`   ✅ Valid: ${validCompanies.length}`);
  console.log(`   ❌ Rejected: ${rejectedCompanies.length}`);

  if (rejectedCompanies.length > 0) {
    console.log(`   Rejection reasons:`);
    rejectedCompanies.slice(0, 5).forEach(r => {
      console.log(`     - ${r.company.name}: ${r.reason}`);
    });
  }

  return { validCompanies, rejectedCompanies };
}

/**
 * Validate a batch of companies in a single AI call.
 */
async function validateBatch(
  companies: any[],
  courseTitle: string,
  courseLevel: string,
  courseOutcomes: string[]
): Promise<ValidationResult[]> {
  // Build compact company descriptions for the batch prompt
  const companyList = companies.map((c, i) => {
    const desc = (c.description || '').substring(0, 200);
    const techs = (c.technologies_used || []).slice(0, 5).join(', ');
    const jobs = (c.job_postings || []).slice(0, 3).map((j: any) => j.title).join(', ');
    return `${i + 1}. "${c.name}" — Sector: ${c.sector || 'Unknown'} | Desc: ${desc} | Tech: ${techs || 'N/A'} | Jobs: ${jobs || 'None'}`;
  }).join('\n');

  const prompt = `You are a strict evaluator determining if companies are GENUINE matches for an academic course project.

COURSE: "${courseTitle}" (${courseLevel})
LEARNING OUTCOMES:
${courseOutcomes.slice(0, 5).map((o, i) => `  ${i + 1}. ${o}`).join('\n')}

COMPANIES TO EVALUATE:
${companyList}

For EACH company, determine if it's a genuine match based on:
1. Does the company operate in a field where the course's skills are genuinely useful?
2. Would students realistically apply course concepts at this company?

REJECT mismatches like: Engineering course + HR software company, Data Science + bakery with no data needs.
ACCEPT genuine fits like: Fluid Mechanics + water treatment, Marketing + B2B SaaS startup.

Respond with ONLY a valid JSON array (no markdown). Each element:
{"company": "Name", "isValid": true/false, "confidence": 0.0-1.0, "reason": "One sentence", "suggestedProjectType": "If valid", "skillsOverlap": ["skill1", "skill2"]}`;

  try {
    const circuitResult = await withAICircuit(async () => {
      const result = await generateText({
        prompt,
        systemPrompt: 'You are a strict evaluator for academic-industry project matching. Return only valid JSON array.',
        model: MODELS.FAST, temperature: 0.3,
      });
      return result;
    });

    if (!circuitResult.success) {
      console.warn(`  ⚠️ AI circuit breaker open: ${circuitResult.error}`);
      return companies.map(() => ({
        isValid: true,
        confidence: 0.5,
        reason: 'AI validation unavailable - defaulting to accept',
        skillsOverlap: []
      }));
    }

    const content = circuitResult.data?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('  ⚠️ Could not parse batch validation response');
      return companies.map(() => ({
        isValid: true,
        confidence: 0.5,
        reason: 'Could not parse AI response - defaulting to accept',
        skillsOverlap: []
      }));
    }

    const results: ValidationResult[] = JSON.parse(jsonMatch[0]);

    // Log results
    results.forEach(r => {
      const status = r.isValid ? '✅' : '❌';
      console.log(`  ${status} ${(r as any).company || '?'}: ${r.reason} (${Math.round(r.confidence * 100)}%)`);
    });

    // Ensure we have results for all companies (pad if AI returned fewer)
    while (results.length < companies.length) {
      results.push({
        isValid: true,
        confidence: 0.5,
        reason: 'Not evaluated - defaulting to accept',
        skillsOverlap: []
      });
    }

    return results;
  } catch (error) {
    console.error(`  ❌ Batch validation error:`, error);
    return companies.map(() => ({
      isValid: true,
      confidence: 0.5,
      reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown'}`,
      skillsOverlap: []
    }));
  }
}

/**
 * Validate a single company (kept for backward compatibility).
 */
export async function validateCompanyCourseMatch(
  input: CompanyValidationInput
): Promise<ValidationResult> {
  const results = await filterValidCompanies(
    [{
      name: input.companyName,
      description: input.companyDescription,
      sector: input.companySector,
      industries: input.companyIndustries,
      keywords: input.companyKeywords,
      job_postings: input.companyJobPostings,
      technologies_used: input.companyTechnologies,
    }],
    input.courseTitle,
    input.courseLevel,
    input.courseOutcomes
  );

  if (results.validCompanies.length > 0) {
    const v = results.validCompanies[0];
    return {
      isValid: true,
      confidence: v.validation_confidence,
      reason: v.validation_reason,
      suggestedProjectType: v.suggested_project_type,
      skillsOverlap: v.skills_overlap || [],
    };
  }

  return {
    isValid: false,
    confidence: 0.3,
    reason: results.rejectedCompanies[0]?.reason || 'Rejected',
    skillsOverlap: [],
  };
}
