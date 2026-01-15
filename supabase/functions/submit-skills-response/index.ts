import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubmitResponseRequest {
  session_id: string;
  question_id: string;
  response_value: number;
  response_time_ms?: number;
}

interface AssessmentItem {
  id: string;
  question_text: string;
  question_type: string;
  framework: string;
  measures_dimension: string;
  response_options: Record<string, unknown> | null;
  sequence_order: number | null;
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
    const body: SubmitResponseRequest = await req.json();
    const { session_id, question_id, response_value, response_time_ms } = body;

    console.log(`Submitting response for session: ${session_id}, question: ${question_id}`);

    // Validate session belongs to user and is in progress
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

    if (session.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Session is not in progress' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate question exists
    const { data: question, error: questionError } = await supabase
      .from('assessment_item_bank')
      .select('*')
      .eq('id', question_id)
      .single();

    if (questionError || !question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already answered (upsert to handle duplicates)
    const { data: existingResponse } = await supabase
      .from('skills_assessment_responses')
      .select('id')
      .eq('session_id', session_id)
      .eq('question_id', question_id)
      .maybeSingle();

    if (existingResponse) {
      // Update existing response
      await supabase
        .from('skills_assessment_responses')
        .update({
          response_value,
          response_time_ms,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingResponse.id);
    } else {
      // Insert new response
      const { error: insertError } = await supabase
        .from('skills_assessment_responses')
        .insert({
          session_id,
          question_id,
          response_value,
          response_time_ms,
        });

      if (insertError) {
        console.error('Error inserting response:', insertError);
        throw insertError;
      }
    }

    // Count total responses
    const { count: answeredCount } = await supabase
      .from('skills_assessment_responses')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id);

    // Update session progress
    await supabase
      .from('skills_assessment_sessions')
      .update({
        questions_answered: answeredCount || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    // Check if assessment is complete
    const isComplete = (answeredCount || 0) >= session.total_questions;

    // Get next batch of unanswered questions
    let nextBatch: AssessmentItem[] = [];
    if (!isComplete) {
      // Get all answered question IDs
      const { data: allResponses } = await supabase
        .from('skills_assessment_responses')
        .select('question_id')
        .eq('session_id', session_id);

      const answeredIds = new Set(allResponses?.map(r => r.question_id) || []);

      // Get remaining questions
      const isQuick = session.session_type === 'quick';
      let query = supabase
        .from('assessment_item_bank')
        .select('*')
        .order('framework')
        .order('sequence_order');

      if (isQuick) {
        query = query.eq('is_quick_assessment', true);
      }

      const { data: allQuestions } = await query;
      const remainingQuestions = (allQuestions || []).filter(
        (q: AssessmentItem) => !answeredIds.has(q.id)
      );

      const batchSize = 10;
      nextBatch = remainingQuestions.slice(0, batchSize);
    }

    console.log(`Progress: ${answeredCount}/${session.total_questions}, complete: ${isComplete}`);

    return new Response(JSON.stringify({
      success: true,
      progress: {
        answered: answeredCount || 0,
        total: session.total_questions,
        percentage: Math.round(((answeredCount || 0) / session.total_questions) * 100),
      },
      next_batch: nextBatch,
      is_complete: isComplete,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in submit-skills-response:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit response';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
