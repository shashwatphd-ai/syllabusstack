/**
 * Portfolio Export Edge Function
 *
 * Generates an exportable student portfolio aggregating:
 * - Verified skills (from assessments, projects, certifications)
 * - Completed capstone projects
 * - Certificates & badges
 * - Course enrollments & progress
 * - Job matches & career readiness
 *
 * Returns structured JSON or HTML for PDF rendering.
 *
 * Auth: JWT required
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { validateRequest, portfolioExportSchema } from "../_shared/validators/index.ts";

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
  const body = await req.json().catch(() => ({}));
  const validation = validateRequest(portfolioExportSchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }

  const { format, include_sections } = validation.data;
  const sections = include_sections || [
    'verified_skills', 'capstone_projects', 'certificates',
    'course_enrollments', 'job_matches', 'assessments',
  ];

  console.log(`📄 Generating portfolio for user: ${user.id} (format: ${format})`);

  // ── Fetch profile ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, university, major, graduation_year, bio, linkedin_url')
    .eq('id', user.id)
    .single();

  const portfolio: Record<string, any> = {
    student: {
      id: user.id,
      name: profile?.full_name || user.email?.split('@')[0] || 'Student',
      email: user.email,
      university: profile?.university,
      major: profile?.major,
      graduation_year: profile?.graduation_year,
      bio: profile?.bio,
      linkedin_url: profile?.linkedin_url,
      avatar_url: profile?.avatar_url,
    },
    generated_at: new Date().toISOString(),
    sections: {},
  };

  // ── Verified Skills ──
  if (sections.includes('verified_skills')) {
    const { data: skills } = await supabase
      .from('verified_skills')
      .select('skill_name, proficiency_level, source_type, source_name, verified_at, metadata')
      .eq('user_id', user.id)
      .order('verified_at', { ascending: false });

    // Group by proficiency
    const byLevel: Record<string, any[]> = {};
    for (const skill of (skills || [])) {
      const level = skill.proficiency_level || 'unrated';
      if (!byLevel[level]) byLevel[level] = [];
      byLevel[level].push({
        name: skill.skill_name,
        source: skill.source_type,
        source_name: skill.source_name,
        verified_at: skill.verified_at,
        bloom_level: skill.metadata?.bloom_level,
      });
    }

    portfolio.sections.verified_skills = {
      total: skills?.length || 0,
      by_level: byLevel,
      skills: skills || [],
    };
  }

  // ── Capstone Projects ──
  if (sections.includes('capstone_projects')) {
    const { data: projects } = await supabase
      .from('capstone_projects')
      .select(`
        id, title, description, skills, status, lo_alignment_score,
        feasibility_score, final_score, created_at,
        company_profiles(name, sector, city, state)
      `)
      .eq('assigned_student_id', user.id)
      .in('status', ['completed', 'active', 'in_progress'])
      .order('created_at', { ascending: false });

    portfolio.sections.capstone_projects = {
      total: projects?.length || 0,
      completed: projects?.filter(p => p.status === 'completed').length || 0,
      projects: (projects || []).map(p => ({
        title: p.title,
        description: p.description,
        company: (p as any).company_profiles?.name || 'Independent',
        sector: (p as any).company_profiles?.sector,
        location: [(p as any).company_profiles?.city, (p as any).company_profiles?.state].filter(Boolean).join(', '),
        skills: p.skills,
        status: p.status,
        scores: {
          lo_alignment: p.lo_alignment_score,
          feasibility: p.feasibility_score,
          final: p.final_score,
        },
        completed_at: p.status === 'completed' ? p.created_at : null,
      })),
    };
  }

  // ── Certificates ──
  if (sections.includes('certificates')) {
    const { data: certs } = await supabase
      .from('certificates')
      .select('id, certificate_type, certificate_number, mastery_score, skill_breakdown, issued_at, share_token')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false });

    portfolio.sections.certificates = {
      total: certs?.length || 0,
      certificates: (certs || []).map(c => ({
        type: c.certificate_type,
        number: c.certificate_number,
        mastery_score: c.mastery_score,
        skill_breakdown: c.skill_breakdown,
        issued_at: c.issued_at,
        verification_url: c.share_token
          ? `https://syllabusstack.com/verify/${c.share_token}`
          : null,
      })),
    };
  }

  // ── Course Enrollments ──
  if (sections.includes('course_enrollments')) {
    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select(`
        id, progress_percentage, verification_state, enrolled_at,
        instructor_courses(title, academic_level)
      `)
      .eq('student_id', user.id)
      .order('enrolled_at', { ascending: false });

    portfolio.sections.course_enrollments = {
      total: enrollments?.length || 0,
      completed: enrollments?.filter(e => e.progress_percentage >= 100).length || 0,
      enrollments: (enrollments || []).map(e => ({
        course: (e as any).instructor_courses?.title || 'Unknown Course',
        level: (e as any).instructor_courses?.academic_level,
        progress: e.progress_percentage,
        verification: e.verification_state,
        enrolled_at: e.enrolled_at,
      })),
    };
  }

  // ── Job Matches ──
  if (sections.includes('job_matches')) {
    const { data: matches } = await supabase
      .from('job_matches')
      .select('job_title, company_name, match_score, skill_overlap, salary_estimate, location, source, status')
      .eq('student_id', user.id)
      .order('match_score', { ascending: false })
      .limit(20);

    portfolio.sections.job_matches = {
      total: matches?.length || 0,
      top_matches: (matches || []).map(m => ({
        job_title: m.job_title,
        company: m.company_name,
        match_score: m.match_score,
        matched_skills: m.skill_overlap?.matched || [],
        gap_skills: m.skill_overlap?.missing || [],
        salary: m.salary_estimate,
        location: m.location,
        source: m.source,
        status: m.status,
      })),
    };
  }

  // ── Assessment Summary ──
  if (sections.includes('assessments')) {
    const { data: sessions } = await supabase
      .from('skills_assessment_sessions')
      .select('skill_names, status, total_score, assessment_type, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20);

    portfolio.sections.assessments = {
      total_completed: sessions?.length || 0,
      assessments: (sessions || []).map(s => ({
        skills: s.skill_names,
        type: s.assessment_type,
        score: s.total_score,
        completed_at: s.completed_at,
      })),
    };
  }

  // ── Format output ──
  if (format === 'html') {
    const html = generatePortfolioHTML(portfolio);
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  return createSuccessResponse(portfolio, corsHeaders);
};

/**
 * Generate simple HTML portfolio for PDF rendering
 */
