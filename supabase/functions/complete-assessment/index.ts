import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteAssessmentRequest {
  session_id: string;
}

// Verification threshold - 70% to pass
const PASSING_THRESHOLD = 70;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Server-side timestamp
    const completedAt = new Date().toISOString();

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: CompleteAssessmentRequest = await req.json();
    const { session_id } = body;

    console.log(`Completing assessment session: ${session_id}`);

    // Fetch session with validation
    const { data: session, error: sessionError } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate session can be completed
    if (session.status === 'completed') {
      // Return existing results
      const { data: answers } = await supabase
        .from('assessment_answers')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      return new Response(JSON.stringify({
        success: true,
        already_completed: true,
        session,
        answers: answers || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all answers for this session
    const { data: answers, error: answersError } = await supabase
      .from('assessment_answers')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (answersError) {
      console.error('Error fetching answers:', answersError);
      throw answersError;
    }

    // Calculate final score
    const questionsAnswered = answers?.length || 0;
    const questionsCorrect = answers?.filter(a => a.is_correct).length || 0;
    const totalScore = questionsAnswered > 0 
      ? (questionsCorrect / questionsAnswered) * 100 
      : 0;

    const passed = totalScore >= PASSING_THRESHOLD;

    // Calculate detailed metrics
    const totalTimeSeconds = answers?.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) || 0;
    const avgTimePerQuestion = questionsAnswered > 0 ? totalTimeSeconds / questionsAnswered : 0;

    // Check for timing anomalies
    const timingFlags = answers?.filter(a => 
      a.evaluation_details?.timing_flags?.length > 0
    ).length || 0;

    // Update session with final results
    const { data: updatedSession, error: updateError } = await supabase
      .from('assessment_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        questions_answered: questionsAnswered,
        questions_correct: questionsCorrect,
        total_score: totalScore,
        passed,
      })
      .eq('id', session_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating session:', updateError);
      throw updateError;
    }

    // Update learning objective verification state if passed
    if (passed) {
      const { error: loError } = await supabase
        .from('learning_objectives')
        .update({ 
          verification_state: 'verified',
          updated_at: completedAt,
        })
        .eq('id', session.learning_objective_id)
        .eq('user_id', user.id);

      if (loError) {
        console.error('Error updating learning objective:', loError);
        // Don't fail the request, just log
      } else {
        console.log(`Updated LO ${session.learning_objective_id} to verified`);
      }
    }

    // Generate performance summary
    const performanceSummary = {
      total_questions: session.question_ids.length,
      questions_answered: questionsAnswered,
      questions_correct: questionsCorrect,
      questions_incorrect: questionsAnswered - questionsCorrect,
      questions_skipped: session.question_ids.length - questionsAnswered,
      total_score: Math.round(totalScore * 10) / 10,
      passed,
      passing_threshold: PASSING_THRESHOLD,
      total_time_seconds: totalTimeSeconds,
      avg_time_per_question: Math.round(avgTimePerQuestion * 10) / 10,
      timing_anomalies: timingFlags,
      attempt_number: session.attempt_number,
    };

    // Categorize answers by correctness for review
    const correctAnswers = answers?.filter(a => a.is_correct) || [];
    const incorrectAnswers = answers?.filter(a => !a.is_correct) || [];

    console.log(`Assessment completed. Score: ${totalScore.toFixed(1)}%, Passed: ${passed}`);

    return new Response(JSON.stringify({
      success: true,
      session: updatedSession,
      performance: performanceSummary,
      correct_answers: correctAnswers.map(a => a.question_id),
      incorrect_answers: incorrectAnswers.map(a => ({
        question_id: a.question_id,
        user_answer: a.user_answer,
        evaluation_details: a.evaluation_details,
      })),
      learning_objective_verified: passed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in complete-assessment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete assessment';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
