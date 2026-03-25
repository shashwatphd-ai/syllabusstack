/**
 * Get Live Demand Edge Function
 *
 * Real-time demand signal lookup for skill/location pairs.
 * Returns cached demand signals from the database, falls back
 * to real-time Lightcast query if data is stale (>24h).
 *
 * Auth: JWT required
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { withErrorHandling, createErrorResponse, createSuccessResponse } from "../_shared/error-handler.ts";
import { validateRequest, demandSignalQuerySchema } from "../_shared/validators/index.ts";
import { getJobPostingAnalytics, isLightcastConfigured } from "../_shared/lightcast-client.ts";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return createErrorResponse('UNAUTHORIZED', corsHeaders);

  // Validate input
  const body = await req.json();
  const validation = validateRequest(demandSignalQuerySchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }

  const { skill_names, skill_ids, location, timeframe } = validation.data;
  const skillFilter = skill_names || [];
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ── Query cached signals ──
  let query = serviceClient
    .from('demand_signals')
    .select('*')
    .order('created_at', { ascending: false });

  if (skillFilter.length > 0) {
    query = query.in('skill_name', skillFilter.map(s => s.toLowerCase()));
  }
  if (skill_ids?.length) {
    query = query.in('skill_id', skill_ids);
  }
  if (location) {
    query = query.eq('location', location);
  }

  const { data: signals, error: queryError } = await query.limit(200);

  if (queryError) {
    return createErrorResponse('DATABASE_ERROR', corsHeaders, queryError.message);
  }

  // ── Check staleness ──
  const now = Date.now();
  const freshSignals = (signals || []).filter(s =>
    now - new Date(s.created_at).getTime() < STALE_THRESHOLD_MS
  );

  // Group by skill for response
  const bySkill: Record<string, any> = {};
  for (const signal of freshSignals) {
    if (!bySkill[signal.skill_name]) {
      bySkill[signal.skill_name] = {
        skill_name: signal.skill_name,
        skill_id: signal.skill_id,
        location: signal.location,
        signals: [],
      };
    }
    bySkill[signal.skill_name].signals.push({
      source: signal.source,
      type: signal.signal_type,
      value: signal.signal_value,
      confidence: signal.confidence,
      period: { start: signal.period_start, end: signal.period_end },
      fetched_at: signal.created_at,
    });
  }

  // ── Real-time fallback for missing skills ──
  const cachedSkills = new Set(Object.keys(bySkill));
  const missingSkills = skillFilter.filter(s => !cachedSkills.has(s.toLowerCase()));

  if (missingSkills.length > 0 && isLightcastConfigured()) {
    try {
      const jpa = await getJobPostingAnalytics({
        skills: missingSkills,
        location: location || 'US',
      });

      for (const skill of missingSkills) {
        bySkill[skill.toLowerCase()] = {
          skill_name: skill.toLowerCase(),
          location: location || 'US',
          signals: [{
            source: 'lightcast',
            type: 'job_posting_volume',
            value: {
              total_postings: jpa.totalPostings,
              unique_postings: jpa.uniquePostings,
              top_employers: jpa.topEmployers,
            },
            confidence: 0.9,
            period: { start: null, end: null },
            fetched_at: new Date().toISOString(),
            live: true,
          }],
        };
      }

      // Cache the live results (fire-and-forget)
      for (const skill of missingSkills) {
        serviceClient
          .from('demand_signals')
          .insert({
            skill_name: skill.toLowerCase(),
            source: 'lightcast',
            signal_type: 'job_posting_volume',
            signal_value: {
              total_postings: jpa.totalPostings,
              unique_postings: jpa.uniquePostings,
            },
            confidence: 0.9,
            location: location || 'US',
          })
          .then(() => {})
          .then(() => {}, (err: any) => console.warn(`Failed to cache signal for ${skill}:`, err));
      }
    } catch (err) {
      console.warn('Live Lightcast fallback failed:', err);
    }
  }

  return createSuccessResponse({
    skills: Object.values(bySkill),
    total_skills: Object.keys(bySkill).length,
    cached_count: freshSignals.length,
    stale_count: (signals?.length || 0) - freshSignals.length,
    live_fetched: missingSkills.length,
  }, corsHeaders);
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
