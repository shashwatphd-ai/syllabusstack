/**
 * Extract Capstone Competencies Edge Function
 * Ported from EduThree1's competency-extractor (278 lines)
 *
 * Enhancements over previous version:
 * - Proper tool calling with tool_choice (not schema hack)
 * - source_type = 'capstone_project' for proper attribution
 * - Circuit-breaker-style error handling
 * - Async chain to job-matcher (non-blocking, like EduThree1)
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";

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

  const { capstone_project_id } = await req.json();
  if (!capstone_project_id) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'capstone_project_id is required');
  }

  console.log(`🔍 Starting competency extraction for capstone project: ${capstone_project_id}`);

  // Step A: Fetch project data with company info
  const { data: project, error: projectError } = await supabase
    .from('capstone_projects')
    .select(`
      id, title, description, tasks, deliverables, skills,
      instructor_course_id, assigned_student_id, status,
      company_profiles(name, sector, technologies_used)
    `)
    .eq('id', capstone_project_id)
    .single();

  if (projectError || !project) {
    return createErrorResponse('NOT_FOUND', corsHeaders, 'Project not found');
  }

  // Verify auth: must be assigned student or course instructor
  const isInstructor = await supabase.rpc('is_course_instructor', {
    _user_id: user.id,
    _course_id: project.instructor_course_id,
  });

  if (!isInstructor.data && project.assigned_student_id !== user.id) {
    return createErrorResponse('FORBIDDEN', corsHeaders, 'Not authorized');
  }

  const studentId = project.assigned_student_id;
  if (!studentId) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'No student assigned to this project');
  }

  // Get course info for skill source
  const { data: course } = await supabase
    .from('instructor_courses')
    .select('title')
    .eq('id', project.instructor_course_id)
    .single();

  console.log(`👤 Processing project for student: ${studentId}`);

  // Step B: Build project context for AI analysis
  const company = (project as any).company_profiles;
  const projectContext = `
Project Title: ${project.title}
Industry Sector: ${company?.sector || 'Unknown'}

Project Description:
${project.description || 'N/A'}

Deliverables:
${JSON.stringify(project.deliverables, null, 2)}

Tasks:
${JSON.stringify(project.tasks, null, 2)}

Technologies Used by Company: ${company?.technologies_used?.join(', ') || 'N/A'}
  `.trim();

  // Step C: Extract skills using AI with tool calling (EduThree1 pattern)
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    // Fallback to project's pre-defined skills
    return await insertFallbackSkills(supabase, project, studentId, course?.title, corsHeaders);
  }

  const systemPrompt = `You are a technical skills assessment expert. Your job is to analyze completed student projects and extract specific, verifiable technical and business skills.

Focus on:
- Technical skills (programming languages, tools, frameworks, software)
- Business skills (market research, financial analysis, project management methodologies)
- Data skills (analytics tools, statistical methods, visualization platforms)
- Design skills (design software, prototyping tools, UX methods)

Return 5-7 specific, concrete skills. Use industry-standard terminology (e.g., "Python", "Tableau", "A/B Testing", "SQL", "Agile", "React", "Financial Modeling").

Do NOT include soft skills like "communication" or "teamwork". Only include measurable, verifiable technical competencies.`;

  let extractedSkills: string[] = [];

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this completed capstone project and extract the technical skills:\n\n${projectContext}` }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_skills',
              description: 'Extract a list of specific technical and business skills from a completed project',
              parameters: {
                type: 'object',
                properties: {
                  skills: {
                    type: 'array',
                    items: {
                      type: 'string',
                      description: 'A specific, verifiable technical or business skill'
                    },
                    minItems: 5,
                    maxItems: 7
                  }
                },
                required: ['skills'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_skills' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Gateway error: ${response.status} - ${errorText.substring(0, 200)}`);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fallback to project skills on AI failure
      return await insertFallbackSkills(supabase, project, studentId, course?.title, corsHeaders);
    }

    const aiData = await response.json();

    // Extract skills from tool call response (EduThree1's exact pattern)
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.name === 'extract_skills') {
      const skillsData = JSON.parse(toolCall.function.arguments);
      extractedSkills = skillsData.skills || [];
    } else {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*"skills"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extractedSkills = parsed.skills || [];
      }
    }
  } catch (error) {
    console.error('AI extraction failed:', error);
    // Fallback to project's pre-defined skills
    return await insertFallbackSkills(supabase, project, studentId, course?.title, corsHeaders);
  }

  if (extractedSkills.length === 0) {
    extractedSkills = project.skills || [];
  }

  console.log(`🎯 Extracted ${extractedSkills.length} skills:`, extractedSkills);

  // Step D: Insert verified skills using existing DB function
  let insertedCount = 0;
  for (const skill of extractedSkills) {
    try {
      await supabase.rpc('add_verified_skill_from_course', {
        p_user_id: studentId,
        p_skill_name: skill,
        p_proficiency_level: 'intermediate',
        p_course_id: project.instructor_course_id,
        p_course_name: course?.title || 'Capstone Project',
      });
      insertedCount++;
    } catch (err) {
      console.warn(`Skill insert failed for "${skill}":`, err);
    }
  }

  console.log(`✅ Inserted ${insertedCount} verified skills for student ${studentId}`);

  // Step E: Chain to job-matcher (async, non-blocking — matches EduThree1's pattern)
  let jobMatcherInvoked = false;
  try {
    console.log(`🔗 Invoking job-matcher for student ${studentId}...`);
    const { error: invokeError } = await supabase.functions.invoke('job-matcher', {
      body: {
        student_id: studentId,
        project_id: capstone_project_id,
        skills: extractedSkills,
      }
    });

    if (invokeError) {
      // CRITICAL: Do NOT fail the whole step (EduThree1 pattern)
      console.error('⚠️ Failed to invoke job-matcher:', invokeError);
    } else {
      jobMatcherInvoked = true;
      console.log('✅ Successfully invoked job-matcher.');
    }
  } catch (chainError) {
    // Non-blocking — skills were extracted successfully
    console.error('⚠️ Job-matcher chain error (non-blocking):', chainError);
  }

  return createSuccessResponse({
    success: true,
    capstone_project_id,
    student_id: studentId,
    skills_extracted: extractedSkills.length,
    skills: extractedSkills,
    competencies_created: insertedCount,
    job_matcher_invoked: jobMatcherInvoked,
  }, corsHeaders);
};

/**
 * Fallback: insert skills from project's pre-defined skills array
 */
async function insertFallbackSkills(
  supabase: any,
  project: any,
  studentId: string,
  courseTitle: string | undefined,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const fallbackSkills = project.skills || [];
  console.log(`⚠️ Using fallback skills (${fallbackSkills.length}) from project definition`);

  let insertedCount = 0;
  for (const skill of fallbackSkills) {
    try {
      await supabase.rpc('add_verified_skill_from_course', {
        p_user_id: studentId,
        p_skill_name: skill,
        p_proficiency_level: 'intermediate',
        p_course_id: project.instructor_course_id,
        p_course_name: courseTitle || 'Capstone Project',
      });
      insertedCount++;
    } catch (err) {
      console.warn(`Fallback skill insert failed for "${skill}":`, err);
    }
  }

  return createSuccessResponse({
    success: true,
    capstone_project_id: project.id,
    student_id: studentId,
    skills_extracted: fallbackSkills.length,
    skills: fallbackSkills,
    competencies_created: insertedCount,
    extraction_method: 'fallback',
  }, corsHeaders);
}

Deno.serve(withErrorHandling(handler, getCorsHeaders));
