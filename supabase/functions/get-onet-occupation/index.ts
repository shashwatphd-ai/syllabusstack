import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

interface GetOccupationRequest {
  soc_code: string;
  force_refresh?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // This can be called without auth for public occupation data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: GetOccupationRequest = await req.json();
    const { soc_code, force_refresh = false } = body;

    if (!soc_code) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'SOC code is required');
    }

    logInfo('get-onet-occupation', 'fetching', { socCode: soc_code, forceRefresh: force_refresh });

    // Check cache first (unless force refresh)
    if (!force_refresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('onet_occupations')
        .select('*')
        .eq('soc_code', soc_code)
        .maybeSingle();

      if (!cacheError && cached) {
        // Check if data is recent (within 30 days)
        const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        if (cacheAge < thirtyDays) {
          logInfo('get-onet-occupation', 'cache_hit', { socCode: soc_code });
          return createSuccessResponse({
            success: true,
            occupation: cached,
            source: 'cache',
          }, corsHeaders);
        }
      }
    }

    // Check if O*NET API credentials are available
    const onetUsername = Deno.env.get('ONET_USERNAME');
    const onetPassword = Deno.env.get('ONET_PASSWORD');

    if (!onetUsername || !onetPassword) {
      // Return cached data if available, or error
      const { data: fallback } = await supabase
        .from('onet_occupations')
        .select('*')
        .eq('soc_code', soc_code)
        .maybeSingle();

      if (fallback) {
        logInfo('get-onet-occupation', 'cache_fallback', { socCode: soc_code });
        return createSuccessResponse({
          success: true,
          occupation: fallback,
          source: 'cache_fallback',
          note: 'O*NET API credentials not configured',
        }, corsHeaders);
      }

      return createErrorResponse('NOT_FOUND', corsHeaders, 'Occupation not found and O*NET API credentials not configured');
    }

    // Fetch from O*NET Web Services API
    logInfo('get-onet-occupation', 'fetching_from_api', { socCode: soc_code });
    
    const onetBaseUrl = 'https://services.onetcenter.org/ws';
    const authHeader = 'Basic ' + btoa(`${onetUsername}:${onetPassword}`);

    // Fetch occupation summary
    const summaryResponse = await fetch(`${onetBaseUrl}/online/occupations/${soc_code}`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!summaryResponse.ok) {
      logError('get-onet-occupation', new Error(`O*NET API error: ${summaryResponse.status}`));

      // Return cached if available
      const { data: fallback } = await supabase
        .from('onet_occupations')
        .select('*')
        .eq('soc_code', soc_code)
        .maybeSingle();

      if (fallback) {
        return createSuccessResponse({
          success: true,
          occupation: fallback,
          source: 'cache_api_error',
        }, corsHeaders);
      }

      return createErrorResponse('NOT_FOUND', corsHeaders, 'Occupation not found in O*NET');
    }

    const summaryData = await summaryResponse.json();

    // Fetch skills
    const skillsResponse = await fetch(`${onetBaseUrl}/online/occupations/${soc_code}/summary/skills`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });
    const skillsData = skillsResponse.ok ? await skillsResponse.json() : { element: [] };

    // Parse skills into structured format
    const skills: Record<string, { level: number; importance: string }> = {};
    for (const skill of skillsData.element || []) {
      const importance = skill.score?.value >= 70 ? 'essential' : 
                        skill.score?.value >= 50 ? 'important' : 'helpful';
      skills[skill.name] = {
        level: skill.score?.value || 50,
        importance,
      };
    }

    // Fetch interests (RIASEC)
    const interestsResponse = await fetch(`${onetBaseUrl}/online/occupations/${soc_code}/summary/interests`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });
    const interestsData = interestsResponse.ok ? await interestsResponse.json() : {};
    
    // Extract RIASEC code from interests
    const riasecCode = interestsData.high_point_code || 
                       (summaryData.code?.substring(0, 3)) || 
                       'UNK';

    // Build occupation record
    const occupationRecord = {
      soc_code,
      title: summaryData.title || soc_code,
      description: summaryData.description || '',
      riasec_code: riasecCode.toUpperCase(),
      riasec_scores: {
        realistic: 0,
        investigative: 0,
        artistic: 0,
        social: 0,
        enterprising: 0,
        conventional: 0,
      },
      skills,
      knowledge: {},
      abilities: {},
      work_values: {},
      median_wage: null, // Would need BLS data
      job_outlook: null,
      education_level: summaryData.education?.category || 'varies',
      bright_outlook: summaryData.tags?.bright_outlook || false,
      updated_at: new Date().toISOString(),
    };

    // Upsert to cache
    const { data: upserted, error: upsertError } = await supabase
      .from('onet_occupations')
      .upsert(occupationRecord, { onConflict: 'soc_code' })
      .select()
      .single();

    if (upsertError) {
      logError('get-onet-occupation', new Error(`Error caching occupation: ${upsertError.message}`));
    }

    logInfo('get-onet-occupation', 'complete', { socCode: soc_code, source: 'onet_api' });

    return createSuccessResponse({
      success: true,
      occupation: upserted || occupationRecord,
      source: 'onet_api',
    }, corsHeaders);

  } catch (error: unknown) {
    logError('get-onet-occupation', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Failed to get occupation');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
