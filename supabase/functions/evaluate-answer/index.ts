import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvaluateAnswerRequest {
  session_id: string;
  question_id: string;
  user_answer: string;
  question_served_at: string;
  answer_submitted_at: string;
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

    const body: EvaluateAnswerRequest = await req.json();
    const {
      session_id,
      question_id,
      user_answer,
      question_served_at,
      answer_submitted_at,
    } = body;

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

    // Calculate time taken
    const servedAt = new Date(question_served_at).getTime();
    const submittedAt = new Date(answer_submitted_at).getTime();
    const timeTakenSeconds = Math.round((submittedAt - servedAt) / 1000);

    let isCorrect = false;
    let evaluationMethod = 'exact_match';
    let evaluationDetails: any = {};

    // Evaluation logic based on question type
    if (question.question_type === 'mcq') {
      // For MCQ, exact match with correct answer
      isCorrect = user_answer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
      evaluationMethod = 'exact_match';
      evaluationDetails = {
        user_answer: user_answer,
        correct_answer: question.correct_answer,
      };
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
          (keyword: string) => userWords.includes(keyword.toLowerCase())
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

      // Fallback to AI evaluation for complex answers
      if (!isCorrect && user_answer.length > 10) {
        try {
          const aiPrompt = `Evaluate if this student answer is correct.

Question: ${question.question_text}
Correct Answer: ${question.correct_answer}
Student Answer: ${user_answer}

Consider:
1. The core concept must be present
2. Minor spelling errors are acceptable
3. Different wording that conveys the same meaning is acceptable

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
              temperature: 0.3,
            }),
          });

          if (response.ok) {
            const aiData = await response.json();
            const aiText = aiData.choices[0]?.message?.content;
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
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
          // Fall back to simple comparison
        }
      }
    } else if (question.question_type === 'true_false') {
      const normalizedAnswer = user_answer.toLowerCase().trim();
      const normalizedCorrect = question.correct_answer.toLowerCase().trim();
      isCorrect = normalizedAnswer === normalizedCorrect;
      evaluationMethod = 'exact_match';
    }

    // Save the answer
    const { data: savedAnswer, error: saveError } = await supabase
      .from('assessment_answers')
      .insert({
        session_id,
        question_id,
        user_answer,
        is_correct: isCorrect,
        time_taken_seconds: timeTakenSeconds,
        question_served_at,
        answer_submitted_at,
        server_received_at: new Date().toISOString(),
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
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('questions_answered, questions_correct')
      .eq('id', session_id)
      .single();

    if (session) {
      await supabase
        .from('assessment_sessions')
        .update({
          questions_answered: (session.questions_answered || 0) + 1,
          questions_correct: (session.questions_correct || 0) + (isCorrect ? 1 : 0),
        })
        .eq('id', session_id);
    }

    return new Response(JSON.stringify({
      success: true,
      is_correct: isCorrect,
      evaluation_method: evaluationMethod,
      time_taken_seconds: timeTakenSeconds,
      correct_answer: isCorrect ? null : question.correct_answer, // Only reveal if wrong
      answer_id: savedAnswer?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in evaluate-answer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to evaluate answer';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});