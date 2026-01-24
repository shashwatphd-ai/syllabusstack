import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bloom's Taxonomy descriptions with weighted scoring guidance
// Higher levels require more sophisticated content matching
const BLOOM_EVALUATION_CRITERIA: Record<string, { description: string; weight: number }> = {
  remember: {
    description: "Does this video clearly introduce and explain key facts, definitions, and concepts? Look for clear explanations of WHAT things are. Good videos use repetition, mnemonics, and clear terminology.",
    weight: 1.0
  },
  understand: {
    description: "Does this video help explain WHY things work the way they do? Look for examples, analogies, visual explanations, and conceptual bridges. Should go beyond definitions to build mental models.",
    weight: 1.1
  },
  apply: {
    description: "Does this video show HOW to do something step-by-step? Look for tutorials, worked examples, and practical demonstrations with clear procedures. Must show actual application, not just theory.",
    weight: 1.2
  },
  analyze: {
    description: "Does this video break down complex topics into components? Look for comparisons, case studies, relationship mapping, and systematic decomposition. Should identify patterns and connections.",
    weight: 1.3
  },
  evaluate: {
    description: "Does this video help learners make judgments or decisions? Look for debates, critiques, pros/cons analysis, evaluation frameworks, and criteria-based assessment. Must model critical thinking.",
    weight: 1.4
  },
  create: {
    description: "Does this video show how to build or design something new? Look for project walkthroughs, creative processes, synthesis of ideas, and original production. Should enable student creation.",
    weight: 1.5
  }
};

// Mayer's Multimedia Learning Principles for quality evaluation
const MAYER_PRINCIPLES = `
MAYER'S MULTIMEDIA PRINCIPLES - Use these to assess pedagogical quality:
1. COHERENCE: Is extraneous material minimized? Or is it cluttered with irrelevant content?
2. SIGNALING: Are key concepts highlighted and organized clearly?
3. SEGMENTING: Is complex information broken into manageable chunks?
4. MODALITY: Is audio/narration used effectively with visuals (not just text on screen)?
5. PERSONALIZATION: Is the tone conversational and engaging (not robotic/formal)?

RED FLAGS TO DETECT:
- Outdated information (check for dates, deprecated tools, old interfaces)
- Factual inaccuracies or oversimplifications that mislead
- Missing prerequisites (assumes knowledge not yet taught)
- Clickbait titles that don't match content
- Poor audio/video quality that impedes learning
- Excessive length without clear structure
`;

// Scoring calibration guidance
const SCORING_CALIBRATION = `
SCORING CALIBRATION:
- 90-100: Exceptional - Could be used in a professional course, nearly perfect match
- 80-89: Excellent - Strong match, minor improvements possible
- 70-79: Good - Solid content, some gaps or suboptimal aspects
- 60-69: Acceptable - Usable with caveats, notable weaknesses
- 50-59: Marginal - Significant concerns, use only if no alternatives
- Below 50: Not Recommended - Off-topic, wrong level, or quality issues
`;

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
    const bloomConfig = BLOOM_EVALUATION_CRITERIA[bloomLevel] || BLOOM_EVALUATION_CRITERIA.understand;
    const bloomCriteria = bloomConfig.description;
    const bloomWeight = bloomConfig.weight;

    // Format videos for evaluation (limit to 15 to manage token usage)
    const videosToEvaluate = videos.slice(0, 15);
    const videoListText = videosToEvaluate.map((v: any, i: number) => 
      `${i + 1}. VIDEO_ID: ${v.video_id || v.source_id}
   Title: ${v.title}
   Channel: ${v.channel_name || 'Unknown'}
   Duration: ${Math.round((v.duration_seconds || 0) / 60)} minutes
   Description: ${(v.description || '').substring(0, 300)}...`
    ).join('\n\n');

    const systemPrompt = `You are an expert educational content evaluator with deep expertise in instructional design, Bloom's Taxonomy, and Mayer's Multimedia Learning Principles. Your job is to critically assess YouTube videos for their pedagogical fit with specific learning objectives.

${MAYER_PRINCIPLES}

${SCORING_CALIBRATION}

EVALUATION MINDSET:
- Be HONEST and CRITICAL - most videos are mediocre (60-75 range)
- A 90+ score should be rare - reserved for near-perfect pedagogical matches
- A great video for "understanding" might be poor for "applying" the same concept
- Consider both content accuracy AND pedagogical effectiveness
- Flag any red flags that would make content unsuitable`;

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

    // Call AI via OpenRouter (unified-ai-client)
    const result = await generateText({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      model: MODELS.GEMINI_FLASH,
      temperature: 0.3, // Lower temperature for more consistent scoring
      logPrefix: '[evaluate-content-batch]'
    });

    if (!result.content) {
      throw new Error('No content in AI response');
    }

    // Type for AI evaluation response
    interface EvaluationResponse {
      evaluations: Array<{
        video_id: string;
        relevance_score: number;
        pedagogy_score: number;
        quality_score: number;
        total_score: number;
        reasoning: string;
        recommendation: string;
        concern: string | null;
      }>;
    }

    // Parse the JSON from AI response
    let evaluations: EvaluationResponse;
    try {
      evaluations = parseJsonResponse(result.content) as EvaluationResponse;
    } catch (parseError) {
      console.error('Failed to parse AI evaluation response:', result.content);
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
