import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same prompt constants from evaluate-content-batch
const MAYER_PRINCIPLES = `
MAYER'S MULTIMEDIA PRINCIPLES - Use these to assess pedagogical quality:
1. COHERENCE: Is extraneous material minimized?
2. SIGNALING: Are key concepts highlighted and organized clearly?
3. SEGMENTING: Is complex information broken into manageable chunks?
4. MODALITY: Is audio/narration used effectively with visuals?
5. PERSONALIZATION: Is the tone conversational and engaging?

RED FLAGS TO DETECT:
- Outdated information
- Factual inaccuracies or oversimplifications
- Missing prerequisites
- Clickbait titles that don't match content
- Poor audio/video quality
- Excessive length without clear structure
`;

const SCORING_CALIBRATION = `
SCORING CALIBRATION:
- Khan Academy video on exact topic: 88-95
- Good YouTube tutorial from reputable channel: 70-85
- Tangentially related video: NEVER above 65
- Most videos are mediocre: 60-75 range is typical, NOT 85-95

RELEVANCE (40% weight): Does it cover the exact topic?
PEDAGOGY (35% weight): Is the teaching approach right for the Bloom's level?
QUALITY (25% weight): Is it well-produced and engaging?

total_score = (relevance * 0.4) + (pedagogy * 0.35) + (quality * 0.25)
`;

const BLOOM_DESCRIPTIONS: Record<string, string> = {
  remember: "Does this video clearly introduce and explain key facts and definitions?",
  understand: "Does this video help explain WHY things work? Look for examples, analogies, visual explanations.",
  apply: "Does this video show HOW to do something step-by-step? Look for tutorials and demonstrations.",
  analyze: "Does this video break down complex topics into components? Look for comparisons and case studies.",
  evaluate: "Does this video help learners make judgments? Look for debates, critiques, pros/cons analysis.",
  create: "Does this video show how to build or design something new? Look for project walkthroughs.",
};

