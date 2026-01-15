import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetOccupationRequest {
  soc_code: string;
  force_refresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // This can be called without auth for public occupation data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: GetOccupationRequest = await req.json();
    const { soc_code, force_refresh = false } = body;

    if (!soc_code) {
      return new Response(JSON.stringify({ error: 'SOC code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching occupation: ${soc_code}, force_refresh: ${force_refresh}`);

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
          console.log(`Returning cached data for ${soc_code}`);
          return new Response(JSON.stringify({
            success: true,
            occupation: cached,
            source: 'cache',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
        return new Response(JSON.stringify({
          success: true,
          occupation: fallback,
          source: 'cache_fallback',
          note: 'O*NET API credentials not configured',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        error: 'Occupation not found and O*NET API credentials not configured',
        soc_code,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch from O*NET Web Services API
    console.log(`Fetching from O*NET API: ${soc_code}`);
    
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
      console.error(`O*NET API error: ${summaryResponse.status}`);
      
      // Return cached if available
      const { data: fallback } = await supabase
        .from('onet_occupations')
        .select('*')
        .eq('soc_code', soc_code)
        .maybeSingle();

      if (fallback) {
        return new Response(JSON.stringify({
          success: true,
          occupation: fallback,
          source: 'cache_api_error',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        error: 'Occupation not found in O*NET',
        soc_code,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      console.error('Error caching occupation:', upsertError);
    }

    console.log(`Cached occupation ${soc_code} from O*NET API`);

    return new Response(JSON.stringify({
      success: true,
      occupation: upserted || occupationRecord,
      source: 'onet_api',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in get-onet-occupation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get occupation';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
