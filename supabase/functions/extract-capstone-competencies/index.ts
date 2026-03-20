/**
 * Extract Capstone Competencies Edge Function
 * Analyzes a completed capstone project and extracts verified skills
 * Adapted from EduThree1's competency-extractor (278 lines)
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { generateText, MODELS } from "../_shared/unified-ai-client.ts";

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

  console.log(`🔍 Extracting competencies for capstone project: ${capstone_project_id}`);

  // Fetch project data
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

  // Build context for AI
  const company = (project as any).company_profiles;
  const projectContext = `
Project Title: ${project.title}
Industry Sector: ${company?.sector || 'Unknown'}
Description: ${project.description || 'N/A'}
Deliverables: ${JSON.stringify(project.deliverables, null, 2)}
Tasks: ${JSON.stringify(project.tasks, null, 2)}
Technologies: ${company?.technologies_used?.join(', ') || 'N/A'}
  `.trim();

  // Extract skills using AI with tool calling
  const systemPrompt = `You are a technical skills assessment expert. Analyze completed student projects and extract specific, verifiable technical and business skills.

Focus on:
- Technical skills (programming languages, tools, frameworks)
- Business skills (market research, financial analysis, methodologies)
- Data skills (analytics tools, statistical methods)

Return 5-7 specific, concrete skills using industry-standard terminology.
Do NOT include soft skills like "communication" or "teamwork".`;

  const result = await generateText({
    prompt: `Analyze this completed capstone project and extract the technical skills:\n\n${projectContext}`,
    systemPrompt,
    schema: {
      name: 'extract_skills',
      description: 'Extract technical and business skills from a project',
      parameters: {
        type: 'object',
        properties: {
          skills: {
            type: 'array',
            items: { type: 'string' },
          }
        },
        required: ['skills'],
        additionalProperties: false,
      }
    },
    options: { model: MODELS.PROFESSOR_AI, temperature: 0.3 },
  });

  // Parse skills from response
  let extractedSkills: string[] = [];
  try {
    // Try tool call response first
    const toolCallMatch = result.content.match(/\{[\s\S]*"skills"[\s\S]*\}/);
    if (toolCallMatch) {
      const parsed = JSON.parse(toolCallMatch[0]);
      extractedSkills = parsed.skills || [];
    }
  } catch {
    // Fallback: use project's pre-defined skills
    extractedSkills = project.skills || [];
  }

  if (extractedSkills.length === 0) {
    extractedSkills = project.skills || [];
  }

  console.log(`🎯 Extracted ${extractedSkills.length} skills:`, extractedSkills);

  // Insert verified skills using existing DB function
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

  return createSuccessResponse({
    success: true,
    capstone_project_id,
    student_id: studentId,
    skills_extracted: extractedSkills.length,
    skills: extractedSkills,
    competencies_created: insertedCount,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
