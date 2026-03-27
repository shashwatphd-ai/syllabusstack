/**
 * Generate Capstone Projects Edge Function (Enhanced)
 * Ported from EduThree1's generate-projects (1,122 lines)
 * 
 * Full pipeline:
 * 1. Fetch course data + learning objectives
 * 2. Fetch discovered companies from DB
 * 3. AI company-course validation (reject poor fits)
 * 4. AI project proposal generation with domain-specific prompts
 * 5. LO alignment scoring (AI)
 * 6. Market alignment scoring (synonym expansion)
 * 7. Pricing & ROI calculation
 * 8. Store projects + 6-form structured data + milestones
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { generateProjectProposal } from "../_shared/capstone/generation-service.ts";
import { calculateLOAlignment, calculateMarketAlignmentScore, generateLOAlignmentDetail } from "../_shared/capstone/alignment-service.ts";
import { validateCompanyCourseMatch } from "../_shared/capstone/company-validation-service.ts";
import { calculateApolloEnrichedPricing, calculateApolloEnrichedROI } from "../_shared/capstone/pricing-service.ts";
import { withRetry } from "../_shared/capstone/retry-utils.ts";
import type { CompanyInfo } from "../_shared/capstone/types.ts";

// ============================================================================
// INTELLIGENT SIGNAL FILTERING (EduThree parity)
// Filters job postings, technologies, and buying intent signals to only
// course-relevant data BEFORE the AI sees them. Prevents irrelevant job
// titles (e.g. "Bartender" for a Strategic Management course) from polluting
// the generation prompt.
// ============================================================================

function filterRelevantSignals(
  company: CompanyInfo,
  searchLocation: string,
  courseTitle: string,
  courseOutcomes: string[]
): CompanyInfo {
  console.log(`\n🔍 Filtering signals for ${company.name}...`);

  // Step 1: Parse location
  const zipMatch = (searchLocation || '').match(/\b\d{5}\b/);
  const zipCode = zipMatch ? zipMatch[0] : null;
  const cityName = (searchLocation || '').split(',')[0].trim().toLowerCase();
  const stateMatch = (searchLocation || '').match(/,\s*([A-Z]{2})/);
  const stateName = stateMatch ? stateMatch[1].toLowerCase() : null;

  // Step 2: Extract keywords from course title + outcomes
  const keywords = new Set<string>();

  // From course title
  courseTitle.toLowerCase().split(/[\s,]+/).forEach(word => {
    if (word.length > 3) keywords.add(word);
  });

  // From learning outcomes — technical terms + key nouns
  courseOutcomes.forEach(outcome => {
    const technicalTerms = outcome.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    technicalTerms.forEach(term => {
      term.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length > 3) keywords.add(word);
      });
    });
    outcome.toLowerCase().split(/[\s,]+/).forEach(word => {
      if (word.length > 4 && !['about', 'using', 'their', 'these', 'which', 'where', 'other', 'should', 'would', 'could'].includes(word)) {
        keywords.add(word);
      }
    });
  });

  // Step 3: Synonym map for intelligent matching (STEM + business)
  const synonymMap: Record<string, string[]> = {
    // STEM
    'ai': ['artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural'],
    'ml': ['machine learning', 'artificial intelligence', 'ai', 'predictive'],
    'cloud': ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'serverless'],
    'data': ['analytics', 'database', 'sql', 'nosql', 'etl', 'pipeline'],
    'software': ['development', 'engineering', 'programming', 'coding'],
    'fluid': ['hydraulic', 'flow', 'pressure', 'liquid', 'gas'],
    'mechanical': ['mechanics', 'engineering', 'design', 'cad'],
    'chemical': ['chemistry', 'process', 'reaction', 'synthesis'],
    'simulation': ['modeling', 'cfd', 'fem', 'analysis'],
    'optimization': ['improve', 'enhance', 'efficiency', 'performance'],
    // Business / Management
    'strategy': ['strategic', 'planning', 'roadmap', 'competitive', 'vision', 'director'],
    'management': ['manager', 'director', 'operations', 'executive', 'leadership', 'admin'],
    'marketing': ['brand', 'digital', 'campaign', 'content', 'seo', 'advertising'],
    'finance': ['financial', 'analyst', 'investment', 'accounting', 'budget', 'controller'],
    'accounting': ['audit', 'tax', 'bookkeeping', 'financial', 'cpa'],
    'supply': ['logistics', 'procurement', 'warehouse', 'inventory', 'distribution'],
    'economics': ['economic', 'market', 'pricing', 'demand', 'forecast'],
    'entrepreneurship': ['startup', 'venture', 'founder', 'innovation', 'business development'],
    'analytics': ['analysis', 'insight', 'reporting', 'dashboard', 'metrics', 'kpi'],
    'consulting': ['consultant', 'advisory', 'strategy', 'transformation'],
  };

  // Expand keywords with synonyms
  const expandedKeywords = new Set(keywords);
  keywords.forEach(keyword => {
    if (synonymMap[keyword]) {
      synonymMap[keyword].forEach(syn => expandedKeywords.add(syn));
    }
  });

  console.log(`  🔑 Keywords (${expandedKeywords.size}): ${Array.from(expandedKeywords).slice(0, 12).join(', ')}...`);

  // Step 4: Filter job postings by location AND topic relevance
  const originalJobCount = (company as any).job_postings?.length || 0;
  const filteredJobs = ((company as any).job_postings || []).filter((job: any) => {
    // Location filter (pass if no location data available)
    if (searchLocation) {
      const jobLocation = (job.location || '').toLowerCase();
      const locationMatch =
        (zipCode && jobLocation.includes(zipCode)) ||
        (cityName && cityName.length > 2 && jobLocation.includes(cityName)) ||
        (stateName && jobLocation.includes(stateName)) ||
        jobLocation.includes('remote') ||
        jobLocation.includes('hybrid') ||
        !jobLocation; // Keep jobs with no location data
      if (!locationMatch) return false;
    }

    // Topic relevance filter — at least 1 keyword match
    const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    const matchCount = Array.from(expandedKeywords).filter(keyword =>
      jobText.includes(keyword)
    ).length;

    if (matchCount > 0) {
      console.log(`    ✓ Job: "${job.title}" — ${matchCount} keyword matches`);
    }
    return matchCount > 0;
  });

  console.log(`  📊 Jobs: ${originalJobCount} total → ${filteredJobs.length} relevant (${Math.round(filteredJobs.length / Math.max(originalJobCount, 1) * 100)}%)`);

  // Step 5: Filter technologies by course relevance
  const originalTechCount = (company.technologies_used || []).length;
  const filteredTech = (company.technologies_used || []).filter((tech: any) => {
    const techName = typeof tech === 'string' ? tech : (tech?.name || tech?.technology || '');
    const techLower = techName.toLowerCase();
    return Array.from(expandedKeywords).some(keyword =>
      techLower.includes(keyword) || keyword.includes(techLower)
    );
  });

  console.log(`  💻 Tech: ${originalTechCount} total → ${filteredTech.length} relevant`);

  // Step 6: Filter buying intent signals
  const filteredIntent = ((company as any).buying_intent_signals || []).filter((signal: any) => {
    const signalText = JSON.stringify(signal).toLowerCase();
    return Array.from(expandedKeywords).some(keyword => signalText.includes(keyword));
  });

  return {
    ...company,
    job_postings: filteredJobs,
    technologies_used: filteredTech,
    buying_intent_signals: filteredIntent,
  } as CompanyInfo;
}

// ============================================================================
// POST-GENERATION VALIDATION
// Cleans AI output (strips markdown artifacts, week references, bullets) and
// validates proposal data quality. Issues are logged as warnings — they do
// not reject the proposal.
// ============================================================================

function cleanAndValidate(proposal: any): { cleaned: any; issues: string[] } {
  const issues: string[] = [];

  // Strip markdown formatting and leading bullets/numbers from tasks
  proposal.tasks = (proposal.tasks || []).map((t: string) =>
    t.replace(/\*\*/g, '')
     .replace(/\*/g, '')
     .replace(/`/g, '')
     .replace(/^- /, '')
     .replace(/^\d+[\.\)]\s*/, '')
     .trim()
  );

  // Strip markdown, week references, and leading bullets/numbers from deliverables
  proposal.deliverables = (proposal.deliverables || []).map((d: string) =>
    d.replace(/\(Week \d+[-\d]*\)/gi, '')
     .replace(/Week \d+[-\d]*:/gi, '')
     .replace(/\*\*/g, '')
     .replace(/\*/g, '')
     .replace(/`/g, '')
     .replace(/^\d+[\.\)]\s*/, '')
     .trim()
  );

  // Trim all top-level string fields
  if (typeof proposal.title === 'string') proposal.title = proposal.title.trim();
  if (typeof proposal.description === 'string') proposal.description = proposal.description.trim();

  // Check for placeholder or too-short descriptions
  const descLower = (proposal.description || '').toLowerCase();
  if (descLower.includes('ai-generated') ||
      descLower.includes('tbd') ||
      (proposal.description || '').split(/\s+/).length < 50) {
    issues.push('Description contains placeholder text or is too short (<50 words)');
  }

  // Check if all skills are generic
  const genericSkills = ['research', 'analysis', 'presentation', 'communication', 'teamwork', 'writing'];
  const skills = proposal.skills || [];
  if (skills.length > 0) {
    const hasOnlyGeneric = skills.every((s: string) =>
      genericSkills.some(g => s.toLowerCase().includes(g))
    );
    if (hasOnlyGeneric) {
      issues.push('Skills are too generic - need domain-specific skills');
    }
  }

  // Flag tasks that are too long (>20 words)
  const longTasks = (proposal.tasks || []).filter((t: string) => t.split(/\s+/).length > 20);
  if (longTasks.length > 0) {
    issues.push(`${longTasks.length} task(s) exceed 20 words`);
  }

  return { cleaned: proposal, issues };
}

