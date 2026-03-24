/**
 * Job Matcher Edge Function
 *
 * Embedding-based cosine similarity matching between student skill profiles
 * and job requirements from demand signals + company profiles.
 *
 * Flow:
 * 1. Fetch student's verified_skills + skill_profiles
 * 2. Generate/retrieve student skill embedding
 * 3. Fetch active demand_signals and job postings from company_profiles
 * 4. Generate/retrieve job requirement embeddings
 * 5. Compute cosine similarity scores
 * 6. Insert/update job_matches table
 * 7. Return ranked matches with skill overlap details
 *
 * Auth: JWT required
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { validateRequest, jobMatcherSchema } from "../_shared/validators/index.ts";
import { generateEmbedding, cosineSimilarity, getCachedOrGenerate } from "../_shared/embedding-client.ts";
import { checkRateLimit, getUserLimits } from "../_shared/rate-limiter.ts";

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

  // Rate limiting
  const limits = await getUserLimits(supabase, user.id);
  const rateLimitResult = await checkRateLimit(supabase, user.id, 'job-matcher', limits);
  if (!rateLimitResult.allowed) {
    return createErrorResponse('RATE_LIMIT_EXCEEDED', corsHeaders, 'Job matching rate limit exceeded');
  }

  // Validate input
  const body = await req.json();
  const validation = validateRequest(jobMatcherSchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }

  const { student_id, course_id, limit, min_score } = validation.data;
  const targetStudentId = student_id || user.id;

  console.log(`🎯 Running job matcher for student: ${targetStudentId}`);

  // ── Step 1: Fetch student skills ──
  const { data: verifiedSkills } = await supabase
    .from('verified_skills')
    .select('skill_name, proficiency_level, source_type, metadata')
    .eq('user_id', targetStudentId);

  const { data: skillProfile } = await supabase
    .from('skill_profiles')
    .select('skills_data, assessment_scores')
    .eq('user_id', targetStudentId)
    .single();

  // Build student skill text for embedding
  const studentSkillNames = (verifiedSkills || []).map(s => s.skill_name);
  const profileSkills = skillProfile?.skills_data
    ? Object.keys(skillProfile.skills_data)
    : [];

  const allStudentSkills = [...new Set([...studentSkillNames, ...profileSkills])];

  if (allStudentSkills.length === 0) {
    return createSuccessResponse({
      matches: [],
      message: 'No verified skills found. Complete assessments or capstone projects first.',
    }, corsHeaders);
  }

  const studentSkillText = allStudentSkills.join(', ');
  console.log(`   📋 Student has ${allStudentSkills.length} skills: ${studentSkillText.slice(0, 200)}`);

  // ── Step 2: Generate student embedding ──
  const studentEmbedding = await getCachedOrGenerate(
    supabase,
    'student_profile',
    targetStudentId,
    `Student skills: ${studentSkillText}`
  );

  // ── Step 3: Fetch job sources ──
  // 3a: Company profiles with job postings
  let companyQuery = supabase
    .from('company_profiles')
    .select('id, name, sector, job_postings, technologies_used, industries, contact_email')
    .not('job_postings', 'is', null);

  if (course_id) {
    companyQuery = companyQuery.eq('instructor_course_id', course_id);
  }

  const { data: companies } = await companyQuery.limit(100);

  // 3b: Demand signals with job posting data
  const { data: demandSignals } = await supabase
    .from('demand_signals')
    .select('skill_name, signal_value, source, location')
    .eq('signal_type', 'job_posting_volume')
    .order('created_at', { ascending: false })
    .limit(200);

  // ── Step 4: Build job candidates ──
  type JobCandidate = {
    jobTitle: string;
    companyName: string;
    companyProfileId: string | null;
    requiredSkills: string[];
    location: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    source: string;
    metadata: Record<string, any>;
  };

  const candidates: JobCandidate[] = [];

  // From company job postings
  for (const company of (companies || [])) {
    const postings = Array.isArray(company.job_postings) ? company.job_postings : [];
    for (const posting of postings.slice(0, 5)) {
      candidates.push({
        jobTitle: posting.title || posting.job_title || 'Unknown',
        companyName: company.name,
        companyProfileId: company.id,
        requiredSkills: [
          ...(posting.required_skills || posting.skills || []),
          ...(company.technologies_used || []),
        ],
        location: posting.location || null,
        salaryMin: posting.salary_min || null,
        salaryMax: posting.salary_max || null,
        source: 'direct_posting',
        metadata: {
          sector: company.sector,
          industries: company.industries,
          contact_email: company.contact_email,
        },
      });
    }
  }

  // From demand signals (synthesized job matches)
  const signalsBySkill = new Map<string, any[]>();
  for (const signal of (demandSignals || [])) {
    const existing = signalsBySkill.get(signal.skill_name) || [];
    existing.push(signal);
    signalsBySkill.set(signal.skill_name, existing);
  }

  // Match student skills to demand signals
  for (const skill of allStudentSkills) {
    const signals = signalsBySkill.get(skill.toLowerCase());
    if (!signals?.length) continue;

    const topSignal = signals[0];
    const sampleJobs = topSignal.signal_value?.sample_jobs || [];
    for (const job of sampleJobs) {
      candidates.push({
        jobTitle: job.title || `${skill} Role`,
        companyName: job.company || 'Various',
        companyProfileId: null,
        requiredSkills: [skill],
        location: topSignal.location,
        salaryMin: job.salary_min || null,
        salaryMax: job.salary_max || null,
        source: 'demand_signal',
        metadata: { signal_source: topSignal.source },
      });
    }
  }

  if (candidates.length === 0) {
    return createSuccessResponse({
      matches: [],
      message: 'No job candidates found. Run company discovery first.',
    }, corsHeaders);
  }

  console.log(`   📊 Found ${candidates.length} job candidates`);

  // ── Step 5: Score candidates via embedding similarity ──
  const matches: any[] = [];

  for (const candidate of candidates) {
    const jobText = [
      candidate.jobTitle,
      ...candidate.requiredSkills,
      candidate.companyName,
    ].join(', ');

    const jobEmbedding = await getCachedOrGenerate(
      supabase,
      'job_posting',
      `${candidate.companyName}:${candidate.jobTitle}`.slice(0, 100),
      `Job: ${jobText}`
    );

    const score = cosineSimilarity(studentEmbedding.embedding, jobEmbedding.embedding);

    if (score < (min_score || 0.3)) continue;

    // Calculate skill overlap
    const studentSkillSet = new Set(allStudentSkills.map(s => s.toLowerCase()));
    const requiredSet = new Set(candidate.requiredSkills.map(s => s.toLowerCase()));
    const matched = [...studentSkillSet].filter(s => requiredSet.has(s));
    const missing = [...requiredSet].filter(s => !studentSkillSet.has(s));
    const extra = [...studentSkillSet].filter(s => !requiredSet.has(s));

    matches.push({
      job_title: candidate.jobTitle,
      company_name: candidate.companyName,
      company_profile_id: candidate.companyProfileId,
      match_score: Math.round(score * 1000) / 1000,
      skill_overlap: { matched, missing, extra: extra.slice(0, 10) },
      salary_estimate: candidate.salaryMin || candidate.salaryMax
        ? { min: candidate.salaryMin, max: candidate.salaryMax, currency: 'USD' }
        : null,
      location: candidate.location,
      source: candidate.source,
      metadata: candidate.metadata,
    });
  }

  // Sort by score descending and limit
  matches.sort((a, b) => b.match_score - a.match_score);
  const topMatches = matches.slice(0, limit || 20);

  // ── Step 6: Upsert to job_matches table ──
  if (topMatches.length > 0) {
    const records = topMatches.map(m => ({
      student_id: targetStudentId,
      job_title: m.job_title,
      company_name: m.company_name,
      company_profile_id: m.company_profile_id,
      match_score: m.match_score,
      skill_overlap: m.skill_overlap,
      salary_estimate: m.salary_estimate,
      location: m.location,
      source: m.source,
      metadata: m.metadata,
      status: 'active',
    }));

    const { error: insertError } = await supabase
      .from('job_matches')
      .insert(records);

    if (insertError) {
      console.error('Failed to save job matches:', insertError);
    } else {
      console.log(`   ✅ Saved ${records.length} job matches`);
    }
  }

  return createSuccessResponse({
    matches: topMatches,
    total_candidates: candidates.length,
    total_matches: matches.length,
    returned: topMatches.length,
    student_skills: allStudentSkills.length,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
