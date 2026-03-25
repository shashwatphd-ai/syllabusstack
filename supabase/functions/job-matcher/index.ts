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
 * 8. (EduThree parity) Fetch Apollo job postings for matched companies
 * 9. (EduThree parity) Send Resend "Talent Alert" emails to employers
 *
 * Auth: JWT required
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { validateRequest, jobMatcherSchema } from "../_shared/validators/index.ts";
import { generateEmbedding, cosineSimilarity, getCachedOrGenerate } from "../_shared/embedding-client.ts";
import { checkRateLimit, getUserLimits } from "../_shared/rate-limiter.ts";
import { withRetry } from "../_shared/capstone/retry-utils.ts";

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

  // ── Step 7: Fetch Apollo job postings for top matched companies ──
  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  let apolloJobsEnriched = 0;

  if (APOLLO_API_KEY && topMatches.length > 0) {
    const companiesWithApollo = new Set<string>();

    for (const match of topMatches) {
      if (!match.company_profile_id || companiesWithApollo.has(match.company_profile_id)) continue;
      companiesWithApollo.add(match.company_profile_id);

      // Look up Apollo org ID
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('apollo_organization_id, contact_email')
        .eq('id', match.company_profile_id)
        .single();

      if (!profile?.apollo_organization_id) continue;

      try {
        const apolloJobs = await withRetry(async () => {
          const resp = await fetch(
            `https://api.apollo.io/v1/organizations/${profile.apollo_organization_id}/job_postings?page=1&per_page=10`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': APOLLO_API_KEY,
              },
            }
          );
          if (!resp.ok) throw new Error(`Apollo HTTP ${resp.status}`);
          return resp.json();
        }, { maxRetries: 2, baseDelayMs: 1000, operationName: 'Apollo job fetch' });

        const postings = apolloJobs?.job_postings || apolloJobs?.organization_job_postings || [];

        // Enrich matching records with Apollo data
        for (const matchItem of topMatches.filter((m: any) => m.company_profile_id === profile.apollo_organization_id || m.company_name === profile.name)) {
          for (const posting of postings.slice(0, 3)) {
            // Check if job title overlaps with student skills
            const titleLower = (posting.title || '').toLowerCase();
            const hasSkillMatch = allStudentSkills.some(s => titleLower.includes(s.toLowerCase()));
            if (!hasSkillMatch) continue;

            // Insert Apollo-linked job match
            await supabase.from('job_matches').insert({
              student_id: targetStudentId,
              job_title: posting.title,
              company_name: matchItem.company_name,
              company_profile_id: matchItem.company_profile_id,
              match_score: matchItem.match_score * 0.95, // Slightly lower since indirect
              apollo_job_id: posting.id || null,
              apollo_job_url: posting.url || null,
              apollo_job_payload: posting,
              source: 'direct_posting',
              status: 'active',
            });
            apolloJobsEnriched++;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch Apollo jobs for ${match.company_name}:`, err);
      }
    }
  }

  // ── Step 8: Send Resend "Talent Alert" emails to employers ──
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  let talentAlertsSent = 0;

  if (RESEND_API_KEY && topMatches.length > 0) {
    // Get student profile for the email
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('full_name, email, university')
      .eq('user_id', targetStudentId)
      .single();

    if (studentProfile) {
      const notifiedCompanies = new Set<string>();

      for (const match of topMatches.slice(0, 5)) {
        if (!match.company_profile_id || notifiedCompanies.has(match.company_profile_id)) continue;

        const { data: profile } = await supabase
          .from('company_profiles')
          .select('contact_email, name')
          .eq('id', match.company_profile_id)
          .single();

        if (!profile?.contact_email) continue;
        notifiedCompanies.add(match.company_profile_id);

        try {
          await withRetry(async () => {
            const resp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'SyllabusStack <noreply@syllabusstack.com>',
                to: [profile.contact_email],
                subject: `Talent Alert: ${studentProfile.full_name || 'A student'} matches your hiring needs`,
                html: `
                  <h2>New Talent Match on SyllabusStack</h2>
                  <p>A student from <strong>${studentProfile.university || 'a partner university'}</strong> has skills that match your open positions.</p>
                  <ul>
                    <li><strong>Match Score:</strong> ${Math.round(match.match_score * 100)}%</li>
                    <li><strong>Matched Skills:</strong> ${(match.skill_overlap?.matched || []).join(', ')}</li>
                    <li><strong>Position:</strong> ${match.job_title}</li>
                  </ul>
                  <p>Log in to SyllabusStack to review this candidate's verified portfolio.</p>
                `,
              }),
            });
            if (!resp.ok) throw new Error(`Resend HTTP ${resp.status}`);
            return resp.json();
          }, { maxRetries: 2, baseDelayMs: 500, operationName: 'Resend talent alert' });

          talentAlertsSent++;

          // Update job match status
          await supabase
            .from('job_matches')
            .update({ status: 'matched' })
            .eq('student_id', targetStudentId)
            .eq('company_profile_id', match.company_profile_id)
            .eq('status', 'active');

        } catch (err) {
          console.warn(`Failed to send talent alert to ${profile.contact_email}:`, err);
        }
      }
    }
  }

  return createSuccessResponse({
    matches: topMatches,
    total_candidates: candidates.length,
    total_matches: matches.length,
    returned: topMatches.length,
    student_skills: allStudentSkills.length,
    apollo_jobs_enriched: apolloJobsEnriched,
    talent_alerts_sent: talentAlertsSent,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
