/**
 * Generate Capstone Projects Edge Function
 * Generates AI-powered industry project proposals for instructor courses
 * Adapted from EduThree1's generate-projects (1,122 lines)
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { generateProjectProposal } from "../_shared/capstone/generation-service.ts";
import { calculateLOAlignment } from "../_shared/capstone/alignment-service.ts";
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

  // Fetch course data
  const { data: course, error: courseError } = await supabase
    .from('instructor_courses')
    .select('id, title, academic_level, expected_artifacts')
    .eq('id', instructor_course_id)
    .single();
  if (courseError || !course) return createErrorResponse('NOT_FOUND', corsHeaders, 'Course not found');

  // Fetch learning objectives
  const { data: los } = await supabase
    .from('learning_objectives')
    .select('id, text, bloom_level')
    .eq('instructor_course_id', instructor_course_id);
  const objectives = (los || []).map((lo: any) => lo.text);

  if (objectives.length === 0) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Course has no learning objectives');
  }

  // Fetch companies
  let companiesQuery = supabase.from('company_profiles').select('*');
  if (company_ids?.length) {
    companiesQuery = companiesQuery.in('id', company_ids);
  } else {
    // Get companies already linked to this course via existing capstone_projects
    const { data: existingProjects } = await supabase
      .from('capstone_projects')
      .select('company_profile_id')
      .eq('instructor_course_id', instructor_course_id);
    
    const existingIds = (existingProjects || []).map(p => p.company_profile_id).filter(Boolean);
    
    if (existingIds.length === 0) {
      return createErrorResponse('BAD_REQUEST', corsHeaders, 'No companies found. Run company discovery first.');
    }
    companiesQuery = companiesQuery.in('id', existingIds);
  }

  const { data: companies, error: compError } = await companiesQuery;
  if (compError || !companies?.length) {
    return createErrorResponse('NOT_FOUND', corsHeaders, 'No companies found');
  }

  console.log(`📊 Generating projects for ${companies.length} companies`);

  // Generate projects sequentially (to avoid rate limits)
  const results: any[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    try {
      console.log(`\n🏢 Generating project for: ${company.name}`);
      
      const proposal = await generateProjectProposal(
        company as CompanyInfo,
        objectives,
        course.title,
        course.academic_level || 'undergraduate',
        course.expected_artifacts || []
      );

      // Calculate scores
      const loScore = await calculateLOAlignment(
        proposal.tasks,
        proposal.deliverables,
        objectives,
        proposal.lo_alignment
      );
      const feasibilityScore = 0.80;
      const finalScore = 0.5 * loScore + 0.3 * feasibilityScore + 0.2 * 0.80;

      // Insert capstone project
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
        console.error(`DB insert failed for ${company.name}:`, insertError);
        errors.push(`${company.name}: ${insertError.message}`);
        continue;
      }

      // Insert project forms
      await supabase.from('project_forms').insert({
        capstone_project_id: project.id,
        form1_project_details: {
          title: proposal.title,
          industry: company.sector,
          description: proposal.description,
        },
        form2_contact_info: {
          company: company.name,
          contact_name: company.contact_person || 'TBD',
          contact_email: company.contact_email || '',
          contact_title: company.contact_title || 'TBD',
          website: company.website || '',
        },
        form3_requirements: {
          skills: proposal.skills,
          deliverables: proposal.deliverables,
          learning_objectives: proposal.lo_alignment,
        },
        form4_timeline: { weeks: 15 },
        form5_logistics: {
          type: 'Consulting',
          location: 'Hybrid',
          equipment: proposal.equipment,
        },
        form6_academic: {
          level: course.academic_level || 'undergraduate',
          difficulty: proposal.tier,
          majors: proposal.majors,
        },
        milestones: proposal.deliverables.map((d: string, i: number) => ({
          week: (i + 1) * Math.floor(15 / proposal.deliverables.length),
          deliverable: d,
        })),
      });

      results.push({
        id: project.id,
        title: proposal.title,
        company: company.name,
        lo_score: loScore,
        final_score: finalScore,
      });

      console.log(`✅ ${company.name}: "${proposal.title}" (score: ${(finalScore * 100).toFixed(0)}%)`);

      // Rate limit pause between companies
      if (companies.indexOf(company) < companies.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`❌ Failed for ${company.name}:`, err);
      errors.push(`${company.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return createSuccessResponse({
    success: true,
    projects_generated: results.length,
    projects: results,
    errors: errors.length > 0 ? errors : undefined,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
