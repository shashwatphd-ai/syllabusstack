import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StartAssessmentRequest {
  learning_objective_id: string;
  num_questions?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Authenticate user with their auth token (not service role)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Create client with user's auth context for proper RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Validate token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getClaims(token);

    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userId = data.claims.sub as string;
    const user = { id: userId };

    const body: StartAssessmentRequest = await req.json();
    const { learning_objective_id, num_questions = 5 } = body;

    console.log(`Starting assessment for LO: ${learning_objective_id}, user: ${user.id}`);

    // Check for existing in-progress session
    const { data: existingSession } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('learning_objective_id', learning_objective_id)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingSession) {
      // Return existing session
      const { data: questions } = await supabase
        .from('assessment_questions')
        .select('*')
        .in('id', existingSession.question_ids)
        .order('created_at', { ascending: true });

      return new Response(JSON.stringify({
        success: true,
        session: existingSession,
        questions: questions || [],
        is_resumed: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch available questions for this learning objective
    const { data: allQuestions, error: questionsError } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('learning_objective_id', learning_objective_id)
      .order('created_at', { ascending: true });

    if (questionsError || !allQuestions || allQuestions.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No assessment questions available for this learning objective',
        details: questionsError?.message,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Question selection strategy:
    // 1. Mix difficulty levels (easy, medium, hard)
    // 2. Prioritize unseen questions
    // 3. Randomize to prevent memorization
    
    // Get previously answered questions by this user
    const { data: previousSessions } = await supabase
      .from('assessment_sessions')
      .select('question_ids')
      .eq('learning_objective_id', learning_objective_id)
      .eq('user_id', user.id);

    const previouslyAnswered = new Set<string>();
    previousSessions?.forEach(s => {
      s.question_ids?.forEach((qid: string) => previouslyAnswered.add(qid));
    });

    // Categorize questions by difficulty
    const easyQuestions = allQuestions.filter(q => q.difficulty === 'easy' && !previouslyAnswered.has(q.id));
    const mediumQuestions = allQuestions.filter(q => q.difficulty === 'medium' && !previouslyAnswered.has(q.id));
    const hardQuestions = allQuestions.filter(q => q.difficulty === 'hard' && !previouslyAnswered.has(q.id));
    const unseenQuestions = allQuestions.filter(q => !previouslyAnswered.has(q.id));

    // Shuffle helper
    const shuffle = <T>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5);

    let selectedQuestions: typeof allQuestions = [];

    // Target distribution: 20% easy, 50% medium, 30% hard
    const numEasy = Math.max(1, Math.floor(num_questions * 0.2));
    const numMedium = Math.max(1, Math.floor(num_questions * 0.5));
    const numHard = num_questions - numEasy - numMedium;

    selectedQuestions.push(...shuffle(easyQuestions).slice(0, numEasy));
    selectedQuestions.push(...shuffle(mediumQuestions).slice(0, numMedium));
    selectedQuestions.push(...shuffle(hardQuestions).slice(0, numHard));

    // Fill remaining with any unseen questions
    if (selectedQuestions.length < num_questions) {
      const remaining = unseenQuestions.filter(q => !selectedQuestions.includes(q));
      selectedQuestions.push(...shuffle(remaining).slice(0, num_questions - selectedQuestions.length));
    }

    // If still not enough, use previously seen questions
    if (selectedQuestions.length < num_questions) {
      const seenQuestions = allQuestions.filter(q => !selectedQuestions.includes(q));
      selectedQuestions.push(...shuffle(seenQuestions).slice(0, num_questions - selectedQuestions.length));
    }

    // Final shuffle to randomize order
    selectedQuestions = shuffle(selectedQuestions);
    const questionIds = selectedQuestions.map(q => q.id);

    // Get attempt number
    const { count: attemptCount } = await supabase
      .from('assessment_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('learning_objective_id', learning_objective_id)
      .eq('user_id', user.id);

    // Calculate session timeout (5 minutes per question)
    const timeoutMinutes = selectedQuestions.length * 5;
    const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

    // Create the session with server timestamp
    const { data: session, error: sessionError } = await supabase
      .from('assessment_sessions')
      .insert({
        user_id: user.id,
        learning_objective_id,
        question_ids: questionIds,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        timeout_at: timeoutAt,
        current_question_index: 0,
        questions_answered: 0,
        questions_correct: 0,
        attempt_number: (attemptCount || 0) + 1,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      throw sessionError;
    }

    console.log(`Created session ${session.id} with ${questionIds.length} questions`);

    return new Response(JSON.stringify({
      success: true,
      session,
      questions: selectedQuestions,
      is_resumed: false,
      timeout_minutes: timeoutMinutes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in start-assessment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start assessment';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
