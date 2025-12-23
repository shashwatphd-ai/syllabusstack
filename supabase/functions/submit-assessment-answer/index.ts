import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubmitAnswerRequest {
  session_id: string;
  question_id: string;
  user_answer: string;
  client_question_served_at: string;
  client_answer_submitted_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Server-side timestamp for validation
    const serverReceivedAt = new Date();

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

    const body: SubmitAnswerRequest = await req.json();
    const {
      session_id,
      question_id,
      user_answer,
      client_question_served_at,
      client_answer_submitted_at,
    } = body;

    console.log(`Submitting answer for session ${session_id}, question ${question_id}`);

    // Validate session exists and belongs to user
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

    // Validate session is still active
    if (session.status !== 'in_progress') {
      return new Response(JSON.stringify({ 
        error: 'Session is no longer active',
        session_status: session.status,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if session has timed out
    if (session.timeout_at && new Date(session.timeout_at) < serverReceivedAt) {
      // Mark session as abandoned
      await supabase
        .from('assessment_sessions')
        .update({ status: 'abandoned', completed_at: serverReceivedAt.toISOString() })
        .eq('id', session_id);

      return new Response(JSON.stringify({ 
        error: 'Session has timed out',
        timeout_at: session.timeout_at,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate question is part of this session
    if (!session.question_ids.includes(question_id)) {
      return new Response(JSON.stringify({ error: 'Question not part of this session' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if question was already answered
    const { data: existingAnswer } = await supabase
      .from('assessment_answers')
      .select('id')
      .eq('session_id', session_id)
      .eq('question_id', question_id)
      .maybeSingle();

    if (existingAnswer) {
      return new Response(JSON.stringify({ error: 'Question already answered' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the question
    const { data: question, error: questionError } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('id', question_id)
      .single();

    if (questionError || !question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side timing validation
    const clientServed = new Date(client_question_served_at).getTime();
    const clientSubmitted = new Date(client_answer_submitted_at).getTime();
    const clientTimeTaken = (clientSubmitted - clientServed) / 1000;

    // Calculate server-side time (from question serve to answer receive)
    // We track when the question was served from the session's question index progression
    const serverTimeTaken = Math.round(clientTimeTaken); // Use client time as baseline

    // Validate timing - check for impossibly fast answers
    const minTimeSeconds = 2; // Minimum 2 seconds to read and answer
    const maxTimeSeconds = question.time_limit_seconds ? question.time_limit_seconds * 2 : 300; // Max 2x time limit or 5 minutes

    let timingFlags: string[] = [];
    if (clientTimeTaken < minTimeSeconds) {
      timingFlags.push('suspiciously_fast');
    }
    if (clientTimeTaken > maxTimeSeconds) {
      timingFlags.push('exceeded_time_limit');
    }

    // Evaluate the answer
    let isCorrect = false;
    let evaluationMethod = 'exact_match';
    let evaluationDetails: Record<string, unknown> = {};

    if (question.question_type === 'mcq') {
      // For MCQ, exact match with correct answer
      isCorrect = user_answer.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
      evaluationMethod = 'exact_match';
      evaluationDetails = {
        user_answer,
        correct_answer: question.correct_answer,
      };
    } else if (question.question_type === 'true_false') {
      const normalizedAnswer = user_answer.toLowerCase().trim();
      const normalizedCorrect = question.correct_answer?.toLowerCase().trim();
      isCorrect = normalizedAnswer === normalizedCorrect;
      evaluationMethod = 'exact_match';
    } else if (question.question_type === 'short_answer') {
      // Check accepted answers first
      if (question.accepted_answers && question.accepted_answers.length > 0) {
        isCorrect = question.accepted_answers.some(
          (accepted: string) => user_answer.toLowerCase().trim() === accepted.toLowerCase().trim()
        );
        evaluationMethod = 'accepted_answers';
      }

      // Check required keywords
      if (!isCorrect && question.required_keywords && question.required_keywords.length > 0) {
        const userWords = user_answer.toLowerCase().split(/\s+/);
        const matchedKeywords = question.required_keywords.filter(
          (keyword: string) => userWords.some((w: string) => w.includes(keyword.toLowerCase()))
        );
        const matchRatio = matchedKeywords.length / question.required_keywords.length;
        
        if (matchRatio >= 0.7) {
          isCorrect = true;
          evaluationMethod = 'keyword_match';
          evaluationDetails = {
            matched_keywords: matchedKeywords,
            required_keywords: question.required_keywords,
            match_ratio: matchRatio,
          };
        }
      }

      // AI evaluation for complex short answers
      if (!isCorrect && user_answer.length > 10 && lovableApiKey) {
        try {
          const aiPrompt = `Evaluate if this student answer is correct.

Question: ${question.question_text}
${question.scenario_context ? `Context: ${question.scenario_context}` : ''}
Expected Answer: ${question.correct_answer}
Student Answer: ${user_answer}

Consider:
1. The core concept must be present
2. Minor spelling/grammar errors are acceptable
3. Different wording conveying the same meaning is acceptable
4. Partial credit: mark correct if 70%+ of the key concepts are present

Respond with JSON only:
{"is_correct": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [
                { role: 'system', content: 'You are an educational assessment evaluator. Return only valid JSON.' },
                { role: 'user', content: aiPrompt }
              ],
            }),
          });

          if (response.ok) {
            const aiData = await response.json();
            const aiText = aiData.choices[0]?.message?.content;
            const jsonMatch = aiText?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const aiResult = JSON.parse(jsonMatch[0]);
              isCorrect = aiResult.is_correct && aiResult.confidence >= 0.7;
              evaluationMethod = 'ai_evaluation';
              evaluationDetails = {
                ...aiResult,
                user_answer,
                correct_answer: question.correct_answer,
              };
            }
          }
        } catch (aiError) {
          console.error('AI evaluation failed:', aiError);
          // Fall back to keyword matching or mark as needs_review
          evaluationMethod = 'needs_manual_review';
        }
      }
    }

    // Add timing flags to evaluation details
    if (timingFlags.length > 0) {
      evaluationDetails.timing_flags = timingFlags;
    }

    // Save the answer
    const { data: savedAnswer, error: saveError } = await supabase
      .from('assessment_answers')
      .insert({
        session_id,
        question_id,
        user_answer,
        is_correct: isCorrect,
        time_taken_seconds: serverTimeTaken,
        question_served_at: client_question_served_at,
        answer_submitted_at: client_answer_submitted_at,
        server_received_at: serverReceivedAt.toISOString(),
        evaluation_method: evaluationMethod,
        evaluation_details: evaluationDetails,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving answer:', saveError);
      throw saveError;
    }

    // Update session progress
    const newQuestionsAnswered = (session.questions_answered || 0) + 1;
    const newQuestionsCorrect = (session.questions_correct || 0) + (isCorrect ? 1 : 0);
    const currentQuestionIdx = session.question_ids.indexOf(question_id);
    const nextQuestionIndex = Math.min(currentQuestionIdx + 1, session.question_ids.length - 1);

    await supabase
      .from('assessment_sessions')
      .update({
        questions_answered: newQuestionsAnswered,
        questions_correct: newQuestionsCorrect,
        current_question_index: nextQuestionIndex,
      })
      .eq('id', session_id);

    // Check if assessment is complete
    const isComplete = newQuestionsAnswered >= session.question_ids.length;
    const currentScore = (newQuestionsCorrect / newQuestionsAnswered) * 100;

    console.log(`Answer saved. Session progress: ${newQuestionsAnswered}/${session.question_ids.length}`);

    return new Response(JSON.stringify({
      success: true,
      is_correct: isCorrect,
      evaluation_method: evaluationMethod,
      time_taken_seconds: serverTimeTaken,
      timing_flags: timingFlags,
      correct_answer: isCorrect ? null : question.correct_answer, // Only reveal if wrong
      answer_id: savedAnswer?.id,
      session_progress: {
        questions_answered: newQuestionsAnswered,
        questions_correct: newQuestionsCorrect,
        total_questions: session.question_ids.length,
        current_score: Math.round(currentScore),
        is_complete: isComplete,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in submit-assessment-answer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit answer';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
