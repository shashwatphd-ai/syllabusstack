/**
 * generate-value-analysis — Self-contained wrapper around analyze-project-value.
 * Fetches project + company + course data, then delegates to the analysis engine.
 * Called by: useGenerateValueAnalysis() hook in the frontend.
 *
 * Body: { project_id: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { verifyAuth, unauthorizedResponse } from '../_shared/capstone/auth-middleware.ts';

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated) {
      return unauthorizedResponse(req, authResult.error || 'Unauthorized');
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch project + company
    const { data: project, error: pErr } = await supabase
      .from('capstone_projects')
      .select('*, company_profiles(*)')
      .eq('id', project_id)
      .single();

    if (pErr || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch course data
    const { data: course } = await supabase
      .from('instructor_courses')
      .select('*, courses(title, description)')
      .eq('id', project.instructor_course_id)
      .single();

    // 3. Ensure project_metadata row exists
    const { data: existing } = await supabase
      .from('project_metadata')
      .select('id')
      .eq('project_id', project_id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('project_metadata').insert({ project_id });
    }

    // 4. Delegate to analyze-project-value
    const { data: result, error: invokeErr } = await supabase.functions.invoke(
      'analyze-project-value',
      {
        body: {
          projectId: project_id,
          companyProfile: project.company_profiles || {},
          projectData: {
            title: project.title,
            description: project.description,
            tasks: project.tasks,
            deliverables: project.deliverables,
            skills: project.skills,
            tier: project.tier,
          },
          courseProfile: {
            title: course?.courses?.title || course?.course_title || '',
            description: course?.courses?.description || '',
            level: course?.academic_level || 'undergraduate',
            outcomes: course?.learning_objectives || [],
          },
        },
        headers: { Authorization: req.headers.get('Authorization') || '' },
      }
    );

    if (invokeErr) {
      console.error('[generate-value-analysis] invoke error:', invokeErr);
      throw invokeErr;
    }

    return new Response(JSON.stringify({ success: true, ...(result || {}) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[generate-value-analysis] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate value analysis.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