interface ContentMatch {
  id: string;
  content_id: string;
  learning_objective_id: string;
  content: {
    title: string;
    description: string | null;
    channel_name: string | null;
    duration_seconds: number | null;
    source_id: string | null;
  };
  learning_objective: {
    text: string;
    bloom_level: string | null;
    core_concept: string | null;
    action_verb: string | null;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch all unevaluated content matches
  const { data: matches, error: fetchError } = await supabase
    .from('content_matches')
    .select(`
      id, content_id, learning_objective_id,
      content:content_id (title, description, channel_name, duration_seconds, source_id),
      learning_objective:learning_objective_id (text, bloom_level, core_concept, action_verb)
    `)
    .eq('status', 'pending')
    .is('ai_recommendation', null)
    .limit(500);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const typedMatches = (matches || []) as unknown as ContentMatch[];
  console.log(`Found ${typedMatches.length} unevaluated content matches`);

  if (typedMatches.length === 0) {
    return new Response(JSON.stringify({ message: 'No unevaluated matches found', evaluated: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Group by learning_objective_id
  const groups = new Map<string, ContentMatch[]>();
  for (const match of typedMatches) {
    const loId = match.learning_objective_id;
    if (!groups.has(loId)) groups.set(loId, []);
    groups.get(loId)!.push(match);
  }

  console.log(`Grouped into ${groups.size} learning objective batches`);

  let totalEvaluated = 0;
  let totalAutoApproved = 0;
  let totalFailed = 0;

  for (const [loId, batch] of groups) {
    const lo = batch[0].learning_objective;
    const bloomLevel = lo.bloom_level?.toLowerCase() || 'understand';
    const bloomCriteria = BLOOM_DESCRIPTIONS[bloomLevel] || BLOOM_DESCRIPTIONS.understand;

    // Build video list (max 15)
    const videosToEval = batch.slice(0, 15);
    const videoListText = videosToEval.map((m, i) => {
      const c = m.content;
      return `${i + 1}. VIDEO_ID: ${c.source_id || m.content_id}
   Title: ${c.title}
   Channel: ${c.channel_name || 'Unknown'}
   Duration: ${Math.round((c.duration_seconds || 0) / 60)} minutes
   Description: ${(c.description || '').substring(0, 300)}...`;
    }).join('\n\n');

    const systemPrompt = `You are an expert educational content evaluator with deep expertise in instructional design, Bloom's Taxonomy, and Mayer's Multimedia Learning Principles.

${MAYER_PRINCIPLES}
${SCORING_CALIBRATION}

Be HONEST and CRITICAL - most videos are mediocre (60-75 range). A 90+ score should be rare.`;

    const userPrompt = `Evaluate these YouTube videos for pedagogical fit with this learning objective:

LEARNING OBJECTIVE: "${lo.text}"
BLOOM'S LEVEL: ${bloomLevel.toUpperCase()}
EVALUATION CRITERIA: ${bloomCriteria}
CORE CONCEPT: ${lo.core_concept || 'the main topic'}

VIDEOS TO EVALUATE:
${videoListText}

For each video, score on three dimensions (0-100): RELEVANCE, PEDAGOGY, QUALITY.

Return ONLY valid JSON:
{
  "evaluations": [
    {
      "video_id": "the VIDEO_ID from above",
      "relevance_score": 85,
      "pedagogy_score": 72,
      "quality_score": 80,
      "total_score": 79,
      "reasoning": "2-3 sentence explanation",
      "recommendation": "highly_recommended|recommended|acceptable|not_recommended",
      "concern": null
    }
  ]
}

total_score = (relevance_score * 0.4) + (pedagogy_score * 0.35) + (quality_score * 0.25)`;

    console.log(`Evaluating batch for LO ${loId}: ${videosToEval.length} videos`);

    try {
      const result = await generateText({
        prompt: userPrompt,
        systemPrompt,
        model: MODELS.GEMINI_FLASH,
        temperature: 0.3,
        logPrefix: `[trigger-eval][${loId.substring(0, 8)}]`,
      });

      if (!result.content) {
        console.error(`No AI response for LO ${loId}`);
        totalFailed += videosToEval.length;
        continue;
      }

      interface Evaluation {
        video_id: string;
        relevance_score: number;
        pedagogy_score: number;
        quality_score: number;
        total_score: number;
        reasoning: string;
        recommendation: string;
        concern: string | null;
      }

      let evaluations: { evaluations: Evaluation[] };
      try {
        evaluations = parseJsonResponse(result.content) as { evaluations: Evaluation[] };
      } catch {
        console.error(`Failed to parse AI response for LO ${loId}`);
        totalFailed += videosToEval.length;
        continue;
      }

      // Map evaluations by video_id for lookup
      const evalMap = new Map<string, Evaluation>();
      for (const ev of evaluations.evaluations || []) {
        evalMap.set(ev.video_id, ev);
      }

      // Update each content_match
      for (const match of videosToEval) {
        const videoId = match.content.source_id || match.content_id;
        const ev = evalMap.get(videoId);

        if (!ev) {
          console.warn(`No evaluation returned for video ${videoId}`);
          totalFailed++;
          continue;
        }

        const normalizedScore = Math.min(100, Math.max(0, ev.total_score)) / 100;
        const isAutoApproved = ev.recommendation === 'highly_recommended' && ev.total_score >= 75;

        const { error: updateError } = await supabase
          .from('content_matches')
          .update({
            ai_relevance_score: ev.relevance_score,
            ai_pedagogy_score: ev.pedagogy_score,
            ai_quality_score: ev.quality_score,
            match_score: normalizedScore,
            ai_reasoning: ev.reasoning,
            ai_recommendation: ev.recommendation,
            ai_concern: ev.concern || null,
            status: isAutoApproved ? 'auto_approved' : 'pending',
            ...(isAutoApproved ? { approved_at: new Date().toISOString() } : {}),
          })
          .eq('id', match.id);

        if (updateError) {
          console.error(`Failed to update match ${match.id}:`, updateError.message);
          totalFailed++;
        } else {
          totalEvaluated++;
          if (isAutoApproved) totalAutoApproved++;
        }
      }

      // If batch had more than 15, process remaining
      if (batch.length > 15) {
        console.log(`LO ${loId} has ${batch.length - 15} more videos beyond the 15 limit - skipping extras`);
        totalFailed += batch.length - 15;
      }
    } catch (err) {
      console.error(`AI call failed for LO ${loId}:`, err);
      totalFailed += videosToEval.length;
    }

    // 2-second delay between batches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const summary = {
    total_found: typedMatches.length,
    groups: groups.size,
    evaluated: totalEvaluated,
    auto_approved: totalAutoApproved,
    failed: totalFailed,
  };

  console.log('Evaluation complete:', JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
