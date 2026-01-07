import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const prompt = `You are an educational assessment expert. Generate ${num_checks} micro-check questions for a video about "${content_title}".

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

    // Use Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an educational assessment expert. Generate micro-check questions in valid JSON format only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const generatedText = aiData.choices[0]?.message?.content;

    if (!generatedText) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let microChecks: GeneratedMicroCheck[];
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      microChecks = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      throw new Error('Failed to parse micro-checks from AI response');
    }

    // Validate and store micro-checks
    const insertData = microChecks.map(check => ({
      content_id,
      trigger_time_seconds: check.trigger_time_seconds,
      question_text: check.question_text,
      question_type: check.question_type,
      correct_answer: check.correct_answer,
      options: check.options || null,
      rewind_target_seconds: check.rewind_target_seconds,
      created_by: user.id,
    }));

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
      model_used: 'gemini-2.5-flash',
      input_tokens: prompt.length,
      output_tokens: generatedText.length,
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