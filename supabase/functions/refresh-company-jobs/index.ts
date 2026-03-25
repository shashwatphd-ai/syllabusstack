import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { calculateCompanySignals, toStorableSignalData } from '../_shared/capstone/signals/index.ts';
import type { CompanyForSignal } from '../_shared/capstone/signal-types.ts';

/**
 * REFRESH-COMPANY-JOBS Edge Function
 *
 * Re-fetches job postings from Apollo for existing companies.
 * Use this to update companies that were discovered before the ID fix.
 *
 * Usage:
 * - POST with { "companyId": "uuid" } - Refresh single company
 * - POST with { "generationRunId": "uuid" } - Refresh all companies in a generation run
 * - POST with { "refreshAll": true, "limit": 50 } - Refresh oldest N companies without jobs
 * - POST with { "recalculateSignals": true } - Also recalculate signal scores after refresh
 * - POST with { "courseId": "uuid" } - Required for signal recalculation (to get syllabus skills)
 */

interface RefreshResult {
  companyId: string;
  companyName: string;
  apolloOrgId: string | null;
  previousJobCount: number;
  newJobCount: number;
  status: 'success' | 'no_apollo_id' | 'no_jobs_found' | 'api_error';
  signalsRecalculated?: boolean;
  newSkillMatchScore?: number | null;
  error?: string;
}

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!APOLLO_API_KEY) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { companyId, generationRunId, refreshAll, limit = 50, recalculateSignals = false, courseId } = body;

    console.log('🔄 Starting job postings refresh...');
    console.log(`   Mode: ${companyId ? 'single' : generationRunId ? 'generation_run' : refreshAll ? 'refresh_all' : 'unknown'}`);
    console.log(`   Recalculate signals: ${recalculateSignals}`);

    // Get course skills if we need to recalculate signals
    let syllabusSkills: string[] = [];
    let syllabusDomain = 'general';

    if (recalculateSignals) {
      if (!courseId) {
        throw new Error('courseId is required when recalculateSignals=true');
      }

      const { data: course, error: courseError } = await supabase
        .from('course_profiles')
        .select('skills, outcomes, title')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        throw new Error(`Failed to fetch course: ${courseError?.message || 'not found'}`);
      }

      // Extract skills from course
      syllabusSkills = [
        ...(Array.isArray(course.skills) ? course.skills : []),
        ...(Array.isArray(course.outcomes) ? course.outcomes : [])
      ].filter((s): s is string => typeof s === 'string');

      syllabusDomain = course.title || 'general';
      console.log(`   Course skills: ${syllabusSkills.length}`);
    }

    // Build query based on input - select all fields needed for signal calculation
    let query = supabase
      .from('company_profiles')
      .select('id, name, apollo_organization_id, job_postings, technologies_used, sector, size, funding_stage, total_funding_usd, contact_email, contact_person, contact_title, organization_employee_count');

    if (companyId) {
      query = query.eq('id', companyId);
    } else if (generationRunId) {
      query = query.eq('generation_run_id', generationRunId);
    } else if (refreshAll) {
      // Get companies with no jobs or null job_postings, prioritize those with apollo_organization_id
      query = query
        .not('apollo_organization_id', 'is', null)
        .or('job_postings.is.null,job_postings.eq.[]')
        .limit(limit);
    } else {
      throw new Error('Provide companyId, generationRunId, or refreshAll=true');
    }

    const { data: companies, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No companies found to refresh',
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`   Found ${companies.length} companies to refresh`);

    const results: RefreshResult[] = [];
    const JOB_ENDPOINTS = [
      { path: '/v1', description: 'Standard' },
      { path: '/api/v1', description: 'API-prefixed' }
    ];

    for (const company of companies) {
      console.log(`\n🏢 Refreshing: ${company.name}`);

      const previousJobCount = Array.isArray(company.job_postings) ? company.job_postings.length : 0;

      // Skip if no Apollo ID
      if (!company.apollo_organization_id) {
        console.log(`   ⚠️ No Apollo organization ID - skipping`);
        results.push({
          companyId: company.id,
          companyName: company.name,
          apolloOrgId: null,
          previousJobCount,
          newJobCount: 0,
          status: 'no_apollo_id'
        });
        continue;
      }

      // Try fetching job postings from Apollo
      let jobPostings: any[] = [];
      let fetchError: string | undefined;
      let jobFetchStatus: 'success' | 'no_jobs' | 'permission_denied' | 'error' = 'no_jobs';

      for (const endpoint of JOB_ENDPOINTS) {
        if (jobPostings.length > 0) break;

        const url = `https://api.apollo.io${endpoint.path}/organizations/${company.apollo_organization_id}/job_postings?page=1&per_page=25`;
        console.log(`   📡 Trying: ${endpoint.description}`);

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Api-Key': APOLLO_API_KEY
            }
          });

          if (!response.ok) {
            console.log(`   ❌ HTTP ${response.status}`);
            if (response.status === 401 || response.status === 402 || response.status === 403) {
              fetchError = `Permission denied (HTTP ${response.status})`;
              jobFetchStatus = 'permission_denied';
              break;
            }
            continue;
          }

          const data = await response.json();

          // Try both field names
          if (data.job_postings && Array.isArray(data.job_postings)) {
            jobPostings = data.job_postings;
            console.log(`   ✅ Found ${jobPostings.length} jobs in 'job_postings'`);
          } else if (data.organization_job_postings && Array.isArray(data.organization_job_postings)) {
            jobPostings = data.organization_job_postings;
            console.log(`   ✅ Found ${jobPostings.length} jobs in 'organization_job_postings'`);
          } else {
            console.log(`   ℹ️ No jobs in response (keys: ${Object.keys(data).join(', ')})`);
          }

          if (jobPostings.length > 0) {
            jobFetchStatus = 'success';
          }
        } catch (e) {
          console.log(`   ❌ Fetch error: ${e instanceof Error ? e.message : String(e)}`);
          fetchError = e instanceof Error ? e.message : String(e);
          jobFetchStatus = 'error';
        }
      }

      // Update database with new job postings (even if empty - to track that we tried)
      const updateData: Record<string, any> = {
        job_postings: jobPostings,
        job_postings_last_fetched: new Date().toISOString(),
        job_postings_status: jobFetchStatus  // Track the fetch status
      };

      // Recalculate signals if requested
      let signalResult: { signalsRecalculated: boolean; newSkillMatchScore?: number | null } = {
        signalsRecalculated: false
      };

      if (recalculateSignals && syllabusSkills.length > 0) {
        try {
          console.log(`   📊 Recalculating signals...`);

          // Build company object for signal calculation
          const companyForSignal: CompanyForSignal = {
            id: company.id,
            name: company.name,
            sector: company.sector || 'Unknown',
            size: company.size || 'Unknown',
            technologies_used: company.technologies_used || [],
            job_postings: jobPostings, // Use freshly fetched job postings
            funding_stage: company.funding_stage,
            total_funding_usd: company.total_funding_usd,
            contact_email: company.contact_email,
            contact_person: company.contact_person,
            contact_title: company.contact_title,
            organization_employee_count: company.organization_employee_count
          };

          const signalScores = await calculateCompanySignals(
            companyForSignal,
            syllabusSkills,
            syllabusDomain,
            APOLLO_API_KEY,
            Deno.env.get('GEMINI_API_KEY')
          );

          const storableData = toStorableSignalData(signalScores);

          // Add signal scores to update
          updateData.skill_match_score = storableData.skill_match_score;
          updateData.market_signal_score = storableData.market_signal_score;
          updateData.department_fit_score = storableData.department_fit_score;
          updateData.contact_quality_score = storableData.contact_quality_score;
          updateData.composite_signal_score = storableData.composite_signal_score;
          updateData.signal_confidence = storableData.signal_confidence;
          updateData.signal_data = storableData.signal_data;

          signalResult = {
            signalsRecalculated: true,
            newSkillMatchScore: storableData.skill_match_score
          };

          console.log(`   ✅ Signals recalculated: Skill Match = ${storableData.skill_match_score}`);
        } catch (signalError) {
          console.log(`   ⚠️ Signal calculation failed: ${signalError instanceof Error ? signalError.message : String(signalError)}`);
        }
      }

      const { error: updateError } = await supabase
        .from('company_profiles')
        .update(updateData)
        .eq('id', company.id);

      if (updateError) {
        console.log(`   ❌ Database update failed: ${updateError.message}`);
        results.push({
          companyId: company.id,
          companyName: company.name,
          apolloOrgId: company.apollo_organization_id,
          previousJobCount,
          newJobCount: jobPostings.length,
          status: 'api_error',
          error: `Database update failed: ${updateError.message}`
        });
        continue;
      }

      results.push({
        companyId: company.id,
        companyName: company.name,
        apolloOrgId: company.apollo_organization_id,
        ...signalResult,
        previousJobCount,
        newJobCount: jobPostings.length,
        status: jobPostings.length > 0 ? 'success' : fetchError ? 'api_error' : 'no_jobs_found',
        error: fetchError
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Summary stats
    const successCount = results.filter(r => r.status === 'success').length;
    const noJobsCount = results.filter(r => r.status === 'no_jobs_found').length;
    const errorCount = results.filter(r => r.status === 'api_error').length;
    const noApolloCount = results.filter(r => r.status === 'no_apollo_id').length;
    const totalNewJobs = results.reduce((sum, r) => sum + r.newJobCount, 0);

    console.log('\n📊 Refresh Complete');
    console.log(`   Success: ${successCount}, No jobs: ${noJobsCount}, Errors: ${errorCount}, No Apollo ID: ${noApolloCount}`);
    console.log(`   Total new jobs fetched: ${totalNewJobs}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          companiesProcessed: results.length,
          successCount,
          noJobsFoundCount: noJobsCount,
          errorCount,
          noApolloIdCount: noApolloCount,
          totalNewJobsFetched: totalNewJobs
        },
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Refresh error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
