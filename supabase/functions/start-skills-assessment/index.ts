import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StartAssessmentRequest {
  session_type: 'standard' | 'quick';
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
    const body: StartAssessmentRequest = await req.json();
    const { session_type = 'standard' } = body;

    console.log(`Starting skills assessment for user: ${userId}, type: ${session_type}`);

    // Check for existing in-progress session
    const { data: existingSession } = await supabase
      .from('skills_assessment_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingSession) {
      console.log(`Resuming existing session: ${existingSession.id}`);
      
      // Get answered question IDs
      const { data: responses } = await supabase
        .from('skills_assessment_responses')
        .select('question_id')
        .eq('session_id', existingSession.id);

      const answeredIds = new Set(responses?.map(r => r.question_id) || []);

      // Get remaining questions
      const isQuick = existingSession.session_type === 'quick';
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

      // Return first batch of remaining questions
      const batchSize = 10;
      const firstBatch = remainingQuestions.slice(0, batchSize);

      return new Response(JSON.stringify({
        success: true,
        session_id: existingSession.id,
        session_type: existingSession.session_type,
        total_questions: (allQuestions || []).length,
        questions_answered: answeredIds.size,
        first_batch: firstBatch,
        is_resumed: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch questions based on session type
    const isQuick = session_type === 'quick';
    let query = supabase
      .from('assessment_item_bank')
      .select('*')
      .order('framework')
      .order('sequence_order');

    if (isQuick) {
      query = query.eq('is_quick_assessment', true);
    }

    const { data: questions, error: questionsError } = await query;

    if (questionsError || !questions || questions.length === 0) {
      console.error('Error fetching questions:', questionsError);
      return new Response(JSON.stringify({
        error: 'No assessment questions available',
        details: questionsError?.message,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from('skills_assessment_sessions')
      .insert({
        user_id: userId,
        session_type,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        total_questions: questions.length,
        questions_answered: 0,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      throw sessionError;
    }

    console.log(`Created session ${session.id} with ${questions.length} questions`);

    // Return first batch
    const batchSize = 10;
    const firstBatch = questions.slice(0, batchSize);

    return new Response(JSON.stringify({
      success: true,
      session_id: session.id,
      session_type,
      total_questions: questions.length,
      questions_answered: 0,
      first_batch: firstBatch,
      is_resumed: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in start-skills-assessment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start assessment';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
