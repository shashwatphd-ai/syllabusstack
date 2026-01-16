import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteAssessmentRequest {
  session_id: string;
}

interface AssessmentItemInfo {
  framework: string;
  measures_dimension: string;
  is_reverse_scored: boolean | null;
}

interface ResponseWithQuestion {
  response_value: number;
  assessment_item_bank: AssessmentItemInfo | AssessmentItemInfo[] | null;
}

// Holland RIASEC dimensions
const HOLLAND_DIMENSIONS = ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional'];

// O*NET Skills categories
const ONET_SKILL_CATEGORIES = [
  'reading_comprehension', 'active_listening', 'writing', 'speaking', 'mathematics',
  'science', 'critical_thinking', 'active_learning', 'learning_strategies', 'monitoring',
  'social_perceptiveness', 'coordination', 'persuasion', 'negotiation', 'instructing',
  'service_orientation', 'complex_problem_solving', 'operations_analysis', 'technology_design',
  'equipment_selection', 'installation', 'programming', 'operation_monitoring', 'operation_control',
  'equipment_maintenance', 'troubleshooting', 'repairing', 'quality_control_analysis',
  'judgment_decision_making', 'systems_analysis', 'systems_evaluation', 'time_management',
  'management_resources', 'management_personnel', 'management_material'
];

// Work Values clusters (O*NET Work Importance Locator)
const WORK_VALUE_CLUSTERS = [
  'achievement', 'independence', 'recognition', 'relationships', 'support', 'working_conditions'
];

