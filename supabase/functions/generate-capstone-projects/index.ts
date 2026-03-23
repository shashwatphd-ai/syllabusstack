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
import type { CompanyInfo } from "../_shared/capstone/types.ts";

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

  const { instructor_course_id, company_ids } = await req.json();
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

  // ── Fetch course data ──
  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, academic_level, expected_artifacts')
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
      .order('match_score', { ascending: false, nullsFirst: false });
  }

  const { data: companies, error: compError } = await companiesQuery;
  if (compError || !companies?.length) {
    return createErrorResponse('BAD_REQUEST', corsHeaders,
      'No companies found for this course. Run company discovery first.');
  }

  console.log(`📊 Processing ${companies.length} companies for project generation`);

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

      // ── Step 2: AI Project Proposal Generation ──
      console.log(`   🤖 Generating project proposal...`);
      const proposal = await generateProjectProposal(
        company as CompanyInfo,
        objectives,
        course.title,
        course.academic_level || 'undergraduate',
        course.expected_artifacts || [],
        15, // weeks
        10, // hours per week
        bloomTier
      );

      // ── Step 3: LO Alignment Scoring ──
      const loScore = await calculateLOAlignment(
        proposal.tasks,
        proposal.deliverables,
        objectives,
        proposal.lo_alignment
      );

      // ── Step 4: Market Alignment Scoring ──
      const marketScore = calculateMarketAlignmentScore(
        proposal.tasks,
        objectives,
        company.job_postings || [],
        company.technologies_used || []
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

      // Build deterministic stakeholder ROI breakdown from value_components
      const roiBreakdown = buildStakeholderROI(roi, loScore, feasibilityScore);

      // ── Step 6: LO Alignment Detail ──
      const loDetail = await generateLOAlignmentDetail(
        proposal.tasks,
        proposal.deliverables,
        objectives,
        proposal.lo_alignment
      );

      // ── Calculate final composite score ──
      const feasibilityScore = Math.min(1.0, (marketScore / 100) * 0.6 + 0.4);
      const finalScore = 0.5 * loScore + 0.3 * feasibilityScore + 0.2 * (validation.confidence || 0.7);

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

      // Rate limit pause between companies
      if (companies.indexOf(company) < companies.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`   ❌ Failed for ${company.name}:`, err);
      errors.push(`${company.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

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
