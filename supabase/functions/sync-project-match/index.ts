/**
 * Sync Project Match Edge Function
 *
 * Triggered after a capstone project is completed. Creates job_matches
 * entries linking the student to the company, and triggers competency
 * extraction to update verified_skills.
 *
 * Auth: JWT required (instructor or assigned student)
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { validateRequest, syncProjectMatchSchema } from "../_shared/validators/index.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Validate input
  const body = await req.json();
  const validation = validateRequest(syncProjectMatchSchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }

  const { capstone_project_id, student_id } = validation.data;

  // ── Fetch project with company info ──
  const { data: project, error: projectError } = await supabase
    .from('capstone_projects')
    .select(`
      id, title, description, skills, status, assigned_student_id,
      instructor_course_id, lo_alignment_score, feasibility_score, final_score,
      company_profiles(id, name, sector, technologies_used, contact_email, city, state)
    `)
    .eq('id', capstone_project_id)
    .single();

  if (projectError || !project) {
    return createErrorResponse('NOT_FOUND', corsHeaders, 'Project not found');
  }

  // Verify auth: must be assigned student or course instructor
  const isAssignedStudent = project.assigned_student_id === user.id;
  const { data: isInstructor } = await supabase.rpc('is_course_instructor', {
    _user_id: user.id,
    _course_id: project.instructor_course_id,
  });

  if (!isAssignedStudent && !isInstructor) {
    return createErrorResponse('FORBIDDEN', corsHeaders, 'Not authorized for this project');
  }

  const company = (project as any).company_profiles;
  console.log(`🔄 Syncing project match: "${project.title}" → ${company?.name || 'Unknown'}`);

  const results: Record<string, any> = {};

  // ── Step 1: Create job match record ──
  if (company) {
    const { data: jobMatch, error: matchError } = await supabase
      .from('job_matches')
      .insert({
        student_id,
        job_title: `${project.title} (Capstone)`,
        company_name: company.name,
        company_profile_id: company.id,
        match_score: project.final_score || 0.7,
        skill_overlap: {
          matched: project.skills || [],
          missing: [],
          extra: [],
        },
        location: [company.city, company.state].filter(Boolean).join(', ') || null,
        source: 'capstone_completion',
        status: 'matched',
        metadata: {
          capstone_project_id: project.id,
          lo_alignment_score: project.lo_alignment_score,
          feasibility_score: project.feasibility_score,
          sector: company.sector,
        },
      })
      .select('id')
      .single();

    if (matchError) {
      console.error('Failed to create job match:', matchError);
      results.job_match = { error: matchError.message };
    } else {
      results.job_match = { id: jobMatch?.id, status: 'created' };
    }
  }

  // ── Step 2: Trigger competency extraction (async, non-blocking) ──
  try {
    const extractResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-capstone-competencies`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ capstone_project_id }),
      }
    );

    if (extractResponse.ok) {
      const extractData = await extractResponse.json();
      results.competency_extraction = {
        status: 'triggered',
        skills_extracted: extractData.skills_count || extractData.skills?.length || 0,
      };
    } else {
      results.competency_extraction = { status: 'failed', error: `HTTP ${extractResponse.status}` };
    }
  } catch (err) {
    console.warn('Competency extraction call failed (non-blocking):', err);
    results.competency_extraction = { status: 'error', error: String(err) };
  }

  // ── Step 3: Update project status if needed ──
  if (project.status !== 'completed') {
    await supabase
      .from('capstone_projects')
      .update({ status: 'completed' })
      .eq('id', capstone_project_id);
    results.project_status = 'updated to completed';
  }

  console.log(`✅ Project match sync complete for "${project.title}"`);

  return createSuccessResponse({
    success: true,
    project_id: capstone_project_id,
    student_id,
    company: company?.name || null,
    results,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