function validateProjectData(proposal: any, company: any): string[] {
  const errors: string[] = [];

  // Description length check
  if (!proposal.description || proposal.description.length < 100) {
    errors.push('Project description missing or too short (<100 chars)');
  }

  // Contact completeness
  if (!proposal.contact?.name || !proposal.contact?.email || !proposal.contact?.phone) {
    errors.push('Contact information incomplete (need name, email, phone)');
  }

  // Skills minimum
  if (!proposal.skills || proposal.skills.length < 3) {
    errors.push('Insufficient skills listed (need >=3)');
  }

  // Majors minimum
  if (!proposal.majors || proposal.majors.length < 1) {
    errors.push('Preferred majors not specified');
  }

  // Email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (proposal.contact?.email && !emailRegex.test(proposal.contact.email)) {
    errors.push('Invalid email format');
  }

  // Phone length check
  if (!proposal.contact?.phone || proposal.contact.phone.length < 10) {
    errors.push('Phone number missing or too short');
  }

  // Placeholder language in description
  const descLower = (proposal.description || '').toLowerCase();
  if (descLower.includes('placeholder') ||
      descLower.includes('example') ||
      descLower.includes('sample')) {
    errors.push('Description contains placeholder language');
  }

  // Task count check
  if ((proposal.tasks || []).length < 4) {
    errors.push('Too few tasks specified (need >=4)');
  }

  // Deliverable count check
  if ((proposal.deliverables || []).length < 3) {
    errors.push('Too few deliverables specified (need >=3)');
  }

  return errors;
}

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

  const { instructor_course_id, company_ids, max_projects = 10 } = await req.json();
  if (!instructor_course_id) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'instructor_course_id is required');
  }

  // Verify instructor ownership
  const { data: isInstructor } = await supabase.rpc('is_course_instructor', {
    _user_id: user.id,
    _course_id: instructor_course_id,
  });
  if (!isInstructor) return createErrorResponse('FORBIDDEN', corsHeaders);

  console.log(`🚀 Generating capstone projects for course: ${instructor_course_id}`);

  // ── Create generation run for progress tracking ──
  const { data: genRun } = await supabase
    .from('capstone_generation_runs')
    .insert({
      instructor_course_id,
      started_by: user.id,
      status: 'running',
      current_phase: 'project_generation',
      phases_completed: [],
    })
    .select('id')
    .single();
  const runId = genRun?.id;

  const updateRun = async (updates: Record<string, any>) => {
    if (!runId) return;
    await supabase.from('capstone_generation_runs').update(updates).eq('id', runId);
  };

  // ── Fetch course data ──
  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, academic_level, expected_artifacts, search_location')
    .eq('id', instructor_course_id)
    .single();
  if (courseError || !course) return createErrorResponse('NOT_FOUND', corsHeaders, 'Course not found');

  // Fetch learning objectives with rich metadata
  const { data: los } = await supabase
    .from('learning_objectives')
    .select('id, text, bloom_level, search_keywords, core_concept')
    .eq('instructor_course_id', instructor_course_id);
  const objectives = (los || []).map((lo: any) => lo.text).filter(Boolean);
  const bloomLevels = (los || []).map((lo: any) => lo.bloom_level).filter(Boolean);

  if (objectives.length === 0) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Course has no learning objectives');
  }

  // ── Determine project tier from Bloom levels ──
  const bloomTier = determineBloomTier(bloomLevels);
  console.log(`   Bloom-level tier: ${bloomTier} (from ${bloomLevels.length} LOs)`);

  // ── Fetch companies — direct linkage via instructor_course_id ──
  let companiesQuery = supabase.from('company_profiles').select('*');
  if (company_ids?.length) {
    // Explicit company selection overrides
    companiesQuery = companiesQuery.in('id', company_ids);
  } else {
    // Primary: fetch companies linked to this course via instructor_course_id
    companiesQuery = companiesQuery
      .eq('instructor_course_id', instructor_course_id)
      .order('composite_signal_score', { ascending: false, nullsFirst: false });
  }

  const { data: allCompanies, error: compError } = await companiesQuery;
  if (compError || !allCompanies?.length) {
    await updateRun({ status: 'failed', error_details: { message: 'No companies found' }, completed_at: new Date().toISOString() });
    return createErrorResponse('BAD_REQUEST', corsHeaders,
      'No companies found for this course. Run company discovery first.');
  }

  // Cap to top N companies to avoid timeout
  const companies = allCompanies.slice(0, max_projects);
  console.log(`📊 Processing top ${companies.length} of ${allCompanies.length} companies for project generation`);

  await updateRun({ companies_discovered: allCompanies.length });

  const results: any[] = [];
  const errors: string[] = [];
  const validationResults: { company: string; valid: boolean; reason: string }[] = [];

  for (const company of companies) {
    try {
      console.log(`\n🏢 Processing: ${company.name}`);

      // ── Step 1: AI Company-Course Validation ──
      const validation = await validateCompanyCourseMatch({
        companyName: company.name,
        companyDescription: company.description || '',
        companySector: company.sector || 'Unknown',
        companyIndustries: company.industries || [],
        companyKeywords: company.keywords || [],
        companyJobPostings: company.job_postings || [],
        companyTechnologies: company.technologies_used || [],
        courseTitle: course.title,
        courseLevel: course.academic_level || 'undergraduate',
        courseOutcomes: objectives,
      });

      validationResults.push({
        company: company.name,
        valid: validation.isValid,
        reason: validation.reason,
      });

      if (!validation.isValid && validation.confidence >= 0.7) {
        console.log(`   ❌ Rejected: ${validation.reason}`);
        continue; // Skip this company
      }

      // ── Step 1b: Filter company signals to course-relevant data ──
      const filteredCompany = filterRelevantSignals(
        company as CompanyInfo,
        course.search_location || '',
        course.title,
        objectives
      );

      // Skip company if zero relevant job postings AND zero relevant technologies
      if (
        (filteredCompany.job_postings || []).length === 0 &&
        (filteredCompany.technologies_used || []).length === 0
      ) {
        console.log(`   ⚠️ Skipped: No relevant job postings or technologies for "${course.title}"`);
        validationResults[validationResults.length - 1].reason += ' (no relevant signals)';
        continue;
      }

      // ── Step 2: AI Project Proposal Generation (with retry) ──
      console.log(`   🤖 Generating project proposal...`);
      const rawProposal = await withRetry(
        () => generateProjectProposal(
          filteredCompany,
          objectives,
          course.title,
          course.academic_level || 'undergraduate',
          course.expected_artifacts || [],
          15, // weeks
          10, // hours per week
          bloomTier
        ),
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          operationName: `generate-proposal-${company.name}`,
        }
      );

      // ── Step 2b: Post-generation validation ──
      const { cleaned: proposal, issues: cleanIssues } = cleanAndValidate(rawProposal);
      const validationErrors = validateProjectData(proposal, company);

      if (cleanIssues.length > 0) {
        console.warn(`   ⚠️ Clean issues for ${company.name}: ${cleanIssues.join('; ')}`);
      }
      if (validationErrors.length > 0) {
        console.warn(`   ⚠️ Validation warnings for ${company.name}: ${validationErrors.join('; ')}`);
      }

      // ── Step 3: LO Alignment Scoring ──
      const loScore = await calculateLOAlignment(
        proposal.tasks,
        proposal.deliverables,
        objectives,
        proposal.lo_alignment
      );

      // ── Step 4: Market Alignment Scoring (uses filtered data + inferred needs) ──
      const marketScore = calculateMarketAlignmentScore(
        proposal.tasks,
        objectives,
        filteredCompany.job_postings || [],
        filteredCompany.technologies_used || [],
        company.inferred_needs || []
      );

      // ── Step 5: Pricing & ROI ──
      const teamSize = 4;
      const { budget, breakdown: pricingBreakdown } = calculateApolloEnrichedPricing(
        15, 10, teamSize,
        proposal.tier,
        company as CompanyInfo
      );

      const roi = calculateApolloEnrichedROI(
        budget,
        proposal.deliverables,
        company as CompanyInfo,
        proposal.tasks
      );

      // ── Calculate final composite score ──
      const feasibilityScore = Math.min(1.0, (marketScore / 100) * 0.6 + 0.4);
      const finalScore = 0.5 * loScore + 0.3 * feasibilityScore + 0.2 * (validation.confidence || 0.7);

      // Build deterministic stakeholder ROI breakdown from value_components
      const roiBreakdown = buildStakeholderROI(roi, loScore, feasibilityScore);

      // ── Step 6: LO Alignment Detail ──
      const loDetail = await generateLOAlignmentDetail(
        proposal.tasks,
        proposal.deliverables,
        objectives,
        proposal.lo_alignment
      );

      // ── Step 7: Insert capstone project ──
      const { data: project, error: insertError } = await supabase
        .from('capstone_projects')
        .insert({
          instructor_course_id,
          company_profile_id: company.id,
          title: proposal.title,
          description: proposal.description,
          tasks: proposal.tasks,
          deliverables: proposal.deliverables,
          skills: proposal.skills,
          tier: proposal.tier,
          lo_alignment: proposal.lo_alignment,
          lo_alignment_score: Math.round(loScore * 100) / 100,
          feasibility_score: Math.round(feasibilityScore * 100) / 100,
          final_score: Math.round(finalScore * 100) / 100,
          contact: proposal.contact,
          equipment: proposal.equipment,
          majors: proposal.majors,
          status: 'generated',
        })
        .select()
        .single();

      if (insertError) {
        console.error(`   ❌ DB insert failed for ${company.name}:`, insertError);
        errors.push(`${company.name}: ${insertError.message}`);
        continue;
      }

      // ── Step 8: Insert 6-form structured data ──
      await supabase.from('project_forms').insert({
        capstone_project_id: project.id,
        form1_project_details: {
          title: proposal.title,
          industry: company.sector,
          description: proposal.description,
          budget: budget,
          roi_multiplier: roi.roi_multiplier,
          roi_breakdown: roiBreakdown,
          value_components: roi.value_components,
        },
        form2_contact_info: {
          company: company.name,
          contact_name: company.contact_person || proposal.contact?.name || 'TBD',
          contact_email: company.contact_email || proposal.contact?.email || '',
          contact_title: company.contact_title || proposal.contact?.title || 'TBD',
          contact_phone: company.contact_phone || proposal.contact?.phone || '',
          website: company.website || '',
          linkedin: company.linkedin_profile || '',
        },
        form3_requirements: {
          skills: proposal.skills,
          deliverables: proposal.deliverables,
          learning_objectives: proposal.lo_alignment,
          team_size: teamSize,
          lo_alignment_detail: loDetail,
        },
        form4_timeline: {
          weeks: 15,
          hours_per_week: 10,
          start_date: null,
          end_date: null,
        },
        form5_logistics: {
          type: 'Consulting',
          scope: validation.suggestedProjectType || 'Applied Project',
          location: 'Hybrid',
          equipment: proposal.equipment,
          ip_agreement: 'Standard university IP policy',
          past_experience: company.funding_stage ? `${company.funding_stage} company` : 'N/A',
        },
        form6_academic: {
          level: course.academic_level || 'undergraduate',
          difficulty: proposal.tier,
          majors: proposal.majors,
          faculty_expertise: 'As determined by department',
          hours_per_week: 10,
          category: company.sector || 'General',
        },
        milestones: generateMilestones(proposal.deliverables, 15),
      });

      results.push({
        id: project.id,
        title: proposal.title,
        company: company.name,
        lo_score: loScore,
        market_score: marketScore,
        feasibility_score: feasibilityScore,
        final_score: finalScore,
        budget,
        roi_multiplier: roi.roi_multiplier,
        validation: {
          valid: validation.isValid,
          confidence: validation.confidence,
          reason: validation.reason,
        },
      });

      console.log(`   ✅ "${proposal.title}" (score: ${(finalScore * 100).toFixed(0)}%, budget: $${budget})`);

      await updateRun({ projects_generated: results.length });
    } catch (err) {
      console.error(`   ❌ Failed for ${company.name}:`, err);
      errors.push(`${company.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Update generation run as completed
  await updateRun({
    status: results.length > 0 ? 'completed' : 'failed',
    projects_generated: results.length,
    companies_validated: validationResults.length,
    completed_at: new Date().toISOString(),
    error_details: errors.length > 0 ? { errors } : null,
    total_processing_time_ms: Date.now() - Date.now(), // approximate
  });

  return createSuccessResponse({
    success: true,
    projects_generated: results.length,
    companies_processed: companies.length,
    companies_validated: validationResults.length,
    companies_rejected: validationResults.filter(v => !v.valid).length,
    projects: results,
    validation_summary: validationResults,
    errors: errors.length > 0 ? errors : undefined,
  }, corsHeaders);
};

/**
 * Determine project tier from Bloom's taxonomy levels
 */
function determineBloomTier(bloomLevels: string[]): string {
  if (bloomLevels.length === 0) return 'Applied'; // default

  const counts: Record<string, number> = {};
  for (const level of bloomLevels) {
    const normalized = (level || '').toLowerCase();
    counts[normalized] = (counts[normalized] || 0) + 1;
  }

  const highOrder = (counts['evaluate'] || 0) + (counts['create'] || 0) + (counts['synthesis'] || 0);
  const midOrder = (counts['apply'] || 0) + (counts['analyze'] || 0) + (counts['analysis'] || 0);
  const lowOrder = (counts['remember'] || 0) + (counts['understand'] || 0) + (counts['knowledge'] || 0) + (counts['comprehension'] || 0);

  const total = bloomLevels.length;
  if (highOrder / total >= 0.4) return 'Advanced';
  if (midOrder / total >= 0.4) return 'Applied';
  return 'Guided';
}

/**
 * Generate weekly milestones from deliverables
 */
/**
 * Build deterministic stakeholder ROI scores from pricing service output
 */
function buildStakeholderROI(roi: any, loScore: number, feasibilityScore: number) {
  const multiplier = roi.roi_multiplier || 1;
  const components = roi.value_components || [];

  // Derive category scores from actual data
  const hasDeliverables = components.some((c: any) => c.category === 'Professional Deliverables');
  const hasTalent = components.some((c: any) => c.category === 'Talent Pipeline Access');
  const hasStrategic = components.some((c: any) => c.category === 'Strategic Innovation Consulting');
  const hasTech = components.some((c: any) => c.category === 'Academic Research & Technology Transfer');

  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

  return {
    students: {
      career_readiness: clamp(feasibilityScore * 100 * 0.9 + (hasTalent ? 15 : 0)),
      skills_development: clamp(loScore * 100 * 0.85 + (hasTech ? 10 : 0)),
      portfolio_value: clamp(hasDeliverables ? multiplier * 22 : multiplier * 15),
      network_growth: clamp(hasTalent ? 75 + multiplier * 5 : 50 + multiplier * 5),
    },
    university: {
      partnership: clamp(multiplier * 20 + (hasStrategic ? 15 : 0)),
      placement: clamp(hasTalent ? 80 + multiplier * 3 : 55),
      research: clamp(hasTech ? 70 + multiplier * 5 : 45),
      reputation: clamp(feasibilityScore * 100 * 0.7 + loScore * 100 * 0.3),
    },
    industry: {
      mroi: clamp(multiplier * 25),
      talent_pipeline: clamp(hasTalent ? 85 + multiplier * 2 : 40),
      innovation: clamp(hasStrategic ? 70 + multiplier * 5 : 50),
      efficiency: clamp(hasDeliverables ? 65 + multiplier * 5 : 45),
    },
  };
}

function generateMilestones(deliverables: string[], totalWeeks: number): any[] {
  if (!deliverables || deliverables.length === 0) return [];

  const milestones: any[] = [];

  // Week 1: Project kickoff
  milestones.push({
    week: 1,
    deliverable: 'Project Kickoff & Scope Definition',
    type: 'checkpoint',
  });

  // Distribute deliverables across weeks 3 to (totalWeeks - 2)
  const availableWeeks = totalWeeks - 4;
  const weekSpacing = Math.max(1, Math.floor(availableWeeks / deliverables.length));

  deliverables.forEach((d, i) => {
    const week = Math.min(totalWeeks - 2, 3 + (i * weekSpacing));
    milestones.push({
      week,
      deliverable: d,
      type: 'deliverable',
    });
  });

  // Mid-point check-in
  const midWeek = Math.floor(totalWeeks / 2);
  if (!milestones.some(m => m.week === midWeek)) {
    milestones.push({
      week: midWeek,
      deliverable: 'Mid-Project Progress Review & Stakeholder Feedback',
      type: 'checkpoint',
    });
  }

  // Final week: presentation
  milestones.push({
    week: totalWeeks,
    deliverable: 'Final Project Presentation & Handoff',
    type: 'final',
  });

  milestones.sort((a, b) => a.week - b.week);
  return milestones;
}

Deno.serve(withErrorHandling(handler, getCorsHeaders));