// Background task to trigger career matching after assessment completion
async function triggerCareerMatching(supabaseUrl: string, supabaseKey: string, authHeader: string, userId: string) {
  try {
    console.log(`[Background] Triggering career matching for user: ${userId}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/match-careers`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ limit: 20 }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Background] Career matching failed:`, error);
    } else {
      const result = await response.json();
      console.log(`[Background] Career matching completed. Found ${result.matches?.length || 0} matches.`);
    }
  } catch (error) {
    console.error('[Background] Error triggering career matching:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;
    const body: CompleteAssessmentRequest = await req.json();
    const { session_id } = body;

    console.log(`Completing skills assessment for session: ${session_id}`);

    // Validate session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('skills_assessment_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.status === 'completed') {
      // Return existing skill profile
      const { data: existingProfile } = await supabase
        .from('skill_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        already_completed: true,
        skill_profile: existingProfile,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all responses with question metadata
    const { data: responses, error: responsesError } = await supabase
      .from('skills_assessment_responses')
      .select(`
        response_value,
        assessment_item_bank (
          framework,
          measures_dimension,
          is_reverse_scored
        )
      `)
      .eq('session_id', session_id);

    if (responsesError || !responses || responses.length === 0) {
      return new Response(JSON.stringify({ error: 'No responses found for session' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${responses.length} responses`);

    // Calculate scores by framework
    const hollandScores: Record<string, number[]> = {};
    const skillScores: Record<string, number[]> = {};
    const valueScores: Record<string, number[]> = {};

    // Initialize score arrays
    HOLLAND_DIMENSIONS.forEach(d => hollandScores[d] = []);
    ONET_SKILL_CATEGORIES.forEach(s => skillScores[s] = []);
    WORK_VALUE_CLUSTERS.forEach(v => valueScores[v] = []);

    // Aggregate responses by dimension
    for (const response of responses as ResponseWithQuestion[]) {
      const { response_value, assessment_item_bank } = response;
      if (!assessment_item_bank) continue;

      // Handle array or single object response from join
      const question = Array.isArray(assessment_item_bank) 
        ? assessment_item_bank[0] 
        : assessment_item_bank;
      if (!question) continue;

      const { framework, measures_dimension, is_reverse_scored } = question;
      
      // Handle reverse scoring (for Likert scales, 5-point scale)
      let adjustedValue = response_value;
      if (is_reverse_scored) {
        adjustedValue = 6 - response_value; // Reverse on 5-point scale
      }

      const dimension = measures_dimension.toLowerCase().replace(/\s+/g, '_');

      switch (framework) {
        case 'holland_riasec':
          if (hollandScores[dimension]) {
            hollandScores[dimension].push(adjustedValue);
          }
          break;
        case 'onet_skills':
          if (skillScores[dimension]) {
            skillScores[dimension].push(adjustedValue);
          }
          break;
        case 'work_values':
          if (valueScores[dimension]) {
            valueScores[dimension].push(adjustedValue);
          }
          break;
      }
    }

    // Calculate Holland RIASEC scores (0-100 scale)
    const hollandResults: Record<string, number> = {};
    for (const [dimension, scores] of Object.entries(hollandScores)) {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        // Convert from 1-5 scale to 0-100
        hollandResults[dimension] = Math.round(((avg - 1) / 4) * 100);
      } else {
        hollandResults[dimension] = 0;
      }
    }

    // Generate 3-letter Holland code
    const sortedHolland = Object.entries(hollandResults)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    const hollandCode = sortedHolland
      .map(([dim]) => dim.charAt(0).toUpperCase())
      .join('');

    // Calculate technical skills (0-100 scale)
    const technicalSkills: Record<string, number> = {};
    for (const [skill, scores] of Object.entries(skillScores)) {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        // Convert from 1-5 scale to 0-100
        technicalSkills[skill] = Math.round(((avg - 1) / 4) * 100);
      }
    }

    // Calculate work values (0-100 scale)
    const workValues: Record<string, number> = {};
    for (const [value, scores] of Object.entries(valueScores)) {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        // Convert from 1-5 scale to 0-100
        workValues[value] = Math.round(((avg - 1) / 4) * 100);
      }
    }

    // Identify top interests (Holland dimensions > 60)
    const topInterests = Object.entries(hollandResults)
      .filter(([, score]) => score >= 60)
      .sort(([, a], [, b]) => b - a)
      .map(([dim, score]) => ({ dimension: dim, score }));

    // Identify strong skills (> 70)
    const strongSkills = Object.entries(technicalSkills)
      .filter(([, score]) => score >= 70)
      .sort(([, a], [, b]) => b - a)
      .map(([skill, score]) => ({ skill, score }));

    // Identify development areas (skills < 40)
    const developmentAreas = Object.entries(technicalSkills)
      .filter(([, score]) => score < 40 && score > 0)
      .sort(([, a], [, b]) => a - b)
      .map(([skill, score]) => ({ skill, score }));

    // Calculate overall confidence based on response patterns
    const responseTimeStats = responses.length > 10 ? 'sufficient_data' : 'limited_data';

    // Upsert skill profile
    const { data: skillProfile, error: profileError } = await supabase
      .from('skill_profiles')
      .upsert({
        user_id: userId,
        holland_code: hollandCode,
        holland_scores: hollandResults,
        technical_skills: technicalSkills,
        work_values: workValues,
        top_interests: topInterests,
        strong_skills: strongSkills,
        development_areas: developmentAreas,
        assessment_version: '1.0',
        confidence_level: responseTimeStats,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error upserting skill profile:', profileError);
      throw profileError;
    }

    // Update session status
    await supabase
      .from('skills_assessment_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        skill_profile_id: skillProfile.id,
      })
      .eq('id', session_id);

    console.log(`Completed assessment. Holland code: ${hollandCode}, Profile ID: ${skillProfile.id}`);

    // ASYNC: Trigger career matching in background (per spec section 7.3 step 8)
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(
        triggerCareerMatching(supabaseUrl, supabaseAnonKey, authHeader, userId)
      );
      console.log(`[Background] Career matching task queued for user: ${userId}`);
    } else {
      // Fallback: don't block response, just log
      console.log(`[Info] EdgeRuntime.waitUntil not available - career matching will be triggered by UI`);
    }

    return new Response(JSON.stringify({
      success: true,
      skill_profile: skillProfile,
      career_matching_triggered: true,
      summary: {
        holland_code: hollandCode,
        top_interests: topInterests.slice(0, 3),
        strong_skills_count: strongSkills.length,
        development_areas_count: developmentAreas.length,
        total_questions_answered: responses.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in complete-skills-assessment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete assessment';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
