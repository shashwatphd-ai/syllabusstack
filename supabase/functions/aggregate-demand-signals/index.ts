/**
 * Aggregate Demand Signals Edge Function
 *
 * CRON-triggered batch aggregation from Lightcast + Adzuna + Apollo.
 * Collects market demand data for skills found in active courses and
 * stores aggregated signals in demand_signals / company_signals tables.
 *
 * Triggered by: pg_cron (daily at 2:00 AM UTC) or manual admin call
 * Auth: Service role (no JWT required)
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { extractSkills, getJobPostingAnalytics, getSalaryEstimate, isLightcastConfigured } from "../_shared/lightcast-client.ts";
import { searchJobs as adzunaSearch, getSalaryEstimate as adzunaSalary, isAdzunaConfigured } from "../_shared/adzuna-client.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  console.log('📊 Starting demand signal aggregation...');
  const startTime = Date.now();

  // ── Step 1: Collect unique skills from active courses ──
  const { data: courses } = await supabase
    .from('instructor_courses')
    .select('id, title')
    .eq('status', 'active')
    .limit(50);

  if (!courses?.length) {
    return createSuccessResponse({ message: 'No active courses found', signals_created: 0 }, corsHeaders);
  }

  // Get learning objectives for all active courses
  const courseIds = courses.map(c => c.id);
  const { data: objectives } = await supabase
    .from('learning_objectives')
    .select('text, search_keywords, instructor_course_id')
    .in('instructor_course_id', courseIds);

  // Extract unique skill keywords from objectives
  const skillTexts = new Set<string>();
  for (const lo of (objectives || [])) {
    if (lo.search_keywords) {
      for (const kw of lo.search_keywords) {
        skillTexts.add(kw.toLowerCase().trim());
      }
    }
    // Also add core concepts from the objective text
    if (lo.text) {
      // Simple extraction: take key nouns (words > 3 chars that aren't common verbs)
      const words = lo.text.split(/\s+/).filter((w: string) =>
        w.length > 3 && !['will', 'able', 'demonstrate', 'understand', 'apply', 'analyze', 'evaluate', 'create', 'describe', 'explain', 'identify'].includes(w.toLowerCase())
      );
      for (const w of words.slice(0, 5)) {
        skillTexts.add(w.toLowerCase().replace(/[^a-z0-9\s-]/g, ''));
      }
    }
  }

  const uniqueSkills = [...skillTexts].filter(s => s.length > 2).slice(0, 100);
  console.log(`   Found ${uniqueSkills.length} unique skills from ${courses.length} active courses`);

  // ── Step 2: Get course locations ──
  const { data: courseLocations } = await supabase
    .from('instructor_courses')
    .select('location_city, location_state')
    .in('id', courseIds)
    .not('location_state', 'is', null);

  const locations = [...new Set(
    (courseLocations || [])
      .map(l => l.location_state)
      .filter(Boolean)
  )].slice(0, 10);

  const primaryLocation = locations[0] || 'US';

  // ── Step 3: Aggregate from each source ──
  const signalsToInsert: any[] = [];
  const companySignalsToInsert: any[] = [];
  const errors: string[] = [];

  // 3a: Lightcast signals
  if (isLightcastConfigured()) {
    console.log('   🔍 Querying Lightcast...');
    try {
      // Batch skills in groups of 10 for JPA queries
      for (let i = 0; i < uniqueSkills.length; i += 10) {
        const batch = uniqueSkills.slice(i, i + 10);
        try {
          const jpa = await getJobPostingAnalytics({
            skills: batch,
            location: primaryLocation,
          });

          for (const skill of batch) {
            signalsToInsert.push({
              skill_name: skill,
              source: 'lightcast',
              signal_type: 'job_posting_volume',
              signal_value: {
                total_postings: jpa.totalPostings,
                unique_postings: jpa.uniquePostings,
                top_employers: jpa.topEmployers,
                top_locations: jpa.topLocations,
              },
              confidence: 0.9,
              location: primaryLocation,
              period_start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              period_end: new Date().toISOString().split('T')[0],
            });
          }

          // Salary data
          const salary = await getSalaryEstimate({ skills: batch, location: primaryLocation });
          if (salary) {
            for (const skill of batch) {
              signalsToInsert.push({
                skill_name: skill,
                source: 'lightcast',
                signal_type: 'salary_data',
                signal_value: salary,
                confidence: 0.85,
                location: primaryLocation,
                period_start: new Date().toISOString().split('T')[0],
                period_end: new Date().toISOString().split('T')[0],
              });
            }
          }
        } catch (err) {
          errors.push(`Lightcast batch error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`Lightcast global error: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.log('   ⚠️ Lightcast not configured, skipping');
  }

  // 3b: Adzuna cross-validation
  if (isAdzunaConfigured()) {
    console.log('   🔍 Querying Adzuna...');
    try {
      // Sample top 20 skills for Adzuna (rate-limited)
      const sampleSkills = uniqueSkills.slice(0, 20);
      for (const skill of sampleSkills) {
        try {
          const result = await adzunaSearch({
            what: skill,
            where: primaryLocation,
            resultsPerPage: 5,
          });

          signalsToInsert.push({
            skill_name: skill,
            source: 'adzuna',
            signal_type: 'job_posting_volume',
            signal_value: {
              count: result.count,
              mean_salary: result.meanSalary,
              sample_jobs: result.jobs.slice(0, 3).map(j => ({
                title: j.title,
                company: j.company,
                salary_min: j.salaryMin,
                salary_max: j.salaryMax,
              })),
            },
            confidence: 0.75,
            location: primaryLocation,
            period_start: new Date().toISOString().split('T')[0],
            period_end: new Date().toISOString().split('T')[0],
          });

          // Salary cross-validation
          const salary = await adzunaSalary(skill, primaryLocation);
          if (salary) {
            signalsToInsert.push({
              skill_name: skill,
              source: 'adzuna',
              signal_type: 'salary_data',
              signal_value: salary,
              confidence: 0.7,
              location: primaryLocation,
              period_start: new Date().toISOString().split('T')[0],
              period_end: new Date().toISOString().split('T')[0],
            });
          }
        } catch (err) {
          // Skip individual skill errors
          console.warn(`Adzuna error for "${skill}":`, err);
        }
      }
    } catch (err) {
      errors.push(`Adzuna global error: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.log('   ⚠️ Adzuna not configured, skipping');
  }

  // 3c: Apollo company signals (from existing company_profiles)
  console.log('   🔍 Aggregating Apollo company signals...');
  try {
    const { data: companies } = await supabase
      .from('company_profiles')
      .select('id, name, job_postings, technologies_used, industries, skill_match_score, market_signal_score')
      .not('job_postings', 'is', null)
      .limit(100);

    for (const company of (companies || [])) {
      if (company.job_postings && Array.isArray(company.job_postings)) {
        companySignalsToInsert.push({
          company_profile_id: company.id,
          signal_source: 'apollo',
          signal_type: 'hiring_activity',
          signal_data: {
            active_postings: company.job_postings.length,
            technologies: company.technologies_used || [],
            industries: company.industries || [],
            skill_match: company.skill_match_score,
            market_signal: company.market_signal_score,
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 day TTL
        });
      }
    }
  } catch (err) {
    errors.push(`Apollo aggregation error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Step 4: Bulk insert signals ──
  let signalsCreated = 0;
  let companySignalsCreated = 0;

  if (signalsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('demand_signals')
      .insert(signalsToInsert)
      .select('id');

    if (error) {
      errors.push(`Insert demand_signals error: ${error.message}`);
    } else {
      signalsCreated = data?.length || 0;
    }
  }

  if (companySignalsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('company_signals')
      .insert(companySignalsToInsert)
      .select('id');

    if (error) {
      errors.push(`Insert company_signals error: ${error.message}`);
    } else {
      companySignalsCreated = data?.length || 0;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`✅ Demand signal aggregation complete in ${duration}ms`);
  console.log(`   Signals: ${signalsCreated} demand, ${companySignalsCreated} company`);

  return createSuccessResponse({
    success: true,
    skills_processed: uniqueSkills.length,
    courses_scanned: courses.length,
    signals_created: signalsCreated,
    company_signals_created: companySignalsCreated,
    location: primaryLocation,
    duration_ms: duration,
    errors: errors.length > 0 ? errors : undefined,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