function generatePortfolioHTML(portfolio: Record<string, any>): string {
  const student = portfolio.student;
  const skills = portfolio.sections.verified_skills;
  const projects = portfolio.sections.capstone_projects;
  const certs = portfolio.sections.certificates;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${student.name} — Student Portfolio</title>
  <style>
    body { font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a2e; }
    h1 { color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 8px; }
    h2 { color: #312e81; margin-top: 32px; }
    .badge { display: inline-block; background: #eef2ff; color: #4338ca; padding: 4px 12px; border-radius: 12px; margin: 4px; font-size: 14px; }
    .project { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .score { color: #059669; font-weight: bold; }
    .meta { color: #6b7280; font-size: 14px; }
    .cert { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin: 8px 0; }
  </style>
</head>
<body>
  <h1>${student.name}</h1>
  <p class="meta">
    ${student.university ? `${student.university}` : ''}
    ${student.major ? ` — ${student.major}` : ''}
    ${student.graduation_year ? ` (${student.graduation_year})` : ''}
  </p>
  ${student.bio ? `<p>${student.bio}</p>` : ''}
  ${student.linkedin_url ? `<p><a href="${student.linkedin_url}">LinkedIn Profile</a></p>` : ''}

  ${skills ? `
  <h2>Verified Skills (${skills.total})</h2>
  ${(skills.skills || []).map((s: any) => `<span class="badge">${s.skill_name}</span>`).join('')}
  ` : ''}

  ${projects ? `
  <h2>Capstone Projects (${projects.total})</h2>
  ${(projects.projects || []).map((p: any) => `
    <div class="project">
      <strong>${p.title}</strong> — ${p.company}
      <p class="meta">${p.sector || ''} ${p.location ? `| ${p.location}` : ''}</p>
      <p>${p.description?.slice(0, 200) || ''}${p.description?.length > 200 ? '...' : ''}</p>
      ${p.skills?.length ? `<p>Skills: ${p.skills.map((s: string) => `<span class="badge">${s}</span>`).join('')}</p>` : ''}
      ${p.scores.final ? `<p>Score: <span class="score">${(p.scores.final * 100).toFixed(0)}%</span></p>` : ''}
    </div>
  `).join('')}
  ` : ''}

  ${certs ? `
  <h2>Certificates (${certs.total})</h2>
  ${(certs.certificates || []).map((c: any) => `
    <div class="cert">
      <strong>${c.type}</strong> — #${c.number}
      ${c.mastery_score ? ` | Mastery: <span class="score">${c.mastery_score}%</span>` : ''}
      ${c.verification_url ? ` | <a href="${c.verification_url}">Verify</a>` : ''}
    </div>
  `).join('')}
  ` : ''}

  <p class="meta" style="margin-top: 40px; text-align: center;">
    Generated by SyllabusStack on ${new Date(portfolio.generated_at).toLocaleDateString()}
  </p>
</body>
</html>`;
}

Deno.serve(withErrorHandling(handler, getCorsHeaders));
