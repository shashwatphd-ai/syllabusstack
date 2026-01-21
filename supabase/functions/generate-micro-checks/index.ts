import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MicroCheckRequest {
  content_id: string;
  learning_objective_id: string;
  content_title: string;
  content_description?: string;
  duration_seconds: number;
  learning_objective_text: string;
  num_checks?: number;
}

interface GeneratedMicroCheck {
  trigger_time_seconds: number;
  question_text: string;
  question_type: 'recall' | 'mcq';
  correct_answer: string;
  options?: { text: string; is_correct: boolean }[];
  rewind_target_seconds: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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

    const body: MicroCheckRequest = await req.json();
    const {
      content_id,
      learning_objective_id,
      content_title,
      content_description,
      duration_seconds,
      learning_objective_text,
      num_checks = 3,
    } = body;

    // Calculate check intervals (evenly distributed)
    const checkInterval = Math.floor(duration_seconds / (num_checks + 1));
    const checkTimes = Array.from({ length: num_checks }, (_, i) => 
      checkInterval * (i + 1)
    );

    const systemPrompt = 'You are an educational assessment expert. Generate micro-check questions in valid JSON format only.';

    const userPrompt = `You are an educational assessment expert. Generate ${num_checks} micro-check questions for a video about "${content_title}".

Learning Objective: ${learning_objective_text}

Video Description: ${content_description || 'No description available'}
Video Duration: ${Math.floor(duration_seconds / 60)} minutes ${duration_seconds % 60} seconds

Generate questions that will appear at these timestamps (in seconds): ${checkTimes.join(', ')}

For each micro-check, provide:
1. A question that tests comprehension of content up to that point
2. Either a "recall" question (short answer, 1-3 words) or "mcq" (multiple choice with 4 options)
3. The correct answer
4. For MCQ, provide 4 options with one correct answer
5. A rewind target (where to send the student if they answer incorrectly, typically 20-30 seconds before the question)

Mix question types - use recall for simple facts and MCQ for conceptual understanding.

Return a JSON array with exactly ${num_checks} objects in this format:
[
  {
    "trigger_time_seconds": <number>,
    "question_text": "<question>",
    "question_type": "recall" | "mcq",
    "correct_answer": "<answer>",
    "options": [{"text": "<option>", "is_correct": true/false}, ...] // only for mcq
    "rewind_target_seconds": <number>
  }
]

Return ONLY the JSON array, no other text.`;

    // Use unified AI client for text generation
    const result = await generateText({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      model: MODELS.FAST,
      temperature: 0.7,
      fallbacks: [MODELS.GEMINI_FLASH],
      logPrefix: '[generate-micro-checks]'
    });
    const content = result.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let microChecks: GeneratedMicroCheck[];
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      microChecks = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse micro-checks from AI response');
    }

    // Validate and fix micro-checks before storing
    const validatedChecks = microChecks.map(check => {
      // For MCQ, extract correct answer from options if missing
      let correctAnswer = check.correct_answer;
      if (!correctAnswer && check.options && check.question_type === 'mcq') {
        const correctOption = check.options.find(opt => opt.is_correct);
        correctAnswer = correctOption?.text || 'See options';
      }
      // For recall, provide default if missing
      if (!correctAnswer) {
        correctAnswer = 'Answer not specified';
      }
      
      return {
        content_id,
        trigger_time_seconds: check.trigger_time_seconds || 60,
        question_text: check.question_text || 'Check your understanding',
        question_type: check.question_type || 'recall',
        correct_answer: correctAnswer,
        options: check.options || null,
        rewind_target_seconds: check.rewind_target_seconds || Math.max(0, (check.trigger_time_seconds || 60) - 30),
        created_by: user.id,
      };
    });
    
    const insertData = validatedChecks;

    const { data: savedChecks, error: insertError } = await supabase
      .from('micro_checks')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('Error saving micro-checks:', insertError);
      throw insertError;
    }

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      function_name: 'generate-micro-checks',
      model_used: 'openrouter/gpt-4o-mini',
    });

    return new Response(JSON.stringify({ 
      success: true,
      micro_checks: savedChecks,
      count: savedChecks?.length || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in generate-micro-checks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate micro-checks';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
