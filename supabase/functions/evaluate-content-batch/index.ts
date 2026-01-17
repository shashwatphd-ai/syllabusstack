import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Cloud API configuration
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Bloom's Taxonomy descriptions for evaluation context
const BLOOM_EVALUATION_CRITERIA: Record<string, string> = {
  remember: "Does this video clearly introduce and explain key facts, definitions, and concepts? Look for clear explanations of WHAT things are.",
  understand: "Does this video help explain WHY things work the way they do? Look for examples, analogies, and visual explanations that build understanding.",
  apply: "Does this video show HOW to do something step-by-step? Look for tutorials, worked examples, and practical demonstrations.",
  analyze: "Does this video break down complex topics into components? Look for comparisons, case studies, and deep analysis of relationships.",
  evaluate: "Does this video help learners make judgments or decisions? Look for debates, critiques, pros/cons analysis, and evaluation frameworks.",
  create: "Does this video show how to build or design something new? Look for project walkthroughs, creative processes, and synthesis of ideas."
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!googleApiKey) {
      throw new Error('GOOGLE_CLOUD_API_KEY is not configured');
    }

    const { learning_objective, teaching_unit, videos } = await req.json();

    if (!learning_objective || !videos || !Array.isArray(videos)) {
      return new Response(JSON.stringify({ error: 'learning_objective and videos array are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NEW: Check if we have teaching unit context for enhanced evaluation
    const hasTeachingUnit = teaching_unit && teaching_unit.title;

    if (videos.length === 0) {
      return new Response(JSON.stringify({ evaluations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bloomLevel = learning_objective.bloom_level?.toLowerCase() || 'understand';
    const bloomCriteria = BLOOM_EVALUATION_CRITERIA[bloomLevel] || BLOOM_EVALUATION_CRITERIA.understand;

    // Format videos for evaluation (limit to 15 to manage token usage)
    const videosToEvaluate = videos.slice(0, 15);
    const videoListText = videosToEvaluate.map((v: any, i: number) => 
      `${i + 1}. VIDEO_ID: ${v.video_id || v.source_id}
   Title: ${v.title}
   Channel: ${v.channel_name || 'Unknown'}
   Duration: ${Math.round((v.duration_seconds || 0) / 60)} minutes
   Description: ${(v.description || '').substring(0, 300)}...`
    ).join('\n\n');

    const systemPrompt = `You are an expert educational content evaluator. Your job is to assess YouTube videos for their pedagogical fit with specific learning objectives. You understand Bloom's Taxonomy deeply and can identify whether a video's teaching approach matches the required cognitive level.

Be honest and critical - not all videos are good matches. A great video for "understanding" might be poor for "applying" the same concept.`;

    // Build the user prompt - enhanced when teaching unit context is available
    let userPrompt: string;
    
    if (hasTeachingUnit) {
      // ENHANCED PROMPT: Use teaching unit context for micro-concept evaluation
      userPrompt = `Evaluate these YouTube videos for THIS SPECIFIC micro-concept within a larger learning objective:

TEACHING UNIT: "${teaching_unit.title}"
WHAT TO TEACH: ${teaching_unit.what_to_teach}
${teaching_unit.why_this_matters ? `WHY IT MATTERS: ${teaching_unit.why_this_matters}` : ''}
IDEAL VIDEO TYPE: ${teaching_unit.target_video_type || 'explainer'}
${teaching_unit.required_concepts?.length > 0 ? `REQUIRED CONCEPTS: ${teaching_unit.required_concepts.join(', ')}` : ''}
${teaching_unit.avoid_terms?.length > 0 ? `AVOID: ${teaching_unit.avoid_terms.join(', ')}` : ''}
TARGET DURATION: ~${teaching_unit.target_duration_minutes || 10} minutes

OVERALL LEARNING OBJECTIVE: ${learning_objective.text}
BLOOM'S LEVEL: ${bloomLevel.toUpperCase()}

VIDEOS TO EVALUATE:
${videoListText}

Score each video on how well it teaches THIS SPECIFIC micro-concept "${teaching_unit.title}" (not the overall LO).
A video that thoroughly explains "${teaching_unit.what_to_teach}" should score 80+.
A video that covers the general topic but not this specific aspect should score 50-70.
A video that is off-topic or only tangentially related should score below 50.

For each video, score it on three dimensions (each 0-100):

1. RELEVANCE (0-100): Does it cover the exact micro-concept "${teaching_unit.title}"?
   - 80-100: Directly teaches this specific concept
   - 50-79: Related to the overall topic but not this specific aspect
   - 0-49: Off-topic or wrong focus

2. PEDAGOGY (0-100): Is it the right video type (${teaching_unit.target_video_type || 'explainer'}) for learning this concept?
   - 80-100: Perfect match for the teaching approach needed
   - 50-79: Acceptable but could be better
   - 0-49: Wrong approach (e.g., overview when tutorial needed)

3. QUALITY (0-100): Is it well-produced and engaging?
   - 80-100: Professional, clear, engaging
   - 50-79: Acceptable quality
   - 0-49: Poor quality, hard to follow

Return ONLY valid JSON in this exact format:
{
  "evaluations": [
    {
      "video_id": "the VIDEO_ID from above",
      "relevance_score": 85,
      "pedagogy_score": 72,
      "quality_score": 80,
      "total_score": 79,
      "reasoning": "2-3 sentence explanation focusing on how well it teaches ${teaching_unit.title}",
      "recommendation": "highly_recommended|recommended|acceptable|not_recommended",
      "concern": null or "brief concern if any"
    }
  ]
}

Note: total_score = (relevance_score * 0.4) + (pedagogy_score * 0.35) + (quality_score * 0.25)`;
    } else {
      // STANDARD PROMPT: Original LO-level evaluation (fallback)
      userPrompt = `Evaluate these YouTube videos for pedagogical fit with this learning objective:

LEARNING OBJECTIVE: "${learning_objective.text}"

BLOOM'S LEVEL: ${bloomLevel.toUpperCase()}
EVALUATION CRITERIA: ${bloomCriteria}

CORE CONCEPT: ${learning_objective.core_concept || 'the main topic'}
ACTION VERB: ${learning_objective.action_verb || 'understand'}
TARGET DURATION: ~${learning_objective.expected_duration_minutes || 15} minutes

VIDEOS TO EVALUATE:
${videoListText}

For each video, score it on three dimensions (each 0-100):

1. RELEVANCE (0-100): Does it cover the exact topic needed?
   - 80-100: Direct match to the learning objective
   - 50-79: Related but not exactly on target
   - 0-49: Tangentially related or off-topic

2. PEDAGOGY (0-100): Is the teaching approach right for "${bloomLevel}" level?
   - 80-100: Perfect match for the cognitive level required
   - 50-79: Somewhat appropriate but could be better
   - 0-49: Wrong approach (e.g., just explains when should show how-to)

3. QUALITY (0-100): Is it well-produced and engaging?
   - 80-100: Professional, clear, engaging
   - 50-79: Acceptable quality
   - 0-49: Poor quality, hard to follow

Return ONLY valid JSON in this exact format:
{
  "evaluations": [
    {
      "video_id": "the VIDEO_ID from above",
      "relevance_score": 85,
      "pedagogy_score": 72,
      "quality_score": 80,
      "total_score": 79,
      "reasoning": "2-3 sentence explanation of the scores",
      "recommendation": "highly_recommended|recommended|acceptable|not_recommended",
      "concern": null or "brief concern if any"
    }
  ]
}

Note: total_score = (relevance_score * 0.4) + (pedagogy_score * 0.35) + (quality_score * 0.25)`;
    }

    console.log(`Evaluating ${videosToEvaluate.length} videos for LO: ${learning_objective.id}${hasTeachingUnit ? `, Teaching Unit: ${teaching_unit.id}` : ''}`);

    const url = `${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`;
    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent scoring
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from AI response
    let evaluations;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      evaluations = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI evaluation response:', content);
      // Return basic scores if parsing fails
      evaluations = {
        evaluations: videosToEvaluate.map((v: any) => ({
          video_id: v.video_id || v.source_id,
          relevance_score: 50,
          pedagogy_score: 50,
          quality_score: 50,
          total_score: 50,
          reasoning: "Unable to evaluate - using default scores",
          recommendation: "acceptable",
          concern: null
        }))
      };
    }

    console.log('AI evaluations complete:', evaluations.evaluations?.length);

    return new Response(JSON.stringify(evaluations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in evaluate-content-batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
